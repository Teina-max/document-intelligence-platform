# n8n Workflow Rules

## No environment variables

n8n plan does NOT support environment variables. NEVER use `$vars`, `$env`, or any environment variable reference in n8n workflows.

## Credentials only

All secrets, API keys, and configuration values MUST be stored as n8n credentials, not environment variables.

## Static values

For non-secret constants (IBAN, BIC, phone number, address), hardcode them directly in the workflow nodes (Set node or Code node). These are not secrets — they belong in the workflow logic.
