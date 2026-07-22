-- DISABLED FOR SAFETY.
-- The previous version dropped the entire public schema and granted CREATE to
-- anon/authenticated. Never use a schema reset to repair signup in production.
do $$ begin
  raise exception 'RESET_DISABLED: use targeted idempotent migrations instead';
end $$;
