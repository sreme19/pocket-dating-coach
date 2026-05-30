-- Create a mutual match between Sreekanth and Mekhala so they appear
-- in each other's Messages tab immediately.
insert into verified_vibe_matches (user1_id, user2_id, status)
values (
  'e9ad653a-35ea-4a32-9730-37075d95c0a0', -- Sreekanth
  '305e980e-cb1f-41ce-bf35-91ddce38b293'  -- Mekhala
)
on conflict do nothing;

-- Ensure status is mutual (in case row already existed as pending)
update verified_vibe_matches
set status = 'mutual'
where (
  (user1_id = 'e9ad653a-35ea-4a32-9730-37075d95c0a0' and user2_id = '305e980e-cb1f-41ce-bf35-91ddce38b293')
  or
  (user1_id = '305e980e-cb1f-41ce-bf35-91ddce38b293' and user2_id = 'e9ad653a-35ea-4a32-9730-37075d95c0a0')
);
