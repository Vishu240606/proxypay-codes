/**
 * Maps error codes raised by the `complete_payment` database function
 * to user-friendly messages for each payment kind (qr | code).
 */
type Kind = "qr" | "code";

const MESSAGES: Record<string, [string, string]> = {
  SESSION_NOT_FOUND: ["Invalid QR code", "Invalid verification code"],
  SESSION_ALREADY_USED: ["This QR has already been used", "Code already used"],
  SESSION_CANCELLED: ["QR session was cancelled", "Code session was cancelled"],
  SESSION_EXPIRED: ["QR code has expired", "Verification code has expired"],
  SELF_PAYMENT: ["You cannot pay your own QR code", "Cannot send money to yourself"],
  AMOUNT_MISMATCH: [
    "Amount does not match the requested amount",
    "Amount does not match the requested amount",
  ],
  INVALID_AMOUNT: ["Invalid amount", "Invalid amount"],
  INSUFFICIENT_BALANCE: ["Insufficient balance", "Insufficient balance"],
  SENDER_NOT_FOUND: ["Sender profile not found", "Sender profile not found"],
  RECEIVER_NOT_FOUND: ["Receiver not found", "Receiver not found"],
};

export function mapPaymentError(
  kind: Kind,
  message: string | undefined,
  fallback: string,
): string {
  const code = (message ?? "").trim();
  const entry = MESSAGES[code];
  if (entry) return entry[kind === "qr" ? 0 : 1];
  return fallback;
}
