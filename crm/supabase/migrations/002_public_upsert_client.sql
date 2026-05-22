-- ============================================================
-- Migration 002 — public_upsert_client RPC
-- ============================================================
-- Anon role has INSERT-only on clients (no UPDATE, no SELECT).
-- A plain upsert() from the public site would fail on conflict
-- because the UPDATE path is blocked by RLS.
-- This SECURITY DEFINER function runs as the function owner,
-- bypassing RLS, and returns only the client UUID — nothing else
-- is exposed to the caller.
-- ============================================================

CREATE OR REPLACE FUNCTION public_upsert_client(
  p_first_name text,
  p_last_name  text,
  p_email      text,
  p_phone      text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO clients (first_name, last_name, email, phone)
  VALUES (p_first_name, p_last_name, p_email, p_phone)
  ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name  = EXCLUDED.last_name,
    phone      = COALESCE(EXCLUDED.phone, clients.phone),
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Grant execute to anon (public site) only — authenticated uses Supabase client directly
GRANT EXECUTE ON FUNCTION public_upsert_client TO anon;
