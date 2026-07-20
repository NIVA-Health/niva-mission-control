# Deploying the Mission Control read-only API (future)

This document describes a **separate** Cloud Run service for the versioned
bearer-token API. It is documentation only — this stage does not deploy,
create secrets, or change Google Cloud resources.

## Relationship to the existing app

| Service | Purpose | Auth |
|---|---|---|
| `niva-mission-control` | Existing Mission Control UI + internal APIs | **IAP-protected** (unchanged) |
| `niva-mission-control-api` | Read-only `GET /api/v1/delivery` | Bearer token (`MISSION_CONTROL_API_TOKEN`) |

The existing **`niva-mission-control`** service remains IAP-protected. Do not
weaken, replace, or bypass IAP on that service.

The future **`niva-mission-control-api`** service may use Cloud Run’s
**unauthenticated transport** (`--allow-unauthenticated`) **only because** every
permitted application route requires a valid bearer token, and
`MISSION_CONTROL_API_ONLY=true` returns 404 for the dashboard, internal APIs
(`/api/projects`, `/api/programs`, hide/restore, etc.), and all other routes.

Arbitrary bearer API access from ChatGPT still requires a subsequent
MCP / custom connector layer. This API alone is not a ChatGPT connector.

## Required environment

Use placeholder values in source and docs — never commit real tokens.

```
MISSION_CONTROL_API_TOKEN=   # from Secret Manager
MISSION_CONTROL_API_ONLY=true
DATA_SOURCE=trello
# …same Trello / board env vars as the main service (via Secret Manager where appropriate)
```

Recommended Secret Manager secret name: **`mission-control-api-token`**

`MISSION_CONTROL_API_TOKEN` must be a **cryptographically random** secret of at
least **32 random bytes** (UTF-8). Generate with a CSPRNG (for example
`openssl rand -base64 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).
Shorter, empty, or whitespace-only values are rejected at runtime (fail closed
with sanitized `500`). Never commit or log the token.

Map it into the API service as `MISSION_CONTROL_API_TOKEN` (for example
`--set-secrets "MISSION_CONTROL_API_TOKEN=mission-control-api-token:latest"`).

## Endpoint

```
GET /api/v1/delivery
Authorization: Bearer <token>
```

- Success: JSON delivery portfolio (`schemaVersion` `1.0`)
- Missing / malformed / wrong credentials: sanitized `401` + `WWW-Authenticate: Bearer`
- Missing server token: fail closed with sanitized `500`
- Upstream data failure: sanitized `502`
- All responses: `Cache-Control: no-store`

Credentials are accepted only via the `Authorization` header — never query
parameters or cookies.

## Key rotation (high level)

1. Create a new secret version on `mission-control-api-token`.
2. Deploy / update `niva-mission-control-api` to pick up `:latest` (or pin the new version).
3. Update clients (MCP / connector) to the new token.
4. Disable or destroy the previous secret version after cutover.

## Rollback (high level)

1. Route traffic back to a previous Cloud Run revision of `niva-mission-control-api`, or
2. Point the secret binding at the prior secret version, then restart/redeploy the revision.

The IAP-protected `niva-mission-control` UI service is independent and is not
affected by API-service rollback.

## Out of scope for this stage

- Deploying either service
- Creating or rotating secrets in Google Cloud
- MCP server or ChatGPT connector configuration
- Rate limiting
- Write / Trello-mutation APIs
