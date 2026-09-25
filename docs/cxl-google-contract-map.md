# CXL to Google prototype contract map (GO 2)

The active service remains `cxlDataService` → `supabaseDataAdapter`. `googleDataAdapter` is an inactive, compile-time implementation of the same service contract. The browser transport calls a same-origin Vercel endpoint and contains no owner credential.

| CXL domain | Prototype counterpart | GO 2 mapping/status |
| --- | --- | --- |
| Works / assets | Private Sheets index + revisioned Drive JSON | Needs extension: Sheet remains index; Drive JSON receives a complete `cxlAsset` snapshot. Prototype's legacy `row` remains for its current UI/search and public projection. |
| Work detail | `getOwnerWork`, `getPublicWork` | Needs extension: retain the full CXL snapshot and expose dedicated CXL API serialization; legacy screens continue using their current record shape. |
| Folders | `getFolders` + `folders.jsonl` | Needs extension: read fixture exists; persisted create/update/delete and CXL Folder mapping are absent. |
| Collaboration drafts | `collaborationDraft`, revisioned owner record | Supported already in prototype; Needs extension to map all CXL private collaboration fields and linked work IDs without loss. |
| Public collaboration | `publicSnapshot_`, `projection_` | Supported already as sanitized projection; Needs extension for exact CXL camelCase contract and full public media metadata. |
| Work media | Drive binary files + `mediaRecords`, `media:` references | Needs extension: prototype validates and stores supported image/GIF bytes; exact `asset_media` manifest, batch hydration, signed-like short-lived URLs, ordering/cover mutations and CXL cleanup/fork operations need API mapping. |
| Profiles | None | Missing. |
| Creator settings | None | Missing. |
| Engagement | None | Deferred; preserve current contract and Supabase behavior. |
| Reports | None | Deferred; preserve current contract and Supabase behavior. |

## Storage rules

- Sheets hold IDs, searchable metadata, folder/status/visibility/deleted state, revision, Drive JSON file ID, media counts, and cover reference only.
- Private Drive JSON holds the prototype record plus a complete `cxlAsset` snapshot. Unknown CXL fields stay in that snapshot.
- Drive media folder holds binary media. JSON stores media IDs, work IDs, purpose/context, ordering, cover flag, MIME/size, Drive file ID, visibility, and timestamps. Base64 is a request encoding only.
- Public Sheet and public Drive projection contain published records only and omit private collaboration/contact data.

## API contract and authorization boundary

Browser → same-origin Vercel API → server-side Apps Script API. Public read routes may call only the Public Web App's sanitized `list`, `search`, `detail`, and media metadata actions. Owner mutations are forwarded server-side and authenticated using an Apps Script Script Property (`CXL_API_SHARED_SECRET`) with a server-held matching credential. No secret belongs in browser code. The GAS Owner HTML `google.script.run` path and Public HTML path remain unchanged. Until a server route and deployment are configured, the inactive adapter fails closed.

GO 2 does not deploy or enable these API routes and does not change production reads/writes.

## GO 3 Works read boundary

The Vite SPA is served as a static Vercel project with `api/` serverless functions, so the read proxy is `api/cxl/google.ts`; it does not add a framework or package. It accepts only `works.fetch`, validates the option object, enforces a 12 second Apps Script timeout, and normalizes malformed/unavailable responses. The browser calls only `/api/cxl/google` and may send its Supabase user access token for verification; it never sends a GAS URL or shared secret.

Server-only Vercel environment variables: `CXL_GAS_PUBLIC_URL`, `CXL_GAS_OWNER_URL`, `CXL_API_SHARED_SECRET`, `CXL_OWNER_USER_ID`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY`. Owner scope requires `auth.getUser(accessToken)` to match `CXL_OWNER_USER_ID`; only then does the proxy add `CXL_API_SHARED_SECRET` to the server-to-server Owner GAS request. Anonymous/non-owner requests use the Public GAS read endpoint.

`filterGoogleWorks` follows the current Supabase read sequence: scope/visibility/deleted state, category/folder, created date descending, DB limit, then client-side title/content/tag search, then summary projection. Creator slug resolution remains unsupported until Profiles read exists. Public legacy projections omit user IDs and Drive identifiers, so public profile-by-user-ID parity is also incomplete. The shadow comparison is an explicit dev/test-only function; it reports count, ordered IDs and material fields, while normalizing only storage paths and signed URL differences by stable media IDs.

GO 3 adds read transport only. It does not enable the Google adapter in `cxlDataService`, deploy the Vercel function, or move production reads. Required deployment configuration and owner Apps Script access policy remain a later controlled rollout prerequisite.
