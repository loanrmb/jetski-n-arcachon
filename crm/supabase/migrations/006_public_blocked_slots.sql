-- ============================================================
-- Migration 006
-- SECURITY DEFINER function for public slot blocking
--
-- The public site (anon) cannot SELECT from reservations.
-- This function exposes blocked slots safely by UNIONing:
--   ① availabilities.is_blocked = true (manual blocks)
--   ② reservations with status IN ('confirmed','in_progress')
-- ============================================================

CREATE OR REPLACE FUNCTION public.public_blocked_slots(
  from_date date,
  to_date   date
)
RETURNS TABLE (
  blocked_date      date,
  blocked_slot      time,
  blocked_jet_ski_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Manual blocks stored in availabilities
  SELECT
    a.date        AS blocked_date,
    a.slot_time   AS blocked_slot,
    a.jet_ski_id  AS blocked_jet_ski_id
  FROM availabilities a
  WHERE a.is_blocked = true
    AND a.date >= from_date
    AND a.date <= to_date
    AND a.jet_ski_id IS NOT NULL

  UNION ALL

  -- Confirmed / in-progress reservations block their slot
  SELECT
    r.date                        AS blocked_date,
    r.slot_time::time             AS blocked_slot,
    r.jet_ski_id                  AS blocked_jet_ski_id
  FROM reservations r
  WHERE r.status IN ('confirmed', 'in_progress')
    AND r.date >= from_date
    AND r.date <= to_date
    AND r.jet_ski_id IS NOT NULL;
$$;

-- Grant execute to the anon role so the public site can call it
GRANT EXECUTE ON FUNCTION public.public_blocked_slots(date, date) TO anon;
