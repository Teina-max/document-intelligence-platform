-- ============================================================
-- ThermoPack Industries — Script: identify missing PDFs (37/39 processed)
-- Run this against Supabase to find which 2 PDFs were not ingested
-- ============================================================

-- 1. List all processed PDFs from ocr_logs
SELECT
  fichier_source,
  type_document,
  statut,
  score_confiance,
  created_at
FROM ocr_logs
ORDER BY created_at;

-- 2. Count by status
SELECT statut, count(*) AS total
FROM ocr_logs
GROUP BY statut;

-- 3. Cross-reference with known 39 PDF list
-- The 39 PDFs received on 2026-03-19 (from docs/Analyse PDF OCR.md):
WITH known_pdfs(filename) AS (VALUES
  -- Offres non validees (2)
  ('50429405 ThermalEdge.pdf'),
  ('50429415 Uria Forming.pdf'),
  -- Offres transformees (11)
  ('50429576 Polymax SA.pdf'),
  ('50429578 Fromages Belvoir.pdf'),
  ('50429587 Galion Pack.pdf'),
  ('50429590 AlphaMould.pdf'),
  ('50429594 NordPack PLAST.pdf'),
  ('50429598 ColorArtis.pdf'),
  ('50429601 FrostForm.pdf'),
  ('50429604 KondoConcept.pdf'),
  ('50429607 Argus Plasturgie.pdf'),
  ('50429611 Ceres 2000.pdf'),
  ('50429616 Termoformados Iberia.pdf'),
  -- Commandes transformees (11)
  ('70431348 Polymax SA.pdf'),
  ('70431364 Fromages Belvoir.pdf'),
  ('70431366 Galion Pack.pdf'),
  ('70431369 AlphaMould.pdf'),
  ('70431370 NordPack PLAST.pdf'),
  ('70431371 ColorArtis.pdf'),
  ('70431377 FrostForm.pdf'),
  ('70431382 KondoConcept.pdf'),
  ('70431383 Argus Plasturgie.pdf'),
  ('70431386 Ceres 2000.pdf'),
  ('70431387 Termoformados Iberia.pdf'),
  -- Commandes directes (15)
  ('70431226 NordPack Annecy.pdf'),
  ('70431310 Argus Plasturgie.pdf'),
  ('70431313 Galion Pack.pdf'),
  ('70431319 Elvin Dairy.pdf'),
  ('70431322 Ceres 2000.pdf'),
  ('70431329 FrostForm.pdf'),
  ('70431333 AlphaMould.pdf'),
  ('70431335 Galion Pack.pdf'),
  ('70431336 Polymax SA V2.pdf'),
  ('70431340 Fromages Belvoir.pdf'),
  ('70431342 Elvin Dairy.pdf'),
  ('70431363 KondoConcept.pdf'),
  ('70431368 ColorArtis.pdf'),
  ('70431373 Polymax SA.pdf'),
  ('70431378 Termoformados Iberia.pdf')
)
SELECT k.filename AS pdf_manquant
FROM known_pdfs k
LEFT JOIN ocr_logs o ON o.fichier_source LIKE '%' || k.filename || '%'
WHERE o.id IS NULL;
