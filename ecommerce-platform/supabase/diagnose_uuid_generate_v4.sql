-- Run this in Supabase Dashboard > SQL Editor and share the output.
-- It finds every remaining reference to uuid_generate_v4() in the database:
-- column defaults, function/trigger bodies, and whether the uuid-ossp
-- extension is even installed.

-- 1. Column defaults still pointing at uuid_generate_v4()
select table_schema, table_name, column_name, column_default
from information_schema.columns
where column_default ilike '%uuid_generate_v4%';

-- 2. Function/trigger bodies that call uuid_generate_v4()
select n.nspname as schema_name, p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where pg_get_functiondef(p.oid) ilike '%uuid_generate_v4%';

-- 3. Is the uuid-ossp extension installed, and in which schema?
select e.extname, n.nspname as installed_schema
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
where e.extname = 'uuid-ossp';
