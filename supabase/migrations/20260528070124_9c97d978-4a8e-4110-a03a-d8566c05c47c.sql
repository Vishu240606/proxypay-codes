
-- QR sessions table for temporary QR-code payments
CREATE TABLE public.qr_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  receiver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_qr_sessions_token ON public.qr_sessions(token);
CREATE INDEX idx_qr_sessions_receiver ON public.qr_sessions(receiver_id);

GRANT SELECT ON public.qr_sessions TO authenticated;
GRANT ALL ON public.qr_sessions TO service_role;

ALTER TABLE public.qr_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own qr sessions"
ON public.qr_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = receiver_id);

-- Add payment_type to transactions for history filtering
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'code';

-- Allow `code` to be empty for QR payments (still NOT NULL, defaulted)
ALTER TABLE public.transactions ALTER COLUMN code SET DEFAULT '';
