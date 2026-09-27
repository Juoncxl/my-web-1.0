# CXL API-only Owner GAS bridge

This project is a separate server-to-server endpoint for Vercel. Keep the existing Owner Web App in its own Apps Script project and keep its deployment access set to **Only myself**. This package has no Owner UI and must not be copied into the Owner or Public project.

## Exposed surface

- `doPost`: accepts the Works/folder contracts, Preview-only standard Work `media.upload.*` actions, and isolated `media.poc.*` actions after shared-secret and configured Owner identity checks.
- `doGet`: returns a JSON `Method not allowed` envelope. It does not serve HTML.
- Every helper function ends in `_`, so it is not callable through `google.script.run`.

GO 7A.2 read validation is complete. This source contains the GO 7B.1 write, GO 7B.2 read/hydration, and GO 7B.3 replace/remove plus orphan-cleanup implementations; none of GO 7B is live validated yet. Vercel media actions remain Preview-only, and the runtime still needs Preview configuration and live validation at GO 7B.4.

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
| `CXL_WORK_MEDIA_FOLDER_ID` | Dedicated private canonical binary folder for new standard Work media. Do not reuse `CXL_MEDIA_FOLDER_ID`, a legacy Owner/Public media folder, or any folder that allows public access. |
| `CXL_WORK_MEDIA_STAGING_FOLDER_ID` | Dedicated private staging folder for new standard Work media chunks. It must be separate from `CXL_WORK_MEDIA_FOLDER_ID` and from the GO 7A.2 POC staging folder. |

This API-only project deliberately keeps the GO 7A.2 `CXL_MEDIA_*` folders isolated from GO 7B.1 `CXL_WORK_MEDIA_*` folders and does not alias either from legacy Owner `MEDIA_ID` or Public project `MEDIA_FOLDER_ID`. Do not copy `ROOT_ID` or `MEDIA_ID` for this API-only bridge. Existing legacy media keeps its existing transition behavior. New Google Work media is tagged `vercel_proxy`; `shareRecordMedia_` forces those files to remain private even when their Work is public. The public bytes must be served through the Vercel proxy in a later read stage. The source does not create Drive resources or change any current environment settings.

## GO 7A.2 isolated media proof-of-concept

GO 7A.2 is **LIVE VALIDATED / CLOSED**. The live run passed BEGIN, all five 2 MiB chunks, FINALIZE, Owner private read, Public enable/read/revoke, cleanup, and the full 10 MiB round trip. The final response was HTTP 200 with `image/png`, 10,485,760 bytes, matching expected length and checksum, and a valid PNG signature. The POC route remains isolated behind Vercel Preview and the server-only `CXL_MEDIA_POC_ENABLED=1` switch; it still creates synthetic POC associations and does not attach files to real Works.

For a new isolated POC run in another Preview environment, an administrator must create or select two **new, empty, private and separate** Drive folders and set their IDs as Script Properties `CXL_MEDIA_FOLDER_ID` and `CXL_MEDIA_STAGING_FOLDER_ID` in the API-only Apps Script project. Do not point either property at existing Owner/Public media folders. Do not send the IDs in chat or add them to source control. The source checks that both folders are private and rejects them if they are the same folder. If either folder is missing or not private, stop before attempting an upload.

The POC uses these isolated actions: Owner-authenticated `media.poc.begin`, `media.poc.chunk`, `media.poc.finalize`, `media.poc.setPublic`, `media.poc.ownerChunk`, and `media.poc.cleanup`; anonymous `media.poc.publicChunk` is permitted only after the association check. Private delivery requires the Vercel Owner session. The anonymous public test delivery is available only while the generated synthetic test association is active and an authenticated Owner has explicitly marked it public; turning it private makes the next anonymous request fail. Canonical POC files remain private in Drive in both states; anonymous bytes are delivered only through the server proxy after the POC association check. Neither route exposes Drive IDs, file paths, Apps Script URLs, or shared secrets.

Chunks are accepted out of order, checked for exact size and SHA-256, and idempotent for identical retries; a retry with different bytes is rejected. Finalization requires every chunk, validates total size/checksum and MIME against the binary signature, writes one private canonical POC file, and removes that upload's staging chunks. Abandoned sessions expire after 24 hours. The authenticated cleanup action handles at most five expired sessions per call and only removes exact POC chunk filenames from the staging folder; it never scans or deletes canonical files or Work JSON. There is no trigger.

