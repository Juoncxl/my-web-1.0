# CXL API-only Owner GAS bridge

This project is a separate server-to-server endpoint for Vercel. Keep the existing Owner Web App in its own Apps Script project and keep its deployment access set to **Only myself**. This package has no Owner UI and must not be copied into the Owner or Public project.

## Exposed surface

- `doPost`: accepts only `works.fetch`, `folders.fetch`, `works.create`, and `works.update` after shared-secret and configured Owner identity checks.
- `doGet`: returns a JSON `Method not allowed` envelope. It does not serve HTML.
- Every helper function ends in `_`, so it is not callable through `google.script.run`.

`works.create` and `works.update` are present for the GO 6B source contract. Keep the Preview write flag off until the separate read validation gate passes.

Apps Script `ContentService` does not expose a method to set an arbitrary HTTP status code. Error replies therefore carry a `httpStatus` and stable `code` in the JSON envelope; the Vercel Owner proxy translates `OWNER_API_UNAUTHORIZED` to HTTP 401. Malformed JSON and unknown actions fail closed before any action dispatch.

## Script Properties

Set these in **Project Settings → Script Properties** for this API-only project. Copy resource identifiers from the existing Owner setup through the private admin workflow; do not put values in source, this README, URLs, or browser configuration.

| Property | Purpose |
| --- | --- |
| `CXL_API_SHARED_SECRET` | High-entropy server-to-server credential. Must match Vercel's server-only environment variable. |
| `CXL_OWNER_USER_ID` | Stable private Owner key used by Vercel and the private creator mapping. |
| `PRIVATE_SHEET_ID` | Existing private spreadsheet; its first sheet is the private Work index and it contains `PrivateCreatorMap`. |
| `PUBLIC_SHEET_ID` | Existing public spreadsheet; its first sheet is the Public Work index and it contains `WorkCreatorMap`. |
| `PRIVATE_ID` | Existing Drive folder holding canonical full Work JSON revisions. |
| `PUBLIC_ID` | Existing Drive folder holding sanitized public projection JSON. |
| `INCOMING_ID` | Existing incoming folder containing `folders.jsonl`, used only by Owner `folders.fetch`. |

Do not copy `ROOT_ID` or `MEDIA_ID`; this source does not use them. Existing media references are read from canonical Work JSON, and public/private transitions may update sharing on those referenced files. This source does not create workspaces, import packages, upload media, export backups, or create Drive resources.

## Resource access

The script runs as its deployment account. For least privilege, use a dedicated Google account for this API project and share only the listed spreadsheets and folders with that account at the minimum roles needed for the operations above. In particular, Work create/update require edit access to the two index spreadsheets and private/public JSON folders; `folders.fetch` requires read access to the incoming folder; public/private transitions may require permission to update sharing on existing media files. If using the current Owner Google account as the execution account, that account retains its existing broader Drive authority.

The API script uses the configured resources by ID and contains no hardcoded private IDs. The API account must be able to access the existing Owner resources before deployment.

## Manual project creation and deployment

1. Create a **new standalone Apps Script project** for the API bridge. Do not add files to, replace files in, or change deployment settings on the existing private Owner or Public project.
2. In Project Settings, enable the `appsscript.json` manifest file in the editor. Add one script file named `Code.gs` and paste this package's `Code.gs`. Do not add `Index.html` or UI code. Keep the manifest settings equivalent to this package's `appsscript.json`.
3. Configure the Script Properties listed above. Keep the shared secret out of chat, source control, URLs, and browser-facing environment variables.
4. Run no setup/import/export function; the project intentionally contains none. Authorize the script against only the configured Google resources.
5. Deploy the new project as a Web App with **Execute as: the API deployment account**. Set access to **Anyone** only for this API-only project so Vercel server requests can reach `doPost`. This does not change the access policy of the existing Owner Web App, which remains **Only myself**.
6. Save the new `/exec` URL as Vercel Preview's server-only `CXL_GAS_OWNER_URL`. Keep `CXL_API_SHARED_SECRET` server-only. Do not put either value in `VITE_*`, a client bundle, or a request URL.
7. Before enabling any write flag, validate the endpoint with read-only `works.fetch` via the Vercel Owner proxy. Confirm missing/wrong secret fail closed and the existing Owner UI still works at its unchanged private deployment.
8. Do not enable the Preview write flag until the read gate is explicitly approved. Do not change Production or `main` in this step.

## Contract/data behavior

The bridge reuses the GO 6A Work persistence and public projection logic: Drive revision JSON remains canonical; private/public indexes and `WorkCreatorMap` are updated through the existing sync path; summary JSON uses the current allowlist; create retry keys and update revisions are enforced; public-sync partial failure returns `PUBLIC_SYNC_PENDING`; and media mutations remain rejected. It does not expose private Owner functions through `google.script.run`.

Because `doPost` is public at the transport layer, the shared secret is the server-to-server credential. Keep it high entropy, rotate it if exposed, and keep Owner OIDC/session verification in Vercel. Apps Script does not independently verify the browser Owner session.

## Owner list summary and search indexes

The Private Index stores compact Owner card data in versioned `summary_json` plus `summary_version`. It does not store the searchable corpus. Full-content search is held in a separate `OwnerSearchIndex` sheet with `work_id`, `chunk_index`, `search_text`, `search_version`, `updated_at`, and `index_token`. Each search cell is capped at 30,000 characters. Adjacent chunks overlap by 255 characters, preserving substring matches for the API's maximum 256-character query. The index covers title, short description, content, content-block titles/bodies, author name, tags, and UI code snippet. Search text and the search sheet are server-only and are never included in browser responses.

List reads without a search query use Private Index summaries only and do not access `OwnerSearchIndex` or canonical Drive JSON. Search requests bulk-read the search sheet once, verify active chunk sets, find matching Work IDs server-side, then return only Private Index summaries. A single `assetId` detail request reads only that Work's canonical Drive JSON. Full-list detail remains rejected.

Before using this source for Owner list reads, deploy the API-only project update and run `backfillOwnerSummaryIndex_` from the Apps Script editor. It defaults to at most 20 stale/missing Works per run. Run it repeatedly until `remaining: 0` and `ready: true`, then run `verifyOwnerSummaryReadiness_` and confirm missing/invalid summary and search counts are all zero. The backfill can resume after an interrupted run, reads each affected canonical Drive JSON once, updates only indexes, removes stale extra chunks, and never modifies canonical Work JSON. Existing legacy `search_text` cells in Private Index are cleared as each row is processed. Do not enable Owner list reads until readiness passes.

`works.fetch` summary/list reads then use the Private Index only. A single `assetId` request reads that one canonical Drive JSON. A `detail: "full"` request without `assetId` is rejected to prevent returning to per-Work Drive reads.
