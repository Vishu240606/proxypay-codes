import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mapPaymentError } from "@/lib/payment-errors";

const CODE_TTL_SECONDS = 120; // 2 minutes
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

const USER_ID_RE = /^[a-z0-9](?:[a-z0-9_]{0,30}[a-z0-9])?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const userIdSchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .transform((v) => v.toLowerCase())
  .refine((v) => USER_ID_RE.test(v), { message: "Invalid User ID format" });

/** Accepts either a public user_id (e.g. "venki_123") or an email address. */
const receiverHandleSchema = z
  .string()
  .trim()
  .min(2)
  .max(254)
  .refine(
    (v) => EMAIL_RE.test(v) || USER_ID_RE.test(v.toLowerCase()),
    { message: "Enter a valid User ID or email address" },
  );

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
        return { code: row.code, expiresAt: row.expires_at, amount: row.amount };
      }
      lastError = error;
    }
    throw new Error(
      `Failed to generate code: ${lastError instanceof Error ? lastError.message : "unknown"}`,
    );
  });

/** Look up a receiver by their User ID OR registered email. */
const LookupSchema = z.object({ receiverUserId: receiverHandleSchema });

export const lookupReceiver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const parsed = LookupSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error("Enter a valid User ID or email address");
    }
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    const raw = data.receiverUserId.trim();
    const isEmail = EMAIL_RE.test(raw);

    const query = supabaseAdmin.from("profiles").select("id, name, user_id");
    const { data: receiver } = isEmail
      ? await query.ilike("email", raw).maybeSingle()
      : await query.eq("user_id", raw.toLowerCase()).maybeSingle();

    if (!receiver) throw new Error("No account found for that User ID or email");
    if (receiver.id === context.userId) {
      throw new Error("You cannot send money to yourself");
    }

    return {
      id: receiver.id,
      name: receiver.name,
      userId: receiver.user_id,
    };
  });

const ValidateSchema = z.object({
  receiverUserId: userIdSchema,
  amount: z.number().positive().max(1_000_000),
  code: z.string().min(4).max(20).trim(),
});

export const validatePaymentCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ValidateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const senderId = context.userId;

    const { data: codeRow } = await supabaseAdmin
      .from("payment_codes")
      .select("*")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();

    if (!codeRow) throw new Error("Invalid verification code");
    if (codeRow.used) throw new Error("Code already used");
    if (new Date(codeRow.expires_at).getTime() < Date.now()) {
      throw new Error("Verification code has expired");
    }

    const { data: receiver } = await supabaseAdmin
      .from("profiles")
      .select("id, user_id")
      .eq("user_id", data.receiverUserId)
      .maybeSingle();

    if (!receiver) throw new Error("User ID not found");
    if (receiver.id !== codeRow.receiver_id) {
      throw new Error("Code does not match receiver");
    }
    if (receiver.id === senderId) {
      throw new Error("Cannot send money to yourself");
    }
    if (codeRow.amount != null && Number(codeRow.amount) !== data.amount) {
      throw new Error(`Amount must be exactly $${Number(codeRow.amount).toFixed(2)}`);
    }

    const { data: sender } = await supabaseAdmin
      .from("profiles")
      .select("balance")
      .eq("id", senderId)
      .single();

    if (!sender || Number(sender.balance) < data.amount) {
      throw new Error("Insufficient balance");
    }

    return { ok: true as const };
  });

const SendSchema = z.object({
  receiverUserId: userIdSchema,
  amount: z.number().positive().max(1_000_000),
  code: z.string().min(4).max(20).trim(),
});

export const sendMoney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SendSchema.parse(input))
  .handler(async ({ data, context }) => {
    const senderId = context.userId;

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

    const { data: receiver, error: rErr } = await supabaseAdmin
      .from("profiles")
      .select("id, user_id, balance")
      .eq("user_id", data.receiverUserId)
      .maybeSingle();

    if (rErr || !receiver) throw new Error("User ID not found");
    if (receiver.id !== codeRow.receiver_id) {
      throw new Error("Code does not match receiver");
    }
    if (receiver.id === senderId) {
      throw new Error("Cannot send money to yourself");
    }

    if (codeRow.amount != null && Number(codeRow.amount) !== data.amount) {
      throw new Error(`Amount must be exactly $${Number(codeRow.amount).toFixed(2)}`);
    }

    const { data: sender, error: sErr } = await supabaseAdmin
      .from("profiles")
      .select("id, balance")
      .eq("id", senderId)
      .single();

    if (sErr || !sender) throw new Error("Sender profile not found");
    if (Number(sender.balance) < data.amount) throw new Error("Insufficient balance");

    // Final atomic step: session claim, sender debit, receiver credit,
    // transaction record and code invalidation all happen inside a single
    // database statement guarded by row locks and a unique idempotency key.
    // Success is returned only after the database commits.
    const { data: result, error: payErr } = await supabaseAdmin.rpc("complete_payment", {
      p_kind: "code",
      p_session_key: codeRow.code,
      p_sender: senderId,
      p_amount: data.amount,
      p_idempotency_key: `code:${codeRow.id}`,
    });

    if (payErr || !result) {
      throw new Error(mapPaymentError("code", payErr?.message, "Transfer failed"));
    }

    const settled = result as { new_sender_balance: number | string };

    return {
      success: true,
      newBalance: Number(settled.new_sender_balance),
      amount: data.amount,
      receiverUserId: receiver.user_id,
    };
  });
