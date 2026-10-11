# Deploying on Cloudflare Workers

The site runs on Cloudflare Workers (free plan): Workers Static Assets serves the
built SPA from `dist/`, and `worker/index.ts` runs the same `/api/cxl/*` handlers
Vercel and Render run. Configuration lives in `wrangler.jsonc`.

## Dashboard setup (Workers Builds, connected to GitHub)

- Worker name: `cxlstudio` (must match `name` in `wrangler.jsonc`)
- Production branch: the branch that contains `wrangler.jsonc`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

A branch without `wrangler.jsonc` deploys as a static-only Worker, which cannot
hold runtime variables ("Variables cannot be added to a Worker that only has
static assets").

## Variables

There are two separate places; a value in the wrong one is not seen.

**Settings → Builds → Variables and secrets** (read while Vite builds the page;
they end up in the public bundle, so none of them is secret):

`VITE_CXL_OWNER_AUTH_BACKEND`, `VITE_CXL_PUBLIC_CREATOR_READ_BACKEND`,
`VITE_CXL_WORKS_READ_BACKEND`, `VITE_CXL_WORKS_WRITE_BACKEND`,
`VITE_PERSISTENCE_MODE`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`

**Settings → Variables and secrets** (runtime, read by the API handlers):
every `CXL_*`, `GOOGLE_*` and `SUPABASE_*` value. Store these as **Secret**:
`CXL_API_SHARED_SECRET`, `CXL_GOOGLE_SA_PRIVATE_KEY`,
`GOOGLE_OIDC_CLIENT_SECRET`, `CXL_OWNER_SESSION_SECRET`.

Host-specific values:

- `CXL_OWNER_APP_ORIGIN` = `https://cxlstudio.<subdomain>.workers.dev` (no trailing slash)
- `CXL_OWNER_OIDC_REDIRECT_URI` = `https://cxlstudio.<subdomain>.workers.dev/api/cxl/auth/callback`,
  also added to the Google Cloud OAuth client's authorized redirect URIs

Keeping the same `CXL_OWNER_SESSION_SECRET` as the previous host keeps the
sealed Owner Drive credential readable (no need to reconnect Drive).
`wrangler.jsonc` sets `keep_vars`, so deploys keep the dashboard's values.

## Free plan limits that shape the code

- 50 outbound calls per request: Drive lookups, state marks and trashes are
  batched (`findWorkMediaFiles`, `driveBatch` in `src/server/cxlDirectMedia.ts`),
  and tests in `src/server/cxlDirectWrite.test.ts` keep a 30-image save and a
  large permanent delete under the budget.
- About 10 ms of CPU per request: shrunk images (a few hundred KB) upload
  well within it; a 2 MiB upload chunk is close to the limit.
- Responses are not edge-cached on `workers.dev`; browsers cache versioned
  media URLs for a week.

## Local run

```sh
npm run cf:dev   # vite build + wrangler dev; put local values in .dev.vars (gitignored)
```
