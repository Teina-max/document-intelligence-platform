#!/usr/bin/env bash
# Scan the portfolio for residual identifying data before any git push.
# Exit code 0 = clean. Non-zero = leaks found.
#
# Only scans files TRACKED by git (respects .gitignore) since the goal
# is to catch what would be pushed to a public remote. Use `git grep`
# under the hood.
#
# Usage: bash scripts/verify-anonymization.sh

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -d .git ]; then
  echo "ERROR: .git missing — run 'git init' first." >&2
  exit 2
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

fail=0

# These tracked files intentionally contain some sensitive patterns and
# must be exempt from the scan.
EXEMPT_PATHSPEC=(
  ":!scripts/verify-anonymization.sh"
)

check_regex() {
  local label="$1"
  local pattern="$2"
  local flags="${3:-}"
  local matches
  if [ "$flags" = "i" ]; then
    matches=$(git grep -InEi "$pattern" -- "${EXEMPT_PATHSPEC[@]}" 2>/dev/null || true)
  else
    matches=$(git grep -InE "$pattern" -- "${EXEMPT_PATHSPEC[@]}" 2>/dev/null || true)
  fi
  if [ -n "$matches" ]; then
    echo -e "${RED}LEAK (${label})${NC}"
    echo "$matches" | head -20
    local count
    count=$(echo "$matches" | wc -l)
    if [ "$count" -gt 20 ]; then
      echo "... ($count total matches, showing first 20)"
    fi
    echo ""
    fail=1
  else
    echo -e "${GREEN}OK${NC}    ${label}"
  fi
}

check_no_file() {
  local label="$1"
  local glob="$2"
  local found
  found=$(git ls-files -- "$glob" 2>/dev/null || true)
  if [ -n "$found" ]; then
    echo -e "${RED}LEAK (${label}, file tracked)${NC}"
    echo "$found" | head -10
    echo ""
    fail=1
  else
    echo -e "${GREEN}OK${NC}    ${label}"
  fi
}

echo "=== Verifying anonymization in: $ROOT ==="
echo ""

# 1. Company identifiers
check_regex "ILLIG brand"               '\bILLIG\b'
check_regex "illig lowercase"           '\billig\b'
check_regex "illig.com domain"          'illig\.com'
check_regex "illigfrance vercel"        'illigfrance'
check_regex "LDG partner"               '\bLDG\b'
check_regex "ldg-automation domain"     'ldg-automation'

# 2. Persons
check_regex "Maraval surname"           '\bMaraval\b' i
check_regex "Alicia firstname"          '\bAlicia\b' i
check_regex "Geraldine firstname"       '\bG[eé]raldine\b' i
check_regex "Younes firstname"          '\bYounes\b' i
check_regex "Balla firstname"           '\bBalla\b' i
check_regex "Host /home/username path"  '/home/[a-z][a-z0-9_-]+'
check_regex "thermopack .fr (should be .example)" 'thermopack\.fr'

# 3. Supabase prod ref
check_regex "Supabase prod ref"         'vgddvvulobqwstqeqsfs'

# 4. Vercel prod IDs
check_regex "Vercel project id 1"       'prj_aBAf5hNDFwImR0fNNsfvB9GRcvmi'
check_regex "Vercel project id 2"       'prj_scGneDscOHYZbjuoCgrXwp0DURWB'
check_regex "Vercel org id"             'team_hoa1KWLrdZWxxo4f80YuZO5S'

# 5. n8n credential ids / names
check_regex "Supabase-Illig cred"       'Supabase-Illig'
check_regex "Claude-Teina cred"         'Claude-Teina'
check_regex "n8n cred id 1"             'lTafEteetiY44n0e'
check_regex "n8n cred id 2"             '1OPCyfWGXt0KoiCx'
check_regex "n8n cred id 3"             'kNllyLMnETXVd4ka'
check_regex "n8n cred id 4"             'saOBxc26GCj5dgq4'

# 6. Real client company names (selection — extend as more are discovered)
check_regex "Client DYNAPLAST"          '\bDYNAPLAST\b'
check_regex "Client FAERCH"             '\bFAERCH\b'
check_regex "Client AGROLIS"            '\bAGROLIS\b'
check_regex "Client BBC PACKAGING"      'BBC PACKAGING'
check_regex "Client POLYDRUCK"          '\bPOLYDRUCK\b'
check_regex "Client MARTINIQUAISE"      'MARTI?NIQUAISE'
check_regex "Client SOMATER"            '\bSOMATER\b'
check_regex "Client NOSSAM"             '\bNOSSAM\b'
check_regex "Client CTCI"               '\bCTCI\b'
check_regex "Client ERMAX"              '\bERMAX\b'
check_regex "Client TOUTHERM"           '\bTOUTHERM\b'
check_regex "Client GEORG UTZ"          'GEORG UTZ'
check_regex "Client PICARD"             '\bPICARD\b'
check_regex "Client ARPLAST"            '\bARPLAST\b'
check_regex "Client GUILLIN"            '\bGUILLIN\b'
check_regex "Client ELVIR"              '\bELVIR\b'
check_regex "Client ALPHAFORM"          '\bALPHAFORM\b'
check_regex "Client COLART"             '\bCOLART\b'
check_regex "Client KONDICONCEPT"       '\bKONDICONCEPT\b'
check_regex "Client FROMAGERIES BEL"    'FROMAGERIES BEL'
check_regex "Client TERMOFORMADOS"      '\bTERMOFORMADOS\b'
check_regex "Client BRETEAU corresp"    '\bBRETEAU\b'

# 7. API key / token patterns (prevent accidental secret commits)
check_regex "JWT header (Supabase/etc)"     'eyJhbGciOiJIUzI1NiIs'
check_regex "Anthropic API key"              'sk-ant-api[0-9]+-'
check_regex "OpenAI-style sk key"            'sk-or-v1-[a-z0-9]+'
check_regex "Supabase access token (sbp_)"   'sbp_[a-z0-9]{20,}'
check_regex "Supabase publishable key"       'sb_publishable_[A-Za-z0-9_-]{20,}'
check_regex "Supabase secret key"            'sb_secret_[A-Za-z0-9_-]{20,}'

# 8. Forbidden file types
check_no_file "No .env tracked"         '.env'
check_no_file "No .env.local tracked"   '*.env.local'
check_no_file "No Excel clients"        '*.xlsx'
check_no_file "No Excel clients (XLSX)" '*.XLSX'

echo ""
if [ "$fail" -eq 0 ]; then
  echo -e "${GREEN}=== ALL CHECKS PASSED ===${NC}"
  exit 0
else
  echo -e "${RED}=== LEAKS DETECTED — fix before commit/push ===${NC}"
  exit 1
fi
