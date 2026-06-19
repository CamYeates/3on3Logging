-- Row Level Security policies.
--
-- MVP NOTE: This is intentionally simple. For the internal-distribution MVP we
-- enable RLS and allow any authenticated user to read/write. Tighten this for
-- production by scoping rows to organization membership (see TODOs).

alter table organizations enable row level security;
alter table users         enable row level security;
alter table teams         enable row level security;
alter table players       enable row level security;
alter table games         enable row level security;
alter table game_players  enable row level security;
alter table game_events   enable row level security;

-- Helper macro pattern: one permissive policy per table for authenticated users.
-- TODO(prod): replace `auth.role() = 'authenticated'` with organization-scoped
-- checks, e.g. games.organization_id in (select organization_id from
-- organization_members where user_id = auth.uid()).

do $$
declare
  t text;
  tables text[] := array[
    'organizations','users','teams','players','games','game_players','game_events'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I_auth_all on %I;', t, t);
    execute format(
      'create policy %I_auth_all on %I for all to authenticated using (true) with check (true);',
      t, t
    );
  end loop;
end $$;

-- For a fully offline MVP with no auth yet, you may instead want anon access.
-- Uncomment to allow the anon key to read/write directly (NOT for production):
--
-- do $$
-- declare t text; tables text[] := array['games','game_players','game_events','teams','players'];
-- begin
--   foreach t in array tables loop
--     execute format('drop policy if exists %I_anon_all on %I;', t, t);
--     execute format('create policy %I_anon_all on %I for all to anon using (true) with check (true);', t, t);
--   end loop;
-- end $$;
