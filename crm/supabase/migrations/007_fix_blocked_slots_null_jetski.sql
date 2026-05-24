-- ============================================================
-- Migration 007
-- Fix public_blocked_slots() to handle reservations where
-- jet_ski_id IS NULL (client booked via online form — only
-- requested_jet_ski name was stored, no physical jet ski
-- assigned yet by staff).
--
-- Third UNION branch: JOIN reservations → jet_skis via name
-- so the slug still appears in blockedSet on the public site.
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
  -- ① Manual blocks stored in availabilities
  SELECT
    a.date        AS blocked_date,
    a.slot_time   AS blocked_slot,
    a.jet_ski_id  AS blocked_jet_ski_id
  FROM availabilities a
  WHERE a.is_blocked = true
    AND a.date BETWEEN from_date AND to_date
    AND a.jet_ski_id IS NOT NULL

  UNION

  -- ② Confirmed / in-progress reservations WITH assigned jet ski
  SELECT
    r.date        AS blocked_date,
    r.slot_time   AS blocked_slot,
    r.jet_ski_id  AS blocked_jet_ski_id
  FROM reservations r
  WHERE r.status IN ('confirmed', 'in_progress')
    AND r.jet_ski_id IS NOT NULL
    AND r.date BETWEEN from_date AND to_date

  UNION

  -- ③ Confirmed / in-progress reservations WITHOUT assigned jet ski
  --   (online bookings: only requested_jet_ski name is set)
  --   Resolve UUID via jet_skis.name lookup.
  SELECT
    r.date        AS blocked_date,
    r.slot_time   AS blocked_slot,
    j.id          AS blocked_jet_ski_id
  FROM reservations r
  JOIN jet_skis j ON j.name = r.requested_jet_ski
  WHERE r.status IN ('confirmed', 'in_progress')
    AND r.jet_ski_id IS NULL
    AND r.date BETWEEN from_date AND to_date;
$$;

-- Re-grant (CREATE OR REPLACE drops and recreates the function)
GRANT EXECUTE ON FUNCTION public.public_blocked_slots(date, date) TO anon;
