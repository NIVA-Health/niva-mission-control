# Deploying NIVA Mission Control to Cloud Run

Target setup:

- **Cloud Run** (containerized, scales to zero)
- **Identity-Aware Proxy (IAP)** so only NIVA Google accounts can load it
- **Secret Manager** for the Trello token
- **Cloud Build** trigger for auto-deploy on push to `main`

Nothing in this repo contains credentials. The Trello key, board id, and token are
configured on the Cloud Run service; `cloudbuild.yaml` only ships new images.

---

## 0. Prerequisites

- `gcloud` CLI installed and logged in (`gcloud auth login`)
- A GCP project with billing enabled
- Project IAM: Owner or (Editor + Security Admin) to configure IAP

Set your working variables (PowerShell):

```powershell
$PROJECT_ID = "niva-hr-database"
$REGION     = "us-central1"
$SERVICE    = "niva-mission-control"
$REPO       = "niva"

gcloud config set project $PROJECT_ID
```

---

## 1. Enable APIs

```powershell
gcloud services enable `
  run.googleapis.com `
  cloudbuild.googleapis.com `
  artifactregistry.googleapis.com `
  secretmanager.googleapis.com `
  iap.googleapis.com
```

## 2. Create the Artifact Registry repo

```powershell
gcloud artifacts repositories create $REPO `
  --repository-format=docker `
  --location=$REGION `
  --description="NIVA container images"
```

## 3. Store the Trello token in Secret Manager

Keeps the token out of the repo, out of build logs, and out of shell history.

```powershell
$token = Read-Host "Paste your Trello token"
Set-Content -Path .\token.tmp -Value $token -NoNewline -Encoding ascii
gcloud secrets create trello-token --data-file=.\token.tmp
Remove-Item .\token.tmp
```

To rotate the token later:

```powershell
$token = Read-Host "Paste new Trello token"
Set-Content -Path .\token.tmp -Value $token -NoNewline -Encoding ascii
gcloud secrets versions add trello-token --data-file=.\token.tmp
Remove-Item .\token.tmp
```

## 4. Create a dedicated runtime service account

Least privilege: this identity runs the container and may read only that one secret.

```powershell
gcloud iam service-accounts create niva-mission-control-run `
  --display-name="NIVA Mission Control runtime"

$RUN_SA = "niva-mission-control-run@$PROJECT_ID.iam.gserviceaccount.com"

gcloud secrets add-iam-policy-binding trello-token `
  --member="serviceAccount:$RUN_SA" `
  --role="roles/secretmanager.secretAccessor"
```

## 5. First deploy

Builds from the `Dockerfile` and sets runtime config. Run from the repo root.

```powershell
gcloud run deploy $SERVICE `
  --source . `
  --region $REGION `
  --service-account $RUN_SA `
  --no-allow-unauthenticated `
  --set-env-vars "DATA_SOURCE=trello,TRELLO_API_KEY=3d853d38f81ae34e9ac492277d91f791,TRELLO_BOARD_ID=6908c4016b6ae0493ff5b5d6,DATA_REVALIDATE_SECONDS=60" `
  --set-secrets "TRELLO_TOKEN=trello-token:latest" `
  --memory 512Mi `
  --min-instances 0 `
  --max-instances 5
```

Notes:

- `--no-allow-unauthenticated` means the service is closed until IAP is configured in step 6. That is intentional — do not switch it to `--allow-unauthenticated`.
- `--min-instances 0` (chosen) costs nothing at idle, at the price of a ~2-4s cold start on the first request after a quiet period. Flip to `--min-instances 1` later with a single `gcloud run services update` if the lag becomes annoying.

## 6. Lock it to NIVA accounts with IAP

IAP now runs directly on Cloud Run — no load balancer required.

**In the Cloud Console** (this is a click-path, and the fastest way):

1. Cloud Run → `niva-mission-control` → **Security** tab
2. Ingress: **All** ; Authentication: **Require authentication** → **Identity-Aware Proxy (IAP)**
3. Enable IAP. Accept the prompt to grant IAP the invoker role on the service.
4. Under **IAP → Principals**, add who may access, with role **IAP-secured Web App User**:
   - Principal: **`domain:nivahealth.com`** — the whole Workspace domain (this is the chosen setup)
   - If you later want tighter control, swap this for a group such as `group:leadership@nivahealth.com`

By default IAP uses a Google-managed OAuth client and only allows identities inside
your organization, which is exactly the posture we want here.

> The equivalent `gcloud` commands exist (`gcloud beta run services update ... --iap`
> and `gcloud beta iap web add-iam-policy-binding`), but this surface changed recently —
> verify flags against the current docs if you script it rather than using the Console.

Test: open the service URL in a browser. You should be forced through Google sign-in,
and an account outside the org should be denied.

## 7. Auto-deploy from GitHub

**In the Cloud Console:** Cloud Build → **Triggers** → **Connect Repository** →
GitHub → authorize → select `joshahirsch/niva-mission-control` → **Create trigger**:

- Event: **Push to a branch**
- Branch: `^main$`
- Configuration: **Cloud Build configuration file** → `/cloudbuild.yaml`

Then grant the build service account permission to deploy:

```powershell
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
$CB_SA = "$PROJECT_NUMBER@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:$CB_SA" --role="roles/run.admin"

gcloud artifacts repositories add-iam-policy-binding $REPO --location=$REGION `
  --member="serviceAccount:$CB_SA" --role="roles/artifactregistry.writer"

gcloud iam service-accounts add-iam-policy-binding $RUN_SA `
  --member="serviceAccount:$CB_SA" --role="roles/iam.serviceAccountUser"
```

> Depending on when the project was created, your trigger may run as the Compute
> Engine default service account rather than the legacy Cloud Build one. Check the
> trigger's **Service account** field and grant the roles above to whichever it uses.

Because `cloudbuild.yaml` does not pass `--set-env-vars` or `--set-secrets`,
each deploy **preserves** the configuration set in step 5. Change config with a
`gcloud run services update`, not by editing the repo.

---

## Operations

**Logs**

```powershell
gcloud run services logs read $SERVICE --region $REGION --limit 100
```

**Change the data refresh window** (how stale the dashboard can be):

```powershell
gcloud run services update $SERVICE --region $REGION `
  --update-env-vars DATA_REVALIDATE_SECONDS=30
```

**Roll back**

```powershell
gcloud run revisions list --service $SERVICE --region $REGION
gcloud run services update-traffic $SERVICE --region $REGION --to-revisions REVISION_NAME=100
```

---

## Next phase: true real-time

Today the dashboard re-reads Trello every `DATA_REVALIDATE_SECONDS` (default 60).
Once this is deployed you have a public HTTPS endpoint, which unlocks **Trello
webhooks** — Trello POSTs to the app the moment a card moves, instead of polling.

That requires:

1. A `POST /api/trello/webhook` route (plus `HEAD` support — Trello pings it to validate).
2. Registering the webhook against the board with the Trello API.
3. Cache invalidation on receipt (`revalidateTag`) so the next read is fresh.
4. An IAP exception for that one path, since Trello can't authenticate through IAP.

Item 4 is the important design detail: the webhook endpoint must be reachable by
Trello while the rest of the app stays locked down. Verify the webhook signature
so only genuine Trello calls are honored.
