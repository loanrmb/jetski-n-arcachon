-- ============================================================
-- Migration 004 — Renommage des jet skis
-- Aligne les noms en base avec les nouveaux modèles Sea-Doo
-- ============================================================

UPDATE jet_skis SET name = 'GTX 170',        model = 'Sea-Doo GTX 170'        WHERE name = 'GTI SE 130';
UPDATE jet_skis SET name = 'GTX Limited 230', model = 'Sea-Doo GTX Limited 230' WHERE name = 'GTX 230';
UPDATE jet_skis SET name = 'GTX Limited 325', model = 'Sea-Doo GTX Limited 325' WHERE name = 'RXT-X 300';
