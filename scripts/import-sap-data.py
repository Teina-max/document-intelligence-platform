#!/usr/bin/env python3
"""
Import SAP data from 4 Excel files into Supabase.
Optimized: pre-loads all existing references, then processes updates/inserts in batches.
"""

import json
import urllib.request
import urllib.parse
import urllib.error
import time
import sys
from datetime import datetime, date, timezone
from pathlib import Path

import openpyxl

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path("/home/teina/projects/thermopack-demo")
TODAY = date.today().isoformat()
NOW = datetime.now(timezone.utc).isoformat()

env = {}
with open(PROJECT_ROOT / ".env") as f:
    for line in f:
        line = line.strip()
        if "=" in line and not line.startswith("#") and line:
            k, v = line.split("=", 1)
            env[k] = v

SUPABASE_URL = env["SUPABASE_URL"]
SUPABASE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"]

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

BATCH_SIZE = 50  # rows per upsert/patch call

stats = {
    "offres_matched": 0,
    "offres_updated": 0,
    "offres_inserted": 0,
    "offres_montant_backfilled": 0,
    "offres_skipped_no_ref": 0,
    "offres_skipped_dup": 0,
    "commandes_matched": 0,
    "commandes_updated": 0,
    "commandes_inserted": 0,
    "commandes_montant_backfilled": 0,
    "commandes_skipped_no_ref": 0,
    "commandes_skipped_dup": 0,
    "entreprises_created": 0,
    "errors": 0,
    "total_montant_sap_offres": 0.0,
    "total_montant_sap_commandes": 0.0,
}

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def api(method, path, body=None, extra_headers=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    hdrs = dict(HEADERS)
    if extra_headers:
        hdrs.update(extra_headers)
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        resp = urllib.request.urlopen(req)
        raw = resp.read().decode()
        return json.loads(raw) if raw else None, resp
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  ERROR {e.code} on {method} {path[:80]}: {err[:300]}")
        stats["errors"] += 1
        return None, None


def fetch_all(table, select, page_size=1000):
    """Fetch all rows from a table with pagination."""
    rows = []
    offset = 0
    while True:
        result, _ = api("GET", f"{table}?select={select}&limit={page_size}&offset={offset}")
        if not result:
            break
        rows.extend(result)
        if len(result) < page_size:
            break
        offset += page_size
    return rows


def count_where(table, condition):
    """Count rows matching a condition."""
    _, resp = api("GET", f"{table}?select=id&{condition}",
                  extra_headers={"Prefer": "count=exact", "Range": "0-0"})
    if resp:
        cr = resp.headers.get("Content-Range", "")
        return cr.split("/")[-1] if "/" in cr else "?"
    return "?"


def batch_patch(table, field, rows_by_key):
    """Patch rows one by one (Supabase REST doesn't support multi-key batch PATCH)."""
    done = 0
    for key, body in rows_by_key.items():
        safe = urllib.parse.quote(str(key), safe="")
        api("PATCH", f"{table}?{field}=eq.{safe}", body=body,
            extra_headers={"Prefer": "return=minimal"})
        done += 1
    return done


def batch_insert(table, rows, batch_size=BATCH_SIZE):
    """Insert rows in batches."""
    inserted = 0
    for i in range(0, len(rows), batch_size):
        chunk = rows[i:i + batch_size]
        result, _ = api("POST", table, body=chunk,
                        extra_headers={"Prefer": "return=representation"})
        if result:
            inserted += len(result)
    return inserted


# ---------------------------------------------------------------------------
# Date / value helpers
# ---------------------------------------------------------------------------

def to_date_str(val):
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d")
    if isinstance(val, date):
        return val.isoformat()
    s = str(val).strip()
    return s if s else None


def to_float(val):
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    try:
        return float(str(val).replace(",", ".").replace(" ", ""))
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Pre-load existing data
# ---------------------------------------------------------------------------

def load_existing_offres():
    """Load all offre references with id and montant_ht."""
    print("  Loading existing offres...")
    rows = fetch_all("offres", "id,reference_offre,montant_ht")
    result = {}
    for r in rows:
        ref = r.get("reference_offre")
        if ref:
            result[ref] = {"id": r["id"], "montant_ht": r.get("montant_ht")}
    print(f"  -> {len(result)} offres loaded")
    return result


def load_existing_commandes():
    """Load all commande references with id and montant_ht."""
    print("  Loading existing commandes...")
    rows = fetch_all("commandes", "id,reference_commande,montant_ht")
    result = {}
    for r in rows:
        ref = r.get("reference_commande")
        if ref:
            result[ref] = {"id": r["id"], "montant_ht": r.get("montant_ht")}
    print(f"  -> {len(result)} commandes loaded")
    return result


def load_entreprise_cache():
    """Load all entreprises numero_client -> id."""
    print("  Loading entreprises...")
    rows = fetch_all("entreprises", "id,numero_client")
    result = {}
    for r in rows:
        nc = r.get("numero_client")
        if nc:
            result[nc] = r["id"]
    print(f"  -> {len(result)} entreprises loaded")
    return result


# ---------------------------------------------------------------------------
# Entreprise resolution (with lazy creation)
# ---------------------------------------------------------------------------

_ent_cache = {}
_ent_create_queue = {}  # donneur_ordre -> {nom, pays}


def resolve_entreprise(donneur_ordre, nom=None, pays=None):
    """Resolve or queue entreprise creation. Returns id or None."""
    if not donneur_ordre:
        return None
    do = str(donneur_ordre).strip()
    if do in _ent_cache:
        return _ent_cache[do]
    # Queue for batch creation
    if do not in _ent_create_queue:
        _ent_create_queue[do] = {"nom": nom or f"Client SAP {do}", "pays": pays}
    return None  # will be resolved after batch create


def flush_entreprise_queue():
    """Create all queued entreprises in batch and update cache."""
    if not _ent_create_queue:
        return
    print(f"  Creating {len(_ent_create_queue)} new entreprises...")
    rows = []
    for do, info in _ent_create_queue.items():
        rows.append({
            "numero_client": do,
            "nom": info["nom"],
            "pays": info["pays"],
            "source": "sap",
        })

    inserted = 0
    for i in range(0, len(rows), BATCH_SIZE):
        chunk = rows[i:i + BATCH_SIZE]
        result, _ = api("POST", "entreprises", body=chunk,
                        extra_headers={"Prefer": "return=representation"})
        if result:
            for r in result:
                _ent_cache[r["numero_client"]] = r["id"]
                inserted += 1

    stats["entreprises_created"] = inserted
    _ent_create_queue.clear()
    print(f"  -> {inserted} entreprises created")


# ---------------------------------------------------------------------------
# Parse Excel files
# ---------------------------------------------------------------------------

def parse_offre_files():
    """Parse all offre Excel files and return list of dicts."""
    files = [
        PROJECT_ROOT / "docs/nouveaux docs/EXPORT OFFRES 2022 AVEC MONTANT.XLSX",
        PROJECT_ROOT / "docs/nouveaux docs/EXPORT OFFRES AVEC MONTANT 2026.XLSX",
    ]
    all_rows = []
    seen_refs = set()

    for filepath in files:
        print(f"  Reading {filepath.name}...")
        wb = openpyxl.load_workbook(filepath, read_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(min_row=2, values_only=True))
        print(f"    {len(rows)} data rows")

        for row in rows:
            if len(row) < 12:
                continue
            ref = str(row[6]).strip() if row[6] else None
            if not ref:
                stats["offres_skipped_no_ref"] += 1
                continue
            if ref in seen_refs:
                stats["offres_skipped_dup"] += 1
                continue
            seen_refs.add(ref)

            valeur = to_float(row[7])
            if valeur:
                stats["total_montant_sap_offres"] += valeur

            all_rows.append({
                "ref": ref,
                "donneur_ordre": str(row[0]).strip() if row[0] else None,
                "nom1": str(row[1]).strip() if row[1] else None,
                "pays": str(row[2]).strip() if row[2] else None,
                "date_doc": to_date_str(row[4]),
                "valeur_nette": valeur,
                "cree_par": str(row[9]).strip() if row[9] else None,
                "fin_validite": to_date_str(row[10]),
                "statut_sap": str(row[11]).strip() if row[11] else None,
            })

        wb.close()

    print(f"  Total offre rows parsed: {len(all_rows)}")
    return all_rows


def parse_cde_files():
    """Parse all commande Excel files and return list of dicts."""
    files = [
        (PROJECT_ROOT / "docs/nouveaux docs/EXPORT CDE AVEC MONTANT.XLSX", "standard"),
        (PROJECT_ROOT / "docs/nouveaux docs/EXPORT CDE 2026 AVEC MONTANT.XLSX", "2026"),
    ]
    all_rows = []
    seen_refs = set()

    for filepath, variant in files:
        print(f"  Reading {filepath.name} (variant={variant})...")
        wb = openpyxl.load_workbook(filepath, read_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(min_row=2, values_only=True))
        print(f"    {len(rows)} data rows")

        for row in rows:
            if len(row) < 9:
                continue

            if variant == "standard":
                donneur = str(row[0]).strip() if row[0] else None
                ref = str(row[1]).strip() if row[1] else None
                date_doc = to_date_str(row[3])
                type_dv = str(row[4]).strip() if row[4] else None
                cree_par = str(row[5]).strip() if row[5] else None
                valeur = to_float(row[6])
                statut_sap = str(row[8]).strip() if row[8] else None
            else:
                ref = str(row[0]).strip() if row[0] else None
                date_doc = to_date_str(row[2])
                type_dv = str(row[3]).strip() if row[3] else None
                cree_par = str(row[4]).strip() if row[4] else None
                donneur = str(row[5]).strip() if row[5] else None
                valeur = to_float(row[6])
                statut_sap = str(row[8]).strip() if row[8] else None

            if not ref:
                stats["commandes_skipped_no_ref"] += 1
                continue
            if ref in seen_refs:
                stats["commandes_skipped_dup"] += 1
                continue
            seen_refs.add(ref)

            if valeur:
                stats["total_montant_sap_commandes"] += valeur

            all_rows.append({
                "ref": ref,
                "donneur_ordre": donneur,
                "date_doc": date_doc,
                "type_document_vente": type_dv,
                "cree_par": cree_par,
                "valeur_nette": valeur,
                "statut_sap": statut_sap,
            })

        wb.close()

    print(f"  Total commande rows parsed: {len(all_rows)}")
    return all_rows


# ---------------------------------------------------------------------------
# Import offres
# ---------------------------------------------------------------------------

def import_offres(sap_rows, existing):
    print(f"\n=== IMPORT OFFRES ({len(sap_rows)} SAP rows, {len(existing)} existing) ===")

    updates = {}   # ref -> patch body
    inserts = []   # list of insert bodies

    for i, r in enumerate(sap_rows):
        ref = r["ref"]
        ex = existing.get(ref)

        if ex:
            stats["offres_matched"] += 1
            body = {
                "montant_sap": r["valeur_nette"],
                "statut_sap": r["statut_sap"],
                "cree_par": r["cree_par"],
                "donneur_ordre": r["donneur_ordre"],
                "source": "sap+ocr",
                "imported_at": NOW,
            }
            if ex["montant_ht"] is None and r["valeur_nette"] is not None:
                body["montant_ht"] = r["valeur_nette"]
                stats["offres_montant_backfilled"] += 1
            updates[ref] = body
        else:
            # Queue entreprise if needed
            resolve_entreprise(r["donneur_ordre"], r.get("nom1"), r.get("pays"))

            statut = "en_attente"
            if r["fin_validite"] and r["fin_validite"] < TODAY:
                statut = "expiree"

            inserts.append({
                "_donneur_ordre_key": r["donneur_ordre"],  # temp key for entreprise resolution
                "reference_offre": ref,
                "montant_sap": r["valeur_nette"],
                "montant_ht": r["valeur_nette"],
                "statut_sap": r["statut_sap"],
                "cree_par": r["cree_par"],
                "donneur_ordre": r["donneur_ordre"],
                "date_offre": r["date_doc"],
                "date_expiration": r["fin_validite"],
                "source": "sap",
                "imported_at": NOW,
                "statut": statut,
            })

        if (i + 1) % 500 == 0:
            print(f"  Classified {i + 1}/{len(sap_rows)} (updates={len(updates)}, inserts={len(inserts)})")

    print(f"  Classification done: {len(updates)} updates, {len(inserts)} inserts")

    # Flush entreprise queue before inserts
    flush_entreprise_queue()

    # Resolve entreprise_id for inserts
    for row in inserts:
        do = row.pop("_donneur_ordre_key", None)
        if do:
            do_str = str(do).strip()
            row["entreprise_id"] = _ent_cache.get(do_str)
        if row.get("montant_ht") is not None:
            stats["offres_montant_backfilled"] += 1

    # Execute updates
    print(f"  Patching {len(updates)} existing offres...")
    done = 0
    total = len(updates)
    for ref, body in updates.items():
        safe = urllib.parse.quote(ref, safe="")
        api("PATCH", f"offres?reference_offre=eq.{safe}", body=body,
            extra_headers={"Prefer": "return=minimal"})
        done += 1
        stats["offres_updated"] += 1
        if done % 500 == 0:
            print(f"    Updated {done}/{total}")
    print(f"    Updated {done}/{total}")

    # Execute inserts
    if inserts:
        print(f"  Inserting {len(inserts)} new offres...")
        inserted = batch_insert("offres", inserts)
        stats["offres_inserted"] = inserted
        print(f"    Inserted {inserted}")


# ---------------------------------------------------------------------------
# Import commandes
# ---------------------------------------------------------------------------

def import_commandes(sap_rows, existing):
    print(f"\n=== IMPORT COMMANDES ({len(sap_rows)} SAP rows, {len(existing)} existing) ===")

    updates = {}
    inserts = []

    for i, r in enumerate(sap_rows):
        ref = r["ref"]
        ex = existing.get(ref)

        if ex:
            stats["commandes_matched"] += 1
            body = {
                "montant_sap": r["valeur_nette"],
                "statut_sap": r["statut_sap"],
                "cree_par": r["cree_par"],
                "donneur_ordre": r["donneur_ordre"],
                "type_document_vente": r["type_document_vente"],
                "source": "sap+ocr",
                "imported_at": NOW,
            }
            if ex["montant_ht"] is None and r["valeur_nette"] is not None:
                body["montant_ht"] = r["valeur_nette"]
                stats["commandes_montant_backfilled"] += 1
            updates[ref] = body
        else:
            resolve_entreprise(r["donneur_ordre"])
            inserts.append({
                "_donneur_ordre_key": r["donneur_ordre"],
                "reference_commande": ref,
                "montant_sap": r["valeur_nette"],
                "montant_ht": r["valeur_nette"],
                "statut_sap": r["statut_sap"],
                "cree_par": r["cree_par"],
                "donneur_ordre": r["donneur_ordre"],
                "type_document_vente": r["type_document_vente"],
                "date_commande": r["date_doc"],
                "type": "directe",
                "source": "sap",
                "imported_at": NOW,
            })

        if (i + 1) % 500 == 0:
            print(f"  Classified {i + 1}/{len(sap_rows)} (updates={len(updates)}, inserts={len(inserts)})")

    print(f"  Classification done: {len(updates)} updates, {len(inserts)} inserts")

    flush_entreprise_queue()

    for row in inserts:
        do = row.pop("_donneur_ordre_key", None)
        if do:
            do_str = str(do).strip()
            row["entreprise_id"] = _ent_cache.get(do_str)
        if row.get("montant_ht") is not None:
            stats["commandes_montant_backfilled"] += 1

    # Execute updates
    print(f"  Patching {len(updates)} existing commandes...")
    done = 0
    total = len(updates)
    for ref, body in updates.items():
        safe = urllib.parse.quote(ref, safe="")
        api("PATCH", f"commandes?reference_commande=eq.{safe}", body=body,
            extra_headers={"Prefer": "return=minimal"})
        done += 1
        stats["commandes_updated"] += 1
        if done % 500 == 0:
            print(f"    Updated {done}/{total}")
    print(f"    Updated {done}/{total}")

    if inserts:
        print(f"  Inserting {len(inserts)} new commandes...")
        inserted = batch_insert("commandes", inserts)
        stats["commandes_inserted"] = inserted
        print(f"    Inserted {inserted}")


# ---------------------------------------------------------------------------
# Verification & Summary
# ---------------------------------------------------------------------------

def verify():
    print("\n=== VERIFICATION (DB counts) ===")
    print(f"  Offres with montant_sap NOT NULL:    {count_where('offres', 'montant_sap=not.is.null')}")
    print(f"  Commandes with montant_sap NOT NULL:  {count_where('commandes', 'montant_sap=not.is.null')}")
    print(f"  Offres with montant_ht NOT NULL:      {count_where('offres', 'montant_ht=not.is.null')}")
    print(f"  Commandes with montant_ht NOT NULL:   {count_where('commandes', 'montant_ht=not.is.null')}")
    print(f"  Total entreprises:                    {count_where('entreprises', 'id=not.is.null')}")
    print(f"  Entreprises source=sap:               {count_where('entreprises', 'source=eq.sap')}")


def print_summary():
    print("\n" + "=" * 60)
    print("           IMPORT SAP — SUMMARY")
    print("=" * 60)
    print(f"{'Metric':<45} {'Value':>12}")
    print("-" * 60)
    print(f"{'Offres matched (existing in DB)':<45} {stats['offres_matched']:>12}")
    print(f"{'Offres updated':<45} {stats['offres_updated']:>12}")
    print(f"{'Offres inserted (new)':<45} {stats['offres_inserted']:>12}")
    print(f"{'Offres montant_ht backfilled':<45} {stats['offres_montant_backfilled']:>12}")
    print(f"{'Offres skipped (no ref / dup)':<45} {stats['offres_skipped_no_ref']:>5} / {stats['offres_skipped_dup']}")
    print(f"{'Total montant_sap offres (EUR)':<45} {stats['total_montant_sap_offres']:>12,.2f}")
    print("-" * 60)
    print(f"{'Commandes matched (existing in DB)':<45} {stats['commandes_matched']:>12}")
    print(f"{'Commandes updated':<45} {stats['commandes_updated']:>12}")
    print(f"{'Commandes inserted (new)':<45} {stats['commandes_inserted']:>12}")
    print(f"{'Commandes montant_ht backfilled':<45} {stats['commandes_montant_backfilled']:>12}")
    print(f"{'Commandes skipped (no ref / dup)':<45} {stats['commandes_skipped_no_ref']:>5} / {stats['commandes_skipped_dup']}")
    print(f"{'Total montant_sap commandes (EUR)':<45} {stats['total_montant_sap_commandes']:>12,.2f}")
    print("-" * 60)
    print(f"{'New entreprises created':<45} {stats['entreprises_created']:>12}")
    print(f"{'Errors':<45} {stats['errors']:>12}")
    print("=" * 60)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    start = time.time()
    print("=" * 60)
    print("  SAP Data Import — ThermoPack Industries")
    print("=" * 60)
    print(f"  Supabase: {SUPABASE_URL}")
    print(f"  Date: {TODAY}")

    # Phase 1: Load existing data
    print("\n--- Phase 1: Pre-loading existing data ---")
    global _ent_cache
    _ent_cache = load_entreprise_cache()
    existing_offres = load_existing_offres()
    existing_commandes = load_existing_commandes()

    # Phase 2: Parse Excel files
    print("\n--- Phase 2: Parsing Excel files ---")
    offre_rows = parse_offre_files()
    cde_rows = parse_cde_files()

    # Phase 3: Import
    print("\n--- Phase 3: Importing data ---")
    import_offres(offre_rows, existing_offres)
    import_commandes(cde_rows, existing_commandes)

    # Phase 4: Verify
    print("\n--- Phase 4: Verification ---")
    verify()

    print_summary()

    elapsed = time.time() - start
    print(f"\nDone in {elapsed:.1f}s")


if __name__ == "__main__":
    main()
