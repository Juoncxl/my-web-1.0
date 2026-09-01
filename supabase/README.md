# Supabase database changes

The SQL files in `supabase/migrations/` are review artifacts. Phase 1 does not
apply them to the production project automatically.

## Local Auth configuration

The Vite client reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build
time. Copy `.env.example` to an ignored `.env.local`, set both values from the
intended Supabase project, and rebuild before using `npm run preview`. Never
place a service-role key in a Vite environment variable.

Email signup uses the current browser origin as `emailRedirectTo`. For local
preview, add the exact origin (for example `http://localhost:4173`) to the
Supabase Auth URL Configuration allow list. The app handles both outcomes:
`data.session` means the project does not require email confirmation; a null
session means the UI asks the user to confirm their email before login.

## Phase 1 rollout checklist

1. Take a database backup and test the migration on a Supabase development
   branch or disposable project first.
2. Review the policy replacement block. It intentionally removes every existing
   policy on the six Phase 1 tables before installing one canonical policy set.
3. Confirm that legacy aggregate likes were copied to `legacy_likes_count` and
   that `likes_count` was not reduced.
4. Verify public, owner, and unrelated-user access before production rollout.
5. Apply the migration manually in the Supabase SQL editor only after approval.
6. Run the Supabase security and performance advisors after applying it.

The migration creates constraints as `NOT VALID` where existing production rows
could need cleanup. They still protect new writes. Validate them later after an
explicit data audit.

## Manual dashboard configuration

- Enable leaked-password protection under Auth security settings.
- Keep anonymous sign-ins disabled for the Phase 1 read-only visitor model.
- Do not expose a service-role or secret key to the Vite frontend.
- Reports intentionally have no client-readable policy. A future moderation
  dashboard needs a trusted server-side admin role before report SELECT access is
  added.
