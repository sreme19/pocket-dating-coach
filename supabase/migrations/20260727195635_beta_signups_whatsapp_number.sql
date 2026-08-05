-- WhatsApp number on beta signups (2026-07-28).
--
-- The /beta/{token} form now collects a WhatsApp number alongside the email, so
-- the team can reach a prospective tester on the channel they actually read.
-- Stored SPLIT, the same way it is collected: a dial code plus the national
-- number. whatsapp_e164 is generated from the two so every consumer (admin
-- table, future OTP send, any export) dials an identical string and nobody has
-- to re-implement the concatenation.
--
-- All three columns are NULLABLE on purpose: the 37 rows collected before this
-- migration have no number and must keep working — every read path treats a
-- missing number as "—", and the invite flow never depends on it.
--
-- Deliberately NOT unique. A collision would hit the submit endpoint's
-- unique-violation branch, which reports success to the user, so a second
-- person sharing a number (or one person re-submitting with a new email) would
-- silently lose their signup. Email stays the identity key; this is contact
-- data.

alter table verified_vibe_beta_signups
  add column if not exists whatsapp_country_code text,
  add column if not exists whatsapp_number text;

-- Shape guards mirroring src/lib/phone.ts. The app normalizes before writing
-- (digits only, trunk '0' and duplicated dial code stripped), so anything that
-- trips these is a bug in the writer, not bad user input.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vv_beta_signups_whatsapp_code_chk'
  ) then
    alter table verified_vibe_beta_signups
      add constraint vv_beta_signups_whatsapp_code_chk
      check (whatsapp_country_code is null or whatsapp_country_code ~ '^\+[1-9][0-9]{0,3}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'vv_beta_signups_whatsapp_number_chk'
  ) then
    alter table verified_vibe_beta_signups
      add constraint vv_beta_signups_whatsapp_number_chk
      check (whatsapp_number is null or whatsapp_number ~ '^[1-9][0-9]{5,13}$');
  end if;
end $$;

-- Dialable form, derived so it can never drift from its two parts.
alter table verified_vibe_beta_signups
  add column if not exists whatsapp_e164 text
  generated always as (
    case
      when whatsapp_country_code is not null and whatsapp_number is not null
      then whatsapp_country_code || whatsapp_number
    end
  ) stored;

-- Supports "has this number already signed up / been invited" lookups without
-- imposing uniqueness.
create index if not exists verified_vibe_beta_signups_whatsapp_idx
  on verified_vibe_beta_signups (whatsapp_e164);

comment on column verified_vibe_beta_signups.whatsapp_country_code is
  'Dial code as collected, e.g. +91. Null for signups predating 2026-07-28.';

comment on column verified_vibe_beta_signups.whatsapp_number is
  'National number, digits only — no dial code, no leading trunk zero.';

comment on column verified_vibe_beta_signups.whatsapp_e164 is
  'Generated: dial code || national number. The form to dial or message.';;
