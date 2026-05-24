-- ============================================================
-- Migration 009
-- Fix slots_per_duration: 4h blocks 2 slots, not 3.
--
-- A 4h (demi-journée) booking ends at start+4h, not start+6h.
--
-- Correct slot-blocking table:
--   1h → 1 slot  (e.g. 09:00 only)
--   2h → 2 slots (e.g. 09:00 + 11:00)
--   4h → 2 slots (e.g. 09:00 + 11:00 — ends 13:00, 14:00 stays free)
--
-- Verification:
--   09:00 / 1h → ends 10:00 → blocks: 09:00              ✓
--   09:00 / 2h → ends 11:00 → blocks: 09:00, 11:00       ✓
--   09:00 / 4h → ends 13:00 → blocks: 09:00, 11:00       ✓ (14:00 free)
--   11:00 / 2h → ends 13:00 → blocks: 11:00, 14:00       ✓
--   11:00 / 4h → ends 15:00 → blocks: 11:00, 14:00       ✓
--   16:00 / 1h → ends 17:00 → blocks: 16:00              ✓
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

WITH

-- Fixed slot order (must match SLOT_TIMES in script.js)
all_slots(slot_order, slot_time) AS (
  VALUES
    (1, TIME '09:00'),
    (2, TIME '11:00'),
    (3, TIME '14:00'),
    (4, TIME '16:00')
),

-- How many consecutive slots each duration occupies
-- 4h was wrongly set to 3 in migration 008 — corrected to 2.
slots_per_duration(duration_hours, slots_count) AS (
  VALUES
    (1, 1),
    (2, 2),
    (4, 2)
),

-- All confirmed / in-progress reservations, normalised to a UUID
confirmed_reservations AS (

  -- ① Reservation has an assigned jet ski
  SELECT
    r.date,
    r.slot_time::time  AS start_slot,
    r.duration_hours,
    r.jet_ski_id
  FROM reservations r
  WHERE r.status IN ('confirmed', 'in_progress')
    AND r.jet_ski_id IS NOT NULL
    AND r.date BETWEEN from_date AND to_date

  UNION ALL

  -- ② Online booking (jet_ski_id IS NULL) — resolve UUID via name
  SELECT
    r.date,
    r.slot_time::time  AS start_slot,
    r.duration_hours,
    j.id               AS jet_ski_id
  FROM reservations r
  JOIN jet_skis j ON j.name = r.requested_jet_ski
  WHERE r.status IN ('confirmed', 'in_progress')
    AND r.jet_ski_id IS NULL
    AND r.date BETWEEN from_date AND to_date
),

-- Expand each reservation into all the slots it occupies
expanded AS (
  SELECT
    cr.date,
    s2.slot_time  AS blocked_slot,
    cr.jet_ski_id
  FROM confirmed_reservations cr
  JOIN all_slots          s1  ON s1.slot_time  = cr.start_slot
  JOIN slots_per_duration spd ON spd.duration_hours = cr.duration_hours
  JOIN all_slots          s2  ON s2.slot_order BETWEEN s1.slot_order
                                                   AND s1.slot_order + spd.slots_count - 1
)

-- Confirmed/in-progress blocks (duration-expanded)
SELECT date, blocked_slot, jet_ski_id FROM expanded

UNION

-- Manual blocks from availabilities (unchanged)
SELECT
  a.date,
  a.slot_time::time,
  a.jet_ski_id
FROM availabilities a
WHERE a.is_blocked = true
  AND a.date BETWEEN from_date AND to_date
  AND a.jet_ski_id IS NOT NULL;

$$;

-- Re-grant after CREATE OR REPLACE
GRANT EXECUTE ON FUNCTION public.public_blocked_slots(date, date) TO anon;
