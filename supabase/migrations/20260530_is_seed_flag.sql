alter table verified_vibe_users add column if not exists is_seed boolean not null default true;

-- Mark known real users
update verified_vibe_users set is_seed = false where id in (
  '305e980e-cb1f-41ce-bf35-91ddce38b293', -- Mekhala
  '5e46ed43-c422-4efc-92c7-d05843012f4e', -- Rudra Pratap
  '410fee27-2727-41b3-acc8-e18f24a841e4', -- Debarshi
  'e9ad653a-35ea-4a32-9730-37075d95c0a0'  -- SREEKANTH
);
