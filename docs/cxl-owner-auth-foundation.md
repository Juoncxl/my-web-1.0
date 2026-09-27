# CXL Owner Auth Foundation (GO 9A1)

This source change adds an opt-in, owner-only Google OIDC login for Preview validation. It does not enable the mode in Vercel and does not replace the Supabase default.

## Session and identity

- Google OIDC authorization-code flow uses state, nonce, and PKCE S256.
- The server validates Google signature/JWKS, issuer, audience, expiry, state, nonce, PKCE exchange, allowlisted `sub`, and `email_verified` when the claim is present.
- The server issues a signed `__Host-cxl_owner` cookie with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`, and a 12-hour absolute expiry.
- Logout clears the browser cookie. Initial sessions are stateless, so individual copied-cookie revocation is unavailable before expiry. Rotating `CXL_OWNER_SESSION_SECRET` invalidates every active Owner session.
- `currentUser.id` stays the server-configured legacy Owner record key for private legacy UI compatibility. `currentUser.publicCreatorId` is the separate public identity. Public GAS profile hydration uses only `profiles.getPublic`; `PrivateCreatorMap` is never queried or returned.

## Selectors

- Client build flag `VITE_CXL_OWNER_AUTH_BACKEND=vercel` selects the Owner OIDC UI/session adapter. Missing, empty, or unknown values select Supabase.
- Server variable `CXL_OWNER_AUTH_BACKEND=vercel` enables the Owner auth API and cookie verification. Missing/unknown values keep the existing Supabase bearer verification path.
- Keep the GO 6A Works write flag unset until its separate validation is approved.

## Server-only Vercel Preview variables

Configure these only in the Vercel Preview environment. Never prefix a secret with `VITE_`.

| Variable | Purpose |
| --- | --- |
| `CXL_OWNER_AUTH_BACKEND` | Set to `vercel` to enable the server Owner OIDC endpoints |
| `GOOGLE_OIDC_CLIENT_ID` | Google OAuth web client ID |
| `GOOGLE_OIDC_CLIENT_SECRET` | Google OAuth web client secret |
| `CXL_OWNER_GOOGLE_SUB` | The one allowlisted Google OIDC subject |
| `CXL_OWNER_SESSION_SECRET` | Random server-only signing secret, at least 32 characters |
| `CXL_OWNER_OIDC_REDIRECT_URI` | Exact callback URL ending `/api/cxl/auth/callback` |
| `CXL_OWNER_APP_ORIGIN` | Exact HTTPS Preview origin; no path/query |
| `CXL_OWNER_USER_ID` | Existing legacy Owner record key used by server-side GAS mapping |
| `CXL_OWNER_PUBLIC_CREATOR_ID` | Existing opaque public creator ID for safe profile hydration |
| `CXL_OWNER_PROFILE_SLUG` | Optional canonical Owner route slug for session bootstrap; defaults to `juoncxl` and is not an authorization input |
| `CXL_GAS_PUBLIC_URL` | Existing Public GAS `/exec` URL used by public profile reads, not Owner session verification |
| `CXL_GAS_OWNER_URL` | Existing Owner GAS `/exec` URL |
| `CXL_API_SHARED_SECRET` | Existing server-to-Owner-GAS secret; separate from the session secret |

The browser build flag is separate: `VITE_CXL_OWNER_AUTH_BACKEND=vercel`. It is a non-secret selector only. Configure the exact Preview branch alias as app origin and register its exact callback URI in the Google OAuth client. Do not use a per-deployment URL that changes after each commit.

## Browser and mutation behavior

- Vercel auth mode sends same-origin requests and relies on the browser cookie; it never reads a Supabase access token. Core Works create/update requests include a CSRF header from the readable CSRF cookie and are checked against the exact configured Origin.
- Owner API maps the verified OIDC subject to `CXL_OWNER_USER_ID`; request payload Owner IDs do not choose the trusted identity.
- Profile/password changes, profile image writes, folder mutations, collaboration draft mutations, engagement writes, reports, and media upload/delete remain deferred and fail explicitly. Owner folders/read and Google Works core writes require their separate GO 6A write selection. Public anonymous reads remain available.

## Google/Vercel setup before Preview validation

1. In Google Cloud Console, configure an OAuth 2.0 Web application client and add the exact Vercel Preview branch alias callback URL as an authorized redirect URI.
2. Identify the Owner account's stable OIDC `sub` from a controlled identity check; do not use email as the allowlist key.
3. Add the server-only variables above to Vercel Preview. Keep all values out of build logs and client variables.
4. Add only `VITE_CXL_OWNER_AUTH_BACKEND=vercel` as the browser build selector after the server settings are complete. Keep Production untouched.
5. Redeploy Preview, test Owner login/session/logout and the protected Works/folders reads. Keep the GO 6A Works write flag unset until separately approved.
