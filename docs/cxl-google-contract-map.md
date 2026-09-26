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

Browser → same-origin Vercel API → server-side Apps Script API. Public reads may call the Public Web App's sanitized Works, icon/media metadata, profile/settings, and creator-Works projections. External Owner actions remain restricted to the existing server-authenticated Works read; mutations are not enabled. The GAS Owner HTML `google.script.run` path and Public HTML path remain unchanged. No secret belongs in browser code.

GO 2 does not deploy or enable these API routes and does not change production reads/writes.

## GO 3–5A public read boundary

The Vite SPA is served as a static Vercel project with `api/` serverless functions, so the read proxy is `api/cxl/google.ts`; it does not add a framework or package. It accepts the existing `works.fetch` plus public `profiles.getCreator`, `profiles.getPublic`, and `settings.readCreatorSpace` actions. Profile/settings requests are anonymous and only target Public GAS. Mutations and private-map actions are rejected. The proxy validates request shapes, enforces a 12 second Apps Script timeout, and normalizes malformed/unavailable responses. The browser calls only `/api/cxl/google`; it never sends a GAS URL or shared secret.

Server-only Vercel environment variables: `CXL_GAS_PUBLIC_URL`, `CXL_GAS_OWNER_URL`, `CXL_API_SHARED_SECRET`, `CXL_OWNER_USER_ID`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY`. Owner scope requires `auth.getUser(accessToken)` to match `CXL_OWNER_USER_ID`; only then does the proxy add `CXL_API_SHARED_SECRET` to the server-to-server Owner GAS request. Anonymous/non-owner requests use the Public GAS read endpoint.

`filterGoogleWorks` follows the public summary read sequence. Non-UUID `creatorSlug` requests use Public GAS `works.creator`, which joins active Works through `WorkCreatorMap`; it never resolves or returns an internal profile/user ID. The Public reader adds `publicCreatorId` to Works list/detail at request time from that map, without rewriting `summary_json` or reading per-Work Drive JSON for list. `profiles.getCreator` resolves a normalized slug, `profiles.getPublic` batch-resolves opaque public IDs, and `settings.readCreatorSpace` returns only a versioned allowlist. Public social links are omitted while their source is unrecovered. The Google adapter remains inactive for profiles/settings; Supabase remains the runtime default unless a later rollout explicitly changes selection.

GO 5A adds public read support in source only. It does not change the frontend backend-selection flag, activate Google profile/settings reads, or deploy GAS/Vercel. Production and Preview frontend reads remain on their current selection until a later approved validation step.
