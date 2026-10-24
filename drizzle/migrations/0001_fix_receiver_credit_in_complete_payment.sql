-- Bugfix: the single UPDATE with a CASE only rewrote the sender's balance and
-- left the receiver's credit unapplied. Replace with explicit updates for
-- both rows (still one atomic statement set inside the function).
CREATE OR REPLACE FUNCTION public.complete_payment(
  p_kind text,              -- 'qr' (qr_sessions by token) | 'code' (payment_codes by code)
  p_session_key text,       -- qr token or payment code
  p_sender uuid,
  p_amount numeric,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_session_used boolean;
  v_session_status text;
  v_session_expires timestamptz;
  v_session_receiver uuid;
  v_preset_amount numeric;
  v_receiver uuid;
  v_sender_balance numeric;
  v_receiver_balance numeric;
  v_new_sender numeric;
  v_new_receiver numeric;
  v_tx_id uuid;
  v_first uuid;
  v_second uuid;
  v_kind text := lower(coalesce(p_kind, ''));
BEGIN
  IF v_kind NOT IN ('qr', 'code') THEN
    RAISE EXCEPTION 'INVALID_KIND';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  -- Load and lock the payment session. Concurrent payers serialize here:
  -- the loser blocks until the winner commits, then sees used = true.
  IF v_kind = 'qr' THEN
    SELECT id, used, status, expires_at, receiver_id, NULL::numeric
    INTO v_session_id, v_session_used, v_session_status, v_session_expires, v_session_receiver, v_preset_amount
    FROM public.qr_sessions
    WHERE token = p_session_key
    FOR UPDATE;
  ELSE
    SELECT id, used, 'active'::text, expires_at, receiver_id, amount
    INTO v_session_id, v_session_used, v_session_status, v_session_expires, v_session_receiver, v_preset_amount
    FROM public.payment_codes
    WHERE code = upper(p_session_key)
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;
  IF v_session_used OR v_session_status <> 'active' THEN
    IF v_session_status = 'cancelled' THEN
      RAISE EXCEPTION 'SESSION_CANCELLED';
    END IF;
    RAISE EXCEPTION 'SESSION_ALREADY_USED';
  END IF;
  IF v_session_expires <= now() THEN
    RAISE EXCEPTION 'SESSION_EXPIRED';
  END IF;
  IF v_session_receiver = p_sender THEN
    RAISE EXCEPTION 'SELF_PAYMENT';
  END IF;
  IF v_preset_amount IS NOT NULL AND round(v_preset_amount, 2) <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'AMOUNT_MISMATCH';
  END IF;

  v_receiver := v_session_receiver;

  -- Lock both profile rows in a stable order (smaller uuid first) so two
  -- simultaneous opposite-direction payments cannot deadlock.
  IF p_sender < v_receiver THEN
    v_first := p_sender; v_second := v_receiver;
  ELSE
    v_first := v_receiver; v_second := p_sender;
  END IF;

  SELECT balance INTO v_sender_balance
  FROM public.profiles WHERE id = v_first FOR UPDATE;
  IF NOT FOUND THEN
    IF v_first = p_sender THEN RAISE EXCEPTION 'SENDER_NOT_FOUND'; ELSE RAISE EXCEPTION 'RECEIVER_NOT_FOUND'; END IF;
  END IF;
  SELECT balance INTO v_receiver_balance
  FROM public.profiles WHERE id = v_second FOR UPDATE;
  IF NOT FOUND THEN
    IF v_second = p_sender THEN RAISE EXCEPTION 'SENDER_NOT_FOUND'; ELSE RAISE EXCEPTION 'RECEIVER_NOT_FOUND'; END IF;
  END IF;

  v_sender_balance := CASE WHEN p_sender = v_first THEN v_sender_balance ELSE v_receiver_balance END;
  v_receiver_balance := CASE WHEN p_sender = v_first THEN v_receiver_balance ELSE v_sender_balance END;

  IF v_sender_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  v_new_sender := round(v_sender_balance - p_amount, 2);
  v_new_receiver := round(v_receiver_balance + p_amount, 2);

  UPDATE public.profiles
  SET balance = v_new_sender, updated_at = now()
  WHERE id = p_sender;

  UPDATE public.profiles
  SET balance = v_new_receiver, updated_at = now()
  WHERE id = v_receiver;

  -- Unique index on idempotency_key makes a duplicate transaction
  -- for the same session impossible at the database level.
  INSERT INTO public.transactions
    (sender_id, receiver_id, amount, code, payment_type, idempotency_key)
  VALUES
    (p_sender, v_receiver, p_amount, left(p_session_key, 12),
     CASE WHEN v_kind = 'qr' THEN 'qr' ELSE 'code' END,
     p_idempotency_key)
  RETURNING id INTO v_tx_id;

  -- Invalidate the session in the same atomic statement.
  IF v_kind = 'qr' THEN
    UPDATE public.qr_sessions
    SET used = true, status = 'completed', used_at = now()
    WHERE id = v_session_id;
  ELSE
    UPDATE public.payment_codes
    SET used = true, used_at = now()
    WHERE id = v_session_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'new_sender_balance', v_new_sender,
    'new_receiver_balance', v_new_receiver,
    'receiver_id', v_receiver
  );
END;
$$;

-- Server-only: callable exclusively by the service-role admin client.
REVOKE EXECUTE ON FUNCTION public.complete_payment(text, text, uuid, numeric, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_payment(text, text, uuid, numeric, text)
  TO service_role;