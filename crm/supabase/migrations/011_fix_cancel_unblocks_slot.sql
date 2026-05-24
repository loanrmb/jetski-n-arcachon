-- ============================================================
-- Migration 011
-- Fix sync_availability_on_reservation() trigger so that
-- cancelling / marking no-show a reservation reliably
-- sets is_blocked = FALSE in availabilities.
--
-- Two bugs in the original:
--
-- Bug 1 — AND reservation_id = NEW.id on the cancellation branch.
--   If a second booking is confirmed for the same slot, the ON CONFLICT
--   DO UPDATE overwrites reservation_id with the newer booking's id.
--   When the first reservation is then cancelled, NEW.id no longer
--   matches → UPDATE finds 0 rows → row stays is_blocked = TRUE.
--   Fix: drop the reservation_id filter; (jet_ski_id, date, slot_time)
--   is the unique key and sufficient to identify the row.
--
-- Bug 2 — jet_ski_id IS NULL (online bookings).
--   NULL = NULL is always false in SQL, so the cancellation WHERE
--   never matches online bookings.
--   The confirmation branch also inserts junk NULL rows into
--   availabilities (harmless for public_blocked_slots because branch
--   ① filters jet_ski_id IS NOT NULL, but adds noise).
--   Fix: skip the INSERT on confirmation when jet_ski_id IS NULL
--   (public_blocked_slots branch ③ handles those via name JOIN).
--   On cancellation, resolve NULL → UUID via requested_jet_ski name.
-- ============================================================

CREATE OR REPLACE FUNCTION sync_availability_on_reservation()
RETURNS TRIGGER AS $$
BEGIN

  -- ── CONFIRMATION / IN-PROGRESS → block the slot ──────────────
  IF NEW.status IN ('confirmed', 'in_progress') THEN

    -- Only write to availabilities when a physical jet ski is assigned.
    -- Online bookings (jet_ski_id IS NULL) are handled by
    -- public_blocked_slots() branch ③ (JOIN via requested_jet_ski name).
    IF NEW.jet_ski_id IS NOT NULL THEN
      INSERT INTO availabilities (jet_ski_id, date, slot_time, is_blocked, reservation_id)
      VALUES (NEW.jet_ski_id, NEW.date, NEW.slot_time, TRUE, NEW.id)
      ON CONFLICT (jet_ski_id, date, slot_time) DO UPDATE SET
        is_blocked     = TRUE,
        reservation_id = NEW.id,
        updated_at     = NOW();
    END IF;

  -- ── CANCELLATION / NO-SHOW / PENDING → free the slot ─────────
  ELSIF NEW.status IN ('cancelled', 'no_show', 'pending') THEN

    IF NEW.jet_ski_id IS NOT NULL THEN
      -- Reservation has an assigned jet ski — match directly.
      -- NOTE: reservation_id filter removed (Bug 1 above).
      UPDATE availabilities SET
        is_blocked     = FALSE,
        reservation_id = NULL,
        updated_at     = NOW()
      WHERE jet_ski_id = NEW.jet_ski_id
        AND date       = NEW.date
        AND slot_time  = NEW.slot_time;

    ELSIF NEW.requested_jet_ski IS NOT NULL THEN
      -- Online booking (jet_ski_id IS NULL) — resolve UUID via name.
      UPDATE availabilities SET
        is_blocked     = FALSE,
        reservation_id = NULL,
        updated_at     = NOW()
      FROM jet_skis j
      WHERE j.name              = NEW.requested_jet_ski
        AND availabilities.jet_ski_id = j.id
        AND availabilities.date       = NEW.date
        AND availabilities.slot_time  = NEW.slot_time;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger definition is unchanged; recreating for completeness.
DROP TRIGGER IF EXISTS trg_sync_availability ON reservations;
CREATE TRIGGER trg_sync_availability
  AFTER INSERT OR UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION sync_availability_on_reservation();
