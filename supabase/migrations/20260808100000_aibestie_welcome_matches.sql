-- /aibestie requirement 9: a man who arrived from the advert gets more matches
-- automatically, without ever pressing "find match".
--
-- He cannot get them at signup. runMatchmakerForUser refuses anyone without an
-- ACTIVE pool entry, and a man fresh off the landing page has no liveness and no
-- photos — so a run fired at claim time returns needs_verification and does
-- nothing. The real moment is enrollInPoolIfVerified: the point where he becomes
-- matchable at all. This column is what lets that fire exactly once.
--
-- WHY A COLUMN AND NOT A COUNT OF HIS MATCHES. "Has he already been welcomed?"
-- looks answerable from verified_vibe_matches, but it isn't: he may match through
-- Discover, a referral or the nightly batch in between, and any threshold on that
-- count would either re-fire for a man whose matches came from elsewhere or skip a
-- man who earned his own. A stamp records what WE did.

alter table aibestie_lp_sessions
  add column if not exists welcome_matched_at timestamptz;

comment on column aibestie_lp_sessions.welcome_matched_at is
  'When the system-initiated welcome matchmaker runs fired for the member who claimed this conversation. Stamped BEFORE the runs, as a claim on the work: re-firing would spend Claude calls and hand him duplicate matches, which is worse than a crashed run never being retried.';
