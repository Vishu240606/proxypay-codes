import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CODE_TTL_SECONDS = 120; // 2 minutes
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

function generateCode(): string {
  let out = "PX";
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

const RequestSchema = z.object({
  amount: z.number().positive().max(1_000_000).optional().nullable(),
});

export const requestPaymentCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RequestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString();

    // Try a few times to avoid (very unlikely) collision
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const { data: row, error } = await supabaseAdmin
        .from("payment_codes")
        .insert({
          code,
          receiver_id: userId,
          amount: data.amount ?? null,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (!error && row) {
        return {
          code: row.code,
          expiresAt: row.expires_at,
          amount: row.amount,
        };
      }
      lastError = error;
    }
    throw new Error(
      `Failed to generate code: ${lastError instanceof Error ? lastError.message : "unknown"}`
    );
  });

const SendSchema = z.object({
  receiverEmail: z.string().email().max(255),
  amount: z.number().positive().max(1_000_000),
  code: z.string().min(4).max(20).trim(),
});

export const sendMoney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SendSchema.parse(input))
  .handler(async ({ data, context }) => {
    const senderId = context.userId;

    // 1. Look up code (admin client to bypass RLS — code itself is the secret)
    const { data: codeRow, error: codeErr } = await supabaseAdmin
      .from("payment_codes")
      .select("*")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();

    if (codeErr) throw new Error("Lookup failed");
    if (!codeRow) throw new Error("Invalid or expired code");
    if (codeRow.used) throw new Error("Code already used");
    if (new Date(codeRow.expires_at).getTime() < Date.now()) {
      throw new Error("Invalid or expired code");
    }

    // 2. Resolve receiver by email
    const { data: receiver, error: rErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, balance")
      .eq("email", data.receiverEmail.toLowerCase())
      .maybeSingle();

    if (rErr || !receiver) throw new Error("Receiver not found");
    if (receiver.id !== codeRow.receiver_id) {
      throw new Error("Code does not match receiver");
    }
    if (receiver.id === senderId) {
      throw new Error("Cannot send money to yourself");
    }

    // 3. If code has a fixed amount, enforce it
    if (codeRow.amount != null && Number(codeRow.amount) !== data.amount) {
      throw new Error(`Amount must be exactly $${Number(codeRow.amount).toFixed(2)}`);
    }

    // 4. Check sender balance
    const { data: sender, error: sErr } = await supabaseAdmin
      .from("profiles")
      .select("id, balance")
      .eq("id", senderId)
      .single();

    if (sErr || !sender) throw new Error("Sender profile not found");
    if (Number(sender.balance) < data.amount) throw new Error("Insufficient balance");

    // 5. Mark code used FIRST (idempotency guard) — only succeeds if still unused
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from("payment_codes")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("id", codeRow.id)
      .eq("used", false)
      .select()
      .maybeSingle();

    if (claimErr || !claimed) throw new Error("Code already used");

    // 6. Transfer balances
    const newSenderBal = Number(sender.balance) - data.amount;
    const newReceiverBal = Number(receiver.balance) + data.amount;

    const { error: u1 } = await supabaseAdmin
      .from("profiles")
      .update({ balance: newSenderBal })
      .eq("id", senderId);
    if (u1) throw new Error("Transfer failed");

    const { error: u2 } = await supabaseAdmin
      .from("profiles")
      .update({ balance: newReceiverBal })
      .eq("id", receiver.id);
    if (u2) {
      // rollback sender
      await supabaseAdmin.from("profiles").update({ balance: sender.balance }).eq("id", senderId);
      throw new Error("Transfer failed");
    }

    // 7. Log transaction
    await supabaseAdmin.from("transactions").insert({
      sender_id: senderId,
      receiver_id: receiver.id,
      amount: data.amount,
      code: codeRow.code,
    });

    return {
      success: true,
      newBalance: newSenderBal,
      amount: data.amount,
      receiverEmail: receiver.email,
    };
  });
