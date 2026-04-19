---
name: supabase-cli
description: "Manage ThermoPack Industries Supabase project — query tables, run SQL, manage migrations, deploy functions, storage ops. Use when user mentions 'supabase', 'db', 'tables', 'query', 'migration', 'edge function', 'storage', or wants to interact with the project database."
category: devtools
---

# supabase-cli — ThermoPack Industries

Project-scoped Supabase CLI for the ThermoPack Industries project.

## Configuration

All commands use the project ref from `.env`:
- **Project ID**: `$SUPABASE_PROJECT_ID` ({ANON_SUPABASE_REF})
- **Access Token**: `$SUPABASE_ACCESS_TOKEN` (for Management API)
- **Service Role Key**: `$SUPABASE_SERVICE_ROLE_KEY` (for PostgREST data access)

### First-time setup

```bash
# Login with the access token from .env
supabase login --token "$SUPABASE_ACCESS_TOKEN"

# Link this project directory
cd ~/projects/thermopack-demo
supabase link --project-ref "$SUPABASE_PROJECT_ID"
```

## Quick Data Access (PostgREST)

For direct table queries, use curl with the service role key:

```bash
# List all offers
curl -s "$SUPABASE_URL/rest/v1/offers?select=*&limit=10" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | jq .

# List all orders
curl -s "$SUPABASE_URL/rest/v1/orders?select=*&limit=10" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | jq .

# Count offers by status
curl -s "$SUPABASE_URL/rest/v1/offers?select=status,count" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Prefer: count=exact" | jq .

# Insert a record
curl -s "$SUPABASE_URL/rest/v1/offers" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"field": "value"}' | jq .
```

### PostgREST Query Operators

| Operator | Example | Description |
|----------|---------|-------------|
| `eq` | `?status=eq.pending` | Equal |
| `neq` | `?status=neq.closed` | Not equal |
| `gt/lt` | `?amount=gt.1000` | Greater/less than |
| `gte/lte` | `?created_at=gte.2026-01-01` | Greater/less or equal |
| `like` | `?client_name=like.*ThermoPack*` | Pattern match |
| `ilike` | `?client_name=ilike.*thermopack*` | Case-insensitive pattern |
| `in` | `?status=in.(pending,sent)` | In list |
| `order` | `?order=created_at.desc` | Order results |
| `limit` | `?limit=20` | Limit results |
| `offset` | `?offset=10` | Skip results |

## Database Management

```bash
# Run arbitrary SQL on remote
supabase db execute --project-ref "$SUPABASE_PROJECT_ID" "SELECT * FROM offers LIMIT 5;"

# Pull remote schema changes
supabase db pull --project-ref "$SUPABASE_PROJECT_ID"

# Push local migrations to remote
supabase db push --project-ref "$SUPABASE_PROJECT_ID"

# Diff local vs remote
supabase db diff --project-ref "$SUPABASE_PROJECT_ID" --schema public

# Lint database
supabase db lint --project-ref "$SUPABASE_PROJECT_ID"
```

## Migrations

```bash
# Create new migration
supabase migration new <name>

# List migration status
supabase migration list --project-ref "$SUPABASE_PROJECT_ID"

# Repair migration status
supabase migration repair --status applied <version> --project-ref "$SUPABASE_PROJECT_ID"
```

## Edge Functions

```bash
# List deployed functions
supabase functions list --project-ref "$SUPABASE_PROJECT_ID"

# Create new function
supabase functions new <name>

# Deploy function
supabase functions deploy <name> --project-ref "$SUPABASE_PROJECT_ID"

# Delete function
supabase functions delete <name> --project-ref "$SUPABASE_PROJECT_ID"
```

## Storage

```bash
# List buckets
supabase storage ls --project-ref "$SUPABASE_PROJECT_ID"

# List objects in bucket
supabase storage ls s3://<bucket> --project-ref "$SUPABASE_PROJECT_ID"

# Upload file
supabase storage cp <local-file> s3://<bucket>/<path> --project-ref "$SUPABASE_PROJECT_ID"

# Download file
supabase storage cp s3://<bucket>/<path> <local-file> --project-ref "$SUPABASE_PROJECT_ID"

# Remove file
supabase storage rm s3://<bucket>/<path> --project-ref "$SUPABASE_PROJECT_ID"
```

## Secrets

```bash
# List secrets
supabase secrets list --project-ref "$SUPABASE_PROJECT_ID"

# Set secret
supabase secrets set KEY=value --project-ref "$SUPABASE_PROJECT_ID"

# Remove secret
supabase secrets unset KEY --project-ref "$SUPABASE_PROJECT_ID"
```

## Type Generation

```bash
# Generate TypeScript types from remote schema
supabase gen types typescript --project-id "$SUPABASE_PROJECT_ID" > types/supabase.ts
```

## Global Flags

| Flag | Description |
|------|-------------|
| `--output json` | JSON output (use for programmatic access) |
| `--project-ref <ref>` | Target project (use `$SUPABASE_PROJECT_ID`) |
| `--debug` | Debug output |

## Environment Variables

All secrets are in `~/projects/thermopack-demo/.env`:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Project API URL |
| `SUPABASE_ANON_KEY` | Public anon key (RLS-restricted) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) |
| `SUPABASE_DB_PASSWORD` | Direct Postgres password |
| `SUPABASE_PROJECT_ID` | Project reference ID |
| `SUPABASE_ACCESS_TOKEN` | Management API token |

### Loading env vars in shell

```bash
source ~/projects/thermopack-demo/.env 2>/dev/null || export $(grep -v '^#' ~/projects/thermopack-demo/.env | xargs)
```
