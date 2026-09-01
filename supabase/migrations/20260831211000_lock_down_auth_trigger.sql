-- The auth trigger is internal database plumbing, not a Data API endpoint.
-- Keep it callable by the trigger owner while removing public RPC execution.

revoke all on function public.handle_new_user() from public, anon, authenticated;
