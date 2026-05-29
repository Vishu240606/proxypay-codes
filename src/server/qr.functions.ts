import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes, createHmac } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const QR_TTL_SECONDS = 90;

function generateToken(receiverId: string): string {
  // Encrypted session token: random bytes + HMAC binding to receiver
  const nonce = randomBytes(24).toString("base64url");
  const secret =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_URL || "proxipay-fallback";
  const sig = createHmac("sha256", secret)
    .update(`${receiverId}:${nonce}`)
    .digest("base64url")
    .slice(0, 24);
  return `PXQR.${nonce}.${sig}`;
}

export const generateQrSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const token = generateToken(userId);
    const expiresAt = new Date(Date.now() + QR_TTL_SECONDS * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from("qr_sessions")
      .insert({
        token,
        receiver_id: userId,
        status: "active",
        used: false,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error || !data) throw new Error("Failed to generate QR session");

    return {
      sessionId: data.id,
      token: data.token,
      expiresAt: data.expires_at,
      ttlSeconds: QR_TTL_SECONDS,
    };
  });

const ScanSchema = z.object({
  token: z.string().min(8).max(200).trim(),
});

export const scanQrSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScanSchema.parse(input))
  .handler(async ({ data, context }) => {
    const senderId = context.userId;

    const { data: session } = await supabaseAdmin
      .from("qr_sessions")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();

    if (!session) throw new Error("Invalid QR code");
    if (session.used || session.status !== "active") {
      throw new Error("QR code already used");
    }
    if (new Date(session.expires_at).getTime() < Date.now()) {
      throw new Error("QR code has expired");
    }
    if (session.receiver_id === senderId) {
      throw new Error("You cannot pay your own QR code");
    }

    const { data: receiver } = await supabaseAdmin
      .from("profiles")
      .select("id, user_id, name")
      .eq("id", session.receiver_id)
      .single();

    if (!receiver) throw new Error("Receiver not found");

    return {
      sessionId: session.id,
      receiverId: receiver.id,
      receiverUserId: receiver.user_id,
      receiverName: receiver.name,
      expiresAt: session.expires_at,
    };
  });

const SendSchema = z.object({
  token: z.string().min(8).max(200).trim(),
  amount: z.number().positive().max(1_000_000),
});

export const sendMoneyByQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SendSchema.parse(input))
  .handler(async ({ data, context }) => {
    const senderId = context.userId;

    // 1. Lookup session
    const { data: session } = await supabaseAdmin
      .from("qr_sessions")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();

    if (!session) throw new Error("Invalid QR code");
    if (session.used || session.status !== "active") {
      throw new Error("QR code already used");
    }
    if (new Date(session.expires_at).getTime() < Date.now()) {
      throw new Error("QR code has expired");
    }
    if (session.receiver_id === senderId) {
      throw new Error("Cannot send to your own QR");
    }

    // 2. Receiver
    const { data: receiver } = await supabaseAdmin
      .from("profiles")
      .select("id, email, balance")
      .eq("id", session.receiver_id)
      .single();
    if (!receiver) throw new Error("Receiver not found");

    // 3. Sender balance
    const { data: sender } = await supabaseAdmin
      .from("profiles")
      .select("id, balance")
      .eq("id", senderId)
      .single();
    if (!sender) throw new Error("Sender profile not found");
    if (Number(sender.balance) < data.amount) throw new Error("Insufficient balance");

    // 4. Claim session (idempotency guard)
    const { data: claimed } = await supabaseAdmin
      .from("qr_sessions")
      .update({ used: true, status: "completed", used_at: new Date().toISOString() })
      .eq("id", session.id)
      .eq("used", false)
      .select()
      .maybeSingle();
    if (!claimed) throw new Error("QR code already used");

    // 5. Transfer
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
      await supabaseAdmin.from("profiles").update({ balance: sender.balance }).eq("id", senderId);
      throw new Error("Transfer failed");
    }

    // 6. Log transaction
    await supabaseAdmin.from("transactions").insert({
      sender_id: senderId,
      receiver_id: receiver.id,
      amount: data.amount,
      code: session.token.slice(0, 12),
      payment_type: "qr",
    });

    return {
      success: true,
      newBalance: newSenderBal,
      amount: data.amount,
      receiverEmail: receiver.email,
    };
  });

export const listActiveQrSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Returns currently-active QR sessions NOT owned by the caller — used by
    // the simulated scanner so demo users can pick a live QR to pay.
    const { data } = await supabaseAdmin
      .from("qr_sessions")
      .select("token, receiver_id, expires_at, created_at")
      .eq("used", false)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .neq("receiver_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(10);

    return { sessions: data ?? [] };
  });
