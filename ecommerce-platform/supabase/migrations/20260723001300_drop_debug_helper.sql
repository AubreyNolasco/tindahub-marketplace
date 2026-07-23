-- Remove the temporary diagnostic helper used to inspect live trigger
-- definitions while debugging the order-completion lock (see the previous
-- two migrations). Not needed in the app going forward.
drop function if exists public.debug_get_function_def(text);
