# Deploying the Mission Control read-only API (future)

This document describes a **separate** Cloud Run service for the versioned
bearer-token API. It is documentation only — this stage does not deploy,
create secrets, or change Google Cloud resources.

Google Docs, Google Drive, and Cloud Scheduler are **not** part of this phase.
They are planned downstream consumers of `GET /api/v1/weekly-report`, not
implemented here.

## Relationship to the existing app

| Service | Purpose | Auth |
|---|---|---|
| `niva-mission-control` | Existing Mission Control UI + internal APIs | **IAP-protected** (unchanged) |
| `niva-mission-control-api` | Read-only `GET /api/v1/delivery` and `GET /api/v1/weekly-report` | Bearer token (`MISSION_CONTROL_API_TOKEN`) |

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

## Endpoints

### Delivery portfolio (JSON)

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

### Weekly report (Markdown)

```
GET /api/v1/weekly-report
Authorization: Bearer <token>
```

Optional deterministic timestamp (testing / operator verification):

```
GET /api/v1/weekly-report?asOf=2026-07-19T22:00:00-04:00
Authorization: Bearer <token>
```

| Aspect | Behavior |
|---|---|
| Auth | Same bearer token as delivery (`MISSION_CONTROL_API_TOKEN`, min 32 UTF-8 bytes) |
| Success | `200` with `Content-Type: text/markdown; charset=utf-8` |
| Caching | `Cache-Control: no-store` |
| Filename | `Content-Disposition: attachment; filename="niva-weekly-status-YYYY-MM-DD.md"` using the America/New_York calendar date of `asOf` (or now) |
| Body | Same Markdown generator as the dashboard **Weekly report** button |
| Week window | Monday 12:00:00 AM America/New_York through `asOf` |
| `asOf` | Optional calendar-valid ISO-8601 datetime with explicit `Z` or numeric UTC offset (e.g. `2026-07-19T22:00:00Z`). Date-only, timezone-naive, and impossible calendar dates (e.g. `2026-02-30T12:00:00Z`) are rejected with `400`. Invalid values are not replaced with “now”. |
| Errors | `401` unauthorized · `400` invalid `asOf` · `500` misconfigured token · `502` upstream failure (sanitized bodies) |

API-only mode (`MISSION_CONTROL_API_ONLY=true`) allows **only**:

- `/api/v1/delivery`
- `/api/v1/weekly-report`

All other paths return plain `404`.

#### Example (PowerShell)

```powershell
$token = $env:MISSION_CONTROL_API_TOKEN
Invoke-RestMethod `
  -Uri "https://niva-mission-control-api.example.run.app/api/v1/weekly-report" `
  -Headers @{ Authorization = "Bearer $token" } `
  -OutFile "niva-weekly-status.md"
```

With a fixed `asOf`:

```powershell
Invoke-RestMethod `
  -Uri "https://niva-mission-control-api.example.run.app/api/v1/weekly-report?asOf=2026-07-19T22:00:00-04:00" `
  -Headers @{ Authorization = "Bearer $token" } `
  -OutFile "niva-weekly-status.md"
```

#### Example (curl)

```bash
curl -fsS \
  -H "Authorization: Bearer ${MISSION_CONTROL_API_TOKEN}" \
  -o niva-weekly-status.md \
  "https://niva-mission-control-api.example.run.app/api/v1/weekly-report"
```

With a fixed `asOf`:

```bash
curl -fsS \
  -H "Authorization: Bearer ${MISSION_CONTROL_API_TOKEN}" \
  -o niva-weekly-status.md \
  "https://niva-mission-control-api.example.run.app/api/v1/weekly-report?asOf=2026-07-19T22:00:00-04:00"
```

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
- Creating Google Docs or Google Drive files
- Cloud Scheduler / Sunday automation wiring
- MCP server or ChatGPT connector configuration
- Chart generation
- Rate limiting
- Write / Trello-mutation APIs
