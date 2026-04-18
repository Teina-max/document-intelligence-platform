-- 019: Add opt-out columns for relance emails
-- When a client clicks "stop relances", n8n calls this to mark the offer

ALTER TABLE offres
  ADD COLUMN IF NOT EXISTS relance_stoppee BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS relance_stoppee_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS relance_stoppee_raison TEXT;

-- Index for WF-003: quickly filter out opted-out offers
CREATE INDEX IF NOT EXISTS idx_offres_relance_active
  ON offres (date_expiration)
  WHERE statut = 'en_attente' AND relance_stoppee = false;

COMMENT ON COLUMN offres.relance_stoppee IS 'Client has opted out of follow-up emails for this offer';
COMMENT ON COLUMN offres.relance_stoppee_at IS 'Timestamp when the client opted out';
COMMENT ON COLUMN offres.relance_stoppee_raison IS 'Optional reason from opt-out (not interested, bought elsewhere, etc.)';
