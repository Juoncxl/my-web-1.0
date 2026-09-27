# CXL API-only Owner GAS bridge

This project is a separate server-to-server endpoint for Vercel. Keep the existing Owner Web App in its own Apps Script project and keep its deployment access set to **Only myself**. This package has no Owner UI and must not be copied into the Owner or Public project.

## Exposed surface

- `doPost`: accepts only the Works/folder contracts and isolated `media.poc.*` actions after shared-secret and configured Owner identity checks.
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
| `CXL_MEDIA_FOLDER_ID` | Canonical Work-media binary destination for the isolated GO 7A.2 Preview proof-of-concept. Keep it private; use a new empty test folder during this POC, never an existing Owner Work/media folder. |
| `CXL_MEDIA_STAGING_FOLDER_ID` | Separate private folder for temporary GO 7A.2 upload chunks. It must not be the canonical POC media folder or an existing Work folder. |

This API-only project deliberately uses `CXL_MEDIA_FOLDER_ID` and `CXL_MEDIA_STAGING_FOLDER_ID` for the isolated POC; it does not alias either value from legacy Owner `MEDIA_ID` or Public project `MEDIA_FOLDER_ID`. Do not copy `ROOT_ID` or `MEDIA_ID` for this API-only bridge. Existing media references are read from canonical Work JSON, and public/private Work transitions may update sharing on those referenced files. The `CXL_MEDIA_*` folders are used only by the gated GO 7A.2 POC; they are never used to migrate or change existing Work media. The source does not create Drive resources.

## GO 7A.2 isolated media proof-of-concept

This branch adds source support only. The route remains unavailable unless the runtime is a Vercel Preview and the server-only/non-public switch `CXL_MEDIA_POC_ENABLED` is manually set to `1`. No environment has been changed by this source update. The POC accepts only standalone test uploads up to 10 MiB, split into fixed 2 MiB-or-smaller chunks. It generates test Work/media references itself; it does not attach files to a real CXL Work or call the normal Work editor/write path.

Before a live POC can run, an administrator must create or select two **new, empty, private and separate** Drive folders and set their IDs as Script Properties `CXL_MEDIA_FOLDER_ID` and `CXL_MEDIA_STAGING_FOLDER_ID` in the API-only Apps Script project. Do not point either property at existing Owner/Public media folders. Do not send the IDs in chat or add them to source control. The source checks that both folders are private and rejects them if they are the same folder. If either folder is missing or not private, stop before attempting an upload.

The POC uses these isolated actions: Owner-authenticated `media.poc.begin`, `media.poc.chunk`, `media.poc.finalize`, `media.poc.setPublic`, `media.poc.ownerChunk`, and `media.poc.cleanup`; anonymous `media.poc.publicChunk` is permitted only after the association check. Private delivery requires the Vercel Owner session. The anonymous public test delivery is available only while the generated synthetic test association is active and an authenticated Owner has explicitly marked it public; turning it private makes the next anonymous request fail. Canonical POC files remain private in Drive in both states; anonymous bytes are delivered only through the server proxy after the POC association check. Neither route exposes Drive IDs, file paths, Apps Script URLs, or shared secrets.

Chunks are accepted out of order, checked for exact size and SHA-256, and idempotent for identical retries; a retry with different bytes is rejected. Finalization requires every chunk, validates total size/checksum and MIME against the binary signature, writes one private canonical POC file, and removes that upload's staging chunks. Abandoned sessions expire after 24 hours. The authenticated cleanup action handles at most five expired sessions per call and only removes exact POC chunk filenames from the staging folder; it never scans or deletes canonical files or Work JSON. There is no trigger.

The Owner-private and anonymous-public Vercel reads request one byte range at a time from the private canonical Drive file. GAS uses the execution account's OAuth token for Drive `alt=media` range reads and returns only that range as Base64; Vercel validates its checksum and writes decoded bytes to the Node response with backpressure. It does not send a single full-file Base64 JSON response through Vercel. If Drive returns a full `200` body instead of `206`, GAS verifies the full size before slicing; the live Preview run must confirm the actual response mode, latency, and memory/time use. Apps Script may request its external-request OAuth permission on first authorization. Full 10 MiB behavior and end-to-end streaming still require live Preview validation after the isolated folders and Preview switch are configured. If the 10 MiB round trip is incomplete or unreliable, stop; do not reduce the supported limit or attach this path to real Works.

Preview timing contains only the allowlisted action/phase labels and numeric durations. It does not contain IDs, file names, URLs, credentials, request bodies, or image bytes.

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

Successful writes append a new search chunk generation and point the Private Index at its token. Search and readiness use only that current token; older chunks may remain until maintenance and do not affect matches. From the API-only Apps Script editor, run `compactOwnerSearchIndex_` with no arguments when old chunks need cleanup. Each run deletes at most 20 stale or orphaned rows under the Script Lock and reports `deleted` and `remaining`; repeat until `remaining: 0`. This manual maintenance is optional for Work saves and search correctness. `verifyOwnerSummaryReadiness_` reports `staleExtraChunks` separately without treating old generations as a read blocker. No trigger or new schema is required.