The live run confirmed private Drive Range reads return the requested bytes through the Vercel proxy for both Owner and public POC reads. The public POC association can be revoked independently while its Drive file remains private. GO 7B.1 reuses the 2 MiB chunk and finalize mechanics but writes to the separate `CXL_WORK_MEDIA_*` folders and leaves the finalized manifest unattached until the canonical Work create/update commit.

Preview timing contains only the allowlisted action/phase labels and numeric durations. It does not contain IDs, file names, URLs, credentials, request bodies, or image bytes.

## Resource access

The script runs as its deployment account. For least privilege, use a dedicated Google account for this API project and share only the listed spreadsheets and folders with that account at the minimum roles needed for the operations above. In particular, Work create/update require edit access to the two index spreadsheets and private/public JSON folders; `folders.fetch` requires read access to the incoming folder; media uploads require edit access to both private `CXL_WORK_MEDIA_*` folders. New Work media never needs public Drive sharing permission. If using the current Owner Google account as the execution account, that account retains its existing broader Drive authority.

The API script uses the configured resources by ID and contains no hardcoded private IDs. The API account must be able to access the existing Owner resources before deployment.

## Manual project creation and deployment

1. Create a **new standalone Apps Script project** for the API bridge. Do not add files to, replace files in, or change deployment settings on the existing private Owner or Public project.
2. In Project Settings, enable the `appsscript.json` manifest file in the editor. Add one script file named `Code.gs` and paste this package's `Code.gs`. Do not add `Index.html` or UI code. Keep the manifest settings equivalent to this package's `appsscript.json`.
3. Configure the Script Properties listed above. Keep the shared secret out of chat, source control, URLs, and browser-facing environment variables.
4. Run no setup/import/export function; the project intentionally contains none. Authorize the script against only the configured Google resources.
5. Deploy the new project as a Web App with **Execute as: the API deployment account**. Set access to **Anyone** only for this API-only project so Vercel server requests can reach `doPost`. This does not change the access policy of the existing Owner Web App, which remains **Only myself**.
6. Save the new `/exec` URL as Vercel Preview's server-only `CXL_GAS_OWNER_URL`. Keep `CXL_API_SHARED_SECRET` server-only. Do not put either value in `VITE_*`, a client bundle, or a request URL.
7. Before enabling any write flag, validate the endpoint with read-only `works.fetch` via the Vercel Owner proxy. Confirm missing/wrong secret fail closed and the existing Owner UI still works at its unchanged private deployment.
8. GO 7A.2 media reads are live validated. GO 7B.1–7B.3 source is not deployed; keep the existing Preview read-only until the GO 7B.4 live validation gate. Do not change Production or `main` in this step.

## GO 7B.1 standard Work media write foundation

The Preview Owner editor accepts standard Work icon, gallery/cover, and content-block image uploads up to 10 MiB each. It converts local `blob:`/data sources to `media:<mediaId>` references, hashes the original file and each fixed 2 MiB chunk, sends one chunk request at a time, then finalizes. `mediaId` is an independent UUID retained in the local Composer draft for idempotent retries; it is never derived from the Work `requestId`.

New upload actions are `media.upload.begin`, `media.upload.chunk`, and `media.upload.finalize`. They require the authenticated Owner session and CSRF at Vercel and the existing server-to-server secret at GAS. A finalized image is still private and pending. `works.create`/`works.update` validates that every new reference matches an Owner-bound, target-Work-bound finalized manifest, then adds its media record during the existing Script Lock and canonical revision write sequence. The manifest is marked attached after the canonical revision and private index are written; an idempotent retry repairs that marker if the response is interrupted. Public Work transitions force files marked `delivery: vercel_proxy` to remain Drive-private.

Failed uploads do not change the Work. A finalized file whose Work commit fails remains private and unattached until bounded orphan cleanup expires it. Read hydration and replacement/removal are implemented in the following GO 7B stages; Collaboration draft/reference media and legacy backfill remain unsupported.

Before GO 7B.4 live validation, create two **new, empty, private, separate** Drive folders and set `CXL_WORK_MEDIA_FOLDER_ID` and `CXL_WORK_MEDIA_STAGING_FOLDER_ID` in this API-only Apps Script project. Do not reuse either GO 7A.2 POC folder or any legacy media folder. The Vercel `/api/cxl/google` upload/write route accepts media-bearing requests only in Preview. No Apps Script deployment, Vercel deployment, or environment change is part of this source update.

