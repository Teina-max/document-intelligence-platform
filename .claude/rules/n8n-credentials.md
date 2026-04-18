# n8n Credentials — ThermoPack Industries

## Mandatory credential names

When creating or modifying n8n workflows for this project, you MUST reference credentials by their EXACT registered names below. This ensures workflows deploy correctly without manual reconfiguration.

## Credentials

| Name in n8n | Type | ID | Usage |
|---|---|---|---|
| `Supabase-ThermoPack` | supabaseApi | {ANON_SUPABASE_CRED_ID} | Supabase nodes (base URL + service key) |
| `Claude-API` | httpHeaderAuth | {ANON_CLAUDE_CRED_ID} | HTTP Request nodes vers Claude API (OCR, parsing) |

## Note

Il y a 2 credentials `Supabase-ThermoPack` sur n8n (IDs: `{ANON_SUPABASE_CRED_ID}` et `{ANON_SUPABASE_CRED_ID}`). Utiliser l'ID `{ANON_SUPABASE_CRED_ID}` (le plus recent).

## How to use in workflow JSON

In node credentials, always use the exact name and ID:
```json
"credentials": {
  "supabaseApi": {
    "id": "{ANON_SUPABASE_CRED_ID}",
    "name": "Supabase-ThermoPack"
  }
}
```

```json
"credentials": {
  "httpHeaderAuth": {
    "id": "{ANON_CLAUDE_CRED_ID}",
    "name": "Claude-API"
  }
}
```
