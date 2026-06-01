ALTER TABLE verified_vibe_users ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT true;

UPDATE verified_vibe_users SET is_seed = false WHERE id IN (
  '305e980e-cb1f-41ce-bf35-91ddce38b293',
  '5e46ed43-c422-4efc-92c7-d05843012f4e',
  '410fee27-2727-41b3-acc8-e18f24a841e4'
);;
