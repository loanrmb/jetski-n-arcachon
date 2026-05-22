-- ============================================================
-- Migration 003 — requested_jet_ski column on reservations
-- ============================================================
-- Stores the model name the client requested on the public site
-- (e.g. 'GTI SE 130'). Distinct from jet_ski_id, which is the
-- physical unit assigned by staff after the fact.
-- IF NOT EXISTS makes this safe to re-run if the column was
-- already added manually.
-- ============================================================

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS requested_jet_ski text;
