# Supabase database changes

The SQL files in `supabase/migrations/` are review artifacts. Phase 1 does not
apply them to the production project automatically.

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
