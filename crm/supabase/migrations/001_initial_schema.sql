-- ============================================================
-- Jetski Arcachon CRM — schéma initial
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE jet_skis (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  model         VARCHAR(100) NOT NULL,
  power_hp      INTEGER,
  max_speed_kmh INTEGER,
  capacity      INTEGER DEFAULT 3,
  price_1h      DECIMAL(10,2) NOT NULL,
  price_2h      DECIMAL(10,2) NOT NULL,
  price_4h      DECIMAL(10,2) NOT NULL,
  status        VARCHAR(20)  DEFAULT 'active'
                  CHECK (status IN ('active','maintenance','out_of_service')),
  image_url     TEXT,
  color         VARCHAR(7)   DEFAULT '#3B82F6',
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE clients (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  phone         VARCHAR(20),
  internal_note TEXT,
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE reservations (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  jet_ski_id        UUID REFERENCES jet_skis(id) ON DELETE SET NULL,
  client_id         UUID REFERENCES clients(id)   ON DELETE SET NULL,
  date              DATE        NOT NULL,
  slot_time         TIME        NOT NULL,
  duration_hours    DECIMAL(3,1) NOT NULL
                      CHECK (duration_hours IN (1, 2, 4)),
  status            VARCHAR(20) DEFAULT 'pending'
                      CHECK (status IN ('pending','confirmed','in_progress','completed','cancelled','no_show')),
  source            VARCHAR(20) DEFAULT 'online'
                      CHECK (source IN ('online','phone','on_site')),
  nb_persons        INTEGER     DEFAULT 1
                      CHECK (nb_persons BETWEEN 1 AND 3),
  license_verified  VARCHAR(20) DEFAULT 'not_verified'
                      CHECK (license_verified IN ('yes','no','not_verified')),
  client_message    TEXT,
  internal_note     TEXT,
  fuel_note         TEXT,
  caution_collected BOOLEAN     DEFAULT FALSE,
  price_total       DECIMAL(10,2),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Source de vérité partagée avec le site public
CREATE TABLE availabilities (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  jet_ski_id      UUID REFERENCES jet_skis(id)     ON DELETE CASCADE,
  date            DATE        NOT NULL,
  slot_time       TIME        NOT NULL,
  is_blocked      BOOLEAN     DEFAULT FALSE,
  blocked_reason  TEXT,
  reservation_id  UUID REFERENCES reservations(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (jet_ski_id, date, slot_time)
);

-- Journal d'audit des réservations
CREATE TABLE reservation_logs (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reservation_id   UUID REFERENCES reservations(id) ON DELETE CASCADE,
  changed_by       UUID REFERENCES auth.users(id),
  changed_by_email VARCHAR(255),
  old_status       VARCHAR(20),
  new_status       VARCHAR(20),
  note             TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Historique des maintenances
CREATE TABLE maintenance_logs (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  jet_ski_id   UUID REFERENCES jet_skis(id) ON DELETE CASCADE,
  date         DATE        NOT NULL,
  description  TEXT        NOT NULL,
  performed_by VARCHAR(100),
  cost         DECIMAL(10,2),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_jet_skis_updated_at
  BEFORE UPDATE ON jet_skis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_availabilities_updated_at
  BEFORE UPDATE ON availabilities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRIGGER : sync availabilities ↔ reservations
-- ============================================================

CREATE OR REPLACE FUNCTION sync_availability_on_reservation()
RETURNS TRIGGER AS $$
BEGIN
  -- Confirmer ou démarrer → bloquer le créneau
  IF NEW.status IN ('confirmed', 'in_progress') THEN
    INSERT INTO availabilities (jet_ski_id, date, slot_time, is_blocked, reservation_id)
    VALUES (NEW.jet_ski_id, NEW.date, NEW.slot_time, TRUE, NEW.id)
    ON CONFLICT (jet_ski_id, date, slot_time) DO UPDATE SET
      is_blocked     = TRUE,
      reservation_id = NEW.id,
      updated_at     = NOW();

  -- Annuler ou no-show → libérer le créneau
  ELSIF NEW.status IN ('cancelled', 'no_show') THEN
    UPDATE availabilities SET
      is_blocked     = FALSE,
      reservation_id = NULL,
      updated_at     = NOW()
    WHERE jet_ski_id     = NEW.jet_ski_id
      AND date           = NEW.date
      AND slot_time      = NEW.slot_time
      AND reservation_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_availability
  AFTER INSERT OR UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION sync_availability_on_reservation();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE jet_skis         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE availabilities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;

-- Staff authentifié : accès total
CREATE POLICY "staff_jet_skis"         ON jet_skis
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_clients"          ON clients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_reservations"     ON reservations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_availabilities"   ON availabilities
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_reservation_logs" ON reservation_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_maintenance_logs" ON maintenance_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Site public (anon) : lecture des dispos + création de réservations en attente
CREATE POLICY "public_read_availabilities" ON availabilities
  FOR SELECT TO anon USING (true);
CREATE POLICY "public_read_jet_skis" ON jet_skis
  FOR SELECT TO anon USING (true);
CREATE POLICY "public_create_reservation" ON reservations
  FOR INSERT TO anon WITH CHECK (status = 'pending');

-- ============================================================
-- DONNÉES INITIALES
-- ============================================================

INSERT INTO jet_skis (name, model, power_hp, max_speed_kmh, capacity, price_1h, price_2h, price_4h, status, color)
VALUES
  ('GTI SE 130', 'Sea-Doo GTI SE 130', 130, 75, 3, 110.00, 200.00, 380.00, 'active', '#3B82F6'),
  ('GTX 230',    'Sea-Doo GTX 230',    230, 85, 3, 125.00, 230.00, 440.00, 'active', '#10B981'),
  ('RXT-X 300',  'Sea-Doo RXT-X 300',  300, 95, 3, 140.00, 260.00, 500.00, 'active', '#EF4444');

-- ============================================================
-- REALTIME (publication pour le site public)
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE availabilities;
ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
