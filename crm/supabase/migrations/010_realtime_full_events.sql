-- ============================================================
-- Migration 010
-- Ensure the supabase_realtime publication includes UPDATE and
-- DELETE events for the reservations table.
--
-- DROP + ADD is the safest way to reset the publication entry
-- to the default (all operations) in case it was previously
-- added with FOR INSERT only, or in an unknown state.
-- ============================================================

ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
