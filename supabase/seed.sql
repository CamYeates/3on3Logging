-- Seed data: one organization, two teams, six players (3 per team).
-- Fixed UUIDs so the mobile app can reference them deterministically in dev.

insert into organizations (id, name)
values ('00000000-0000-0000-0000-0000000000ff', 'Demo League')
on conflict (id) do nothing;

-- Teams
insert into teams (id, organization_id, name) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000ff', 'Red Hawks'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000ff', 'Blue Wolves')
on conflict (id) do nothing;

-- Players — Team A (Red Hawks)
insert into players (id, team_id, name, jersey_number) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'Alex Carter', '7'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1', 'Jordan Lee', '11'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a1', 'Sam Rivera', '23')
on conflict (id) do nothing;

-- Players — Team B (Blue Wolves)
insert into players (id, team_id, name, jersey_number) values
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000b1', 'Taylor Brooks', '3'),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000b1', 'Morgan Diaz', '9'),
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000000b1', 'Casey Nguyen', '15')
on conflict (id) do nothing;
