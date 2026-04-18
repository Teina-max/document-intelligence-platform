#!/bin/bash
# Batch ingest all PDFs via WF-001 webhook
# Usage: ./scripts/batch-ingest-pdfs.sh [delay_seconds]

WEBHOOK_URL="https://n8n.example.com/webhook/thermopack/ingest-pdf"
DOCS_DIR="/home/teina/projects/thermopack-demo/docs"
DELAY="${1:-12}"
MAX_RETRIES=2
RETRY_DELAY=30
TMPFILE=$(mktemp)

SUCCESS=0
FAIL=0
TOTAL=0

trap "rm -f $TMPFILE" EXIT

send_pdf() {
  local pdf="$1"
  local filename="$2"
  local storage_path="$3"
  local attempt=1

  # Build JSON payload in temp file to avoid argument length limit
  base64_content=$(base64 -w 0 "$pdf")
  printf '{"pdfBase64":"%s","fileName":"%s","storagePath":"%s","bucket":"pdfs"}' \
    "$base64_content" "$filename" "$storage_path" > "$TMPFILE"

  while [ "$attempt" -le "$((MAX_RETRIES + 1))" ]; do
    response=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d @"$TMPFILE" \
      --max-time 120)

    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
      echo "OK ($http_code)"
      return 0
    fi

    if [ "$attempt" -le "$MAX_RETRIES" ]; then
      echo -n "RETRY ($http_code, attempt $attempt/$MAX_RETRIES, waiting ${RETRY_DELAY}s) ... "
      sleep "$RETRY_DELAY"
    else
      echo "FAIL ($http_code) — $body"
      return 1
    fi

    attempt=$((attempt + 1))
  done
}

echo "=== ThermoPack Industries — Batch PDF Ingestion ==="
echo "Delay: ${DELAY}s | Max retries: $MAX_RETRIES | Retry delay: ${RETRY_DELAY}s"
echo ""

for category_dir in "commandes sans offres" "commandes transformer" "Offres non validés"; do
  dir="$DOCS_DIR/$category_dir"
  [ -d "$dir" ] || continue

  echo "--- $category_dir ---"

  for pdf in "$dir"/*.pdf; do
    [ -f "$pdf" ] || continue
    TOTAL=$((TOTAL + 1))

    filename=$(basename "$pdf")
    storage_path="$category_dir/$filename"

    echo -n "[$TOTAL] $filename ... "

    if send_pdf "$pdf" "$filename" "$storage_path"; then
      SUCCESS=$((SUCCESS + 1))
    else
      FAIL=$((FAIL + 1))
    fi

    sleep "$DELAY"
  done

  echo ""
done

echo "=== Resultat ==="
echo "Total: $TOTAL | OK: $SUCCESS | Echecs: $FAIL"
