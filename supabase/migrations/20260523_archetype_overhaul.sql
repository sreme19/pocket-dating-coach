-- Migration: PDC-48 — Archetype overhaul (6 male + 6 female)
-- Updates the archetype field for all seed profiles to the new VV archetype system.
-- The archetype column is TEXT NOT NULL — no enum migration needed.

UPDATE verified_vibe_users SET archetype = 'casual_generous_man'
WHERE first_name IN ('Victor','Alex','Kai','Owen','Dante','Greg','Ryan','Tim');

UPDATE verified_vibe_users SET archetype = 'hopeless_romantic_man'
WHERE first_name IN ('Adrian','Ethan','Tyler','Daniel');

UPDATE verified_vibe_users SET archetype = 'rebound_healing_man'
WHERE first_name IN ('Michael','Jake','Luca','Marcus');

UPDATE verified_vibe_users SET archetype = 'untouched_heart_man'
WHERE first_name IN ('John','Finn');

UPDATE verified_vibe_users SET archetype = 'forever_focused_man'
WHERE first_name IN ('Arjun','Karan');

UPDATE verified_vibe_users SET archetype = 'traditional_matrimony_man'
WHERE first_name IN ('Rohan');

UPDATE verified_vibe_users SET archetype = 'spoiled_casual_woman'
WHERE first_name IN ('Jade','Zara','Aria','Stella','Freya','Dominique');

UPDATE verified_vibe_users SET archetype = 'hopeless_romantic_woman'
WHERE first_name IN ('Emma','Luna','Sienna','Deepa');

UPDATE verified_vibe_users SET archetype = 'rebound_healing_woman'
WHERE first_name IN ('Maya','Claire','Nicole');

UPDATE verified_vibe_users SET archetype = 'untouched_heart_woman'
WHERE first_name IN ('Rachel');

UPDATE verified_vibe_users SET archetype = 'forever_focused_woman'
WHERE first_name IN ('Diana','Jessica','Priya','Lauren','Sarah');

UPDATE verified_vibe_users SET archetype = 'traditional_matrimony_woman'
WHERE first_name IN ('Anjali','Kavya','Neha');