## Contract/data behavior

## GO 7B.2 read and hydration

Owner hydration converts standard Work `media:` references into same-origin Vercel proxy URLs only in the read layer. Owner reads require the Owner session; public reads require a current public Work projection association. Canonical Work JSON remains `media:` references and browser responses do not contain Drive IDs or URLs. Drive files remain private. Supabase and legacy media hydration keep their existing adapter behavior.

## GO 7B.3 replace/remove and cleanup

The locked Work write derives previous and next media references from the canonical record and validated standard Work fields. New uploads finalize before the Work write. Google proxy media records are removed from the new canonical revision only when no reference remains. Manifests are retired only after the private Work index points to the committed revision, so a failed validation or revision conflict leaves existing media untouched. The canonical association check rejects reads of removed media immediately, including public reads while a public projection is stale.

Finalized unassociated uploads expire 24 hours after finalization. Retired files remain private for 24 hours after the Work commit, then become eligible for trashing. The authenticated Preview-only `media.cleanup` action scans at most five Work-media session/manifest records per invocation, skips active uploads, verifies the current Owner/Work association, and checks the exact private Work-media folder/name before deleting. POC, legacy/Supabase media, and unrelated Drive files are outside its key/folder contract. Cleanup retains a deleted media identity tombstone so the same `mediaId` cannot be reused. GO 7B.3 is implementation complete but not deployed or live validated; that remains GO 7B.4.

The bridge still reuses the GO 6A Work persistence and public projection logic: Drive revision JSON remains canonical; private/public indexes and `WorkCreatorMap` are updated through the existing sync path; summary JSON uses the current allowlist; create retry keys and update revisions are enforced; and public-sync partial failure returns `PUBLIC_SYNC_PENDING`. Collaboration media and legacy backfill remain deferred. It does not expose private Owner functions through `google.script.run`.

Because `doPost` is public at the transport layer, the shared secret is the server-to-server credential. Keep it high entropy, rotate it if exposed, and keep Owner OIDC/session verification in Vercel. Apps Script does not independently verify the browser Owner session.

## Owner list summary and search indexes

The Private Index stores compact Owner card data in versioned `summary_json` plus `summary_version`. It does not store the searchable corpus. Full-content search is held in a separate `OwnerSearchIndex` sheet with `work_id`, `chunk_index`, `search_text`, `search_version`, `updated_at`, and `index_token`. Each search cell is capped at 30,000 characters. Adjacent chunks overlap by 255 characters, preserving substring matches for the API's maximum 256-character query. The index covers title, short description, content, content-block titles/bodies, author name, tags, and UI code snippet. Search text and the search sheet are server-only and are never included in browser responses.

List reads without a search query use Private Index summaries only and do not access `OwnerSearchIndex` or canonical Drive JSON. Search requests bulk-read the search sheet once, verify active chunk sets, find matching Work IDs server-side, then return only Private Index summaries. A single `assetId` detail request reads only that Work's canonical Drive JSON. Full-list detail remains rejected.

Before using this source for Owner list reads, deploy the API-only project update and run `backfillOwnerSummaryIndex_` from the Apps Script editor. It defaults to at most 20 stale/missing Works per run. Run it repeatedly until `remaining: 0` and `ready: true`, then run `verifyOwnerSummaryReadiness_` and confirm missing/invalid summary and search counts are all zero. The backfill can resume after an interrupted run, reads each affected canonical Drive JSON once, updates only indexes, removes stale extra chunks, and never modifies canonical Work JSON. Existing legacy `search_text` cells in Private Index are cleared as each row is processed. Do not enable Owner list reads until readiness passes.

`works.fetch` summary/list reads then use the Private Index only. A single `assetId` request reads that one canonical Drive JSON. A `detail: "full"` request without `assetId` is rejected to prevent returning to per-Work Drive reads.

Successful writes append a new search chunk generation and point the Private Index at its token. Search and readiness use only that current token; older chunks may remain until maintenance and do not affect matches. From the API-only Apps Script editor, run `compactOwnerSearchIndex_` with no arguments when old chunks need cleanup. Each run deletes at most 20 stale or orphaned rows under the Script Lock and reports `deleted` and `remaining`; repeat until `remaining: 0`. This manual maintenance is optional for Work saves and search correctness. `verifyOwnerSummaryReadiness_` reports `staleExtraChunks` separately without treating old generations as a read blocker. No trigger or new schema is required.
