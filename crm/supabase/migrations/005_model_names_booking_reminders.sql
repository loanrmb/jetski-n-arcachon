-- ============================================================
-- Migration 005
-- ① Sync jet ski names with public site       (Task 1)
-- ② Add booking_enabled column to jet_skis   (Task 2)
-- ③ Add reminder timestamp columns           (Task 3)
-- ============================================================

-- ── Task 1: Align names with public site ───────────────────
-- Identify rows by color (stable after migration 004 renamed them)
UPDATE jet_skis
SET name = 'GTI SE 130', model = 'Sea-Doo GTI SE 130',
    power_hp = 130, max_speed_kmh = 75
WHERE color = '#3B82F6';

UPDATE jet_skis
SET name = 'GTX 230', model = 'Sea-Doo GTX 230',
    power_hp = 230, max_speed_kmh = 85
WHERE color = '#10B981';

UPDATE jet_skis
SET name = 'RXT-X 300', model = 'Sea-Doo RXT-X 300',
    power_hp = 300, max_speed_kmh = 95
WHERE color = '#EF4444';

-- ── Task 2: Booking toggle ─────────────────────────────────
ALTER TABLE jet_skis
  ADD COLUMN IF NOT EXISTS booking_enabled boolean DEFAULT true;

-- Update availability sync trigger to also respect booking_enabled
-- When booking_enabled = false, we treat the model as fully blocked.
-- This is enforced at the API level (availability route filters disabled models).

-- ── Task 3: Reminder sent timestamps ──────────────────────
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS reminder_j1_sent timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_h3_sent timestamptz;
