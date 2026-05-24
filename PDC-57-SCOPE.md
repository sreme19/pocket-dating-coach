PDC-57: ARCHETYPE-SPECIFIC VERIFICATION REQUIREMENTS
Scoped: 2026-05-24
Priority: High

WHAT THE TICKET ASKS FOR

The verification step 4 (spending_or_qa) currently routes by gender alone — men upload a spending screenshot, women answer Q&A. This needs to change. Verification requirements should differ per archetype. Most male archetypes need a Q&A that includes salary/income questions. Only casual_generous_man should ask for finance proofs (spending screenshot). Q&A questions should also be tailored to the intent of each archetype.


WHAT EXISTS TODAY

verify-step API (src/routes/api/verified-vibe/verify-step/+server.ts)
  Step 4 handler: handleSpendingOrQAVerification()
  Routes by gender: man → spending verification, woman/other → Q&A
  Accepts: { step, data: { spendingImage?, responses?, gender, mimeType? } }

SpendingQAStep.svelte (src/lib/verified-vibe/components/SpendingQAStep.svelte)
  Props: { gender, onSubmit, onCancel }
  Has question sets keyed by gender: man | woman | prefer_not_to_say
  Man questions: spending_comfort, dating_intent, lifestyle_values, relationship_timeline, deal_breakers
  Woman questions: date_expectations, partner_qualities, dating_intent, lifestyle_values, red_flags
  No archetype-specific branching exists today

Verify page (src/routes/verified-vibe/verify/+page.svelte)
  Already reads archetype from localStorage / Supabase profile
  Has archetypeData = $derived(ARCHETYPES[archetype]) available
  Does NOT currently pass archetype down to SpendingQAStep

constants.ts needs arrays (already partially correct):
  casual_generous_man:    ID + photos + Spending pattern + Q&A
  forever_focused_man:    ID + photos + Spending pattern + Q&A
  traditional_matrimony_man: ID + photos + Spending pattern + Q&A
  hopeless_romantic_man:  ID + photos + Q&A
  rebound_healing_man:    ID + photos + Q&A
  untouched_heart_man:    ID + photos + Q&A
  just_friends_man:       (check — likely ID + photos + Q&A)
  second_chapter_man:     (check — likely ID + photos + Q&A)
  All women:              ID + photos + Q&A


VERIFICATION MATRIX (post-ticket)

casual_generous_man
  Step 4: Finance proofs (spending screenshot) — keep existing spending verification path
  Rationale: this archetype signals wealth/generosity, proof-of-spending is the verification

traditional_matrimony_man, forever_focused_man, hopeless_romantic_man
  Step 4: Q&A with salary/income question included
  Rationale: serious relationship archetypes — women need to know if financial stability is real

second_chapter_man, rebound_healing_man, untouched_heart_man, just_friends_man
  Step 4: Q&A (no salary question required — lower financial signal expectations)

All women
  Step 4: Q&A (unchanged — keep existing woman question set)
  Future: can be expanded to archetype-specific in a follow-on ticket


ARCHETYPE-SPECIFIC Q&A QUESTION SETS

These replace the single gender-keyed set in SpendingQAStep.svelte.
The component's props change from { gender } to { archetype, gender } — archetype takes precedence for question selection, gender is fallback for unmapped archetypes.

traditional_matrimony_man
  1. income_range (multiple-choice) — "What's your approximate annual income range?"
     Options: Under $50k / $50k–$100k / $100k–$250k / $250k+
  2. marriage_timeline (multiple-choice) — "What's your marriage timeline?"
     Options: Within 1 year / 1–3 years / 3–5 years / When it's right
  3. family_plans (multiple-choice) — "What are your family plans?"
     Options: Want children / Open to children / No children / Already have children
  4. financial_values (text) — "Describe your approach to finances as a couple."
  5. deal_breakers (text) — "What would end a serious relationship for you?"

forever_focused_man
  1. income_range (multiple-choice) — "What's your approximate annual income range?"
     Options: Under $50k / $50k–$100k / $100k–$250k / $250k+
  2. relationship_goals (text) — "Describe what a long-term relationship looks like to you."
  3. stability_signals (multiple-choice) — "Which best describes your current life stability?"
     Options: Settled career and home / Building career, stable home / Transitioning but stable / Starting fresh
  4. partner_expectations (text) — "What do you need from a long-term partner?"
  5. deal_breakers (text) — "What are your non-negotiables in a serious relationship?"

hopeless_romantic_man
  1. income_range (multiple-choice) — "What's your approximate annual income range?"
     Options: Under $50k / $50k–$100k / $100k–$250k / $250k+
  2. connection_meaning (text) — "What does deep emotional connection mean to you?"
  3. past_relationship (multiple-choice) — "How would you describe your last relationship experience?"
     Options: Ended well, both grew / Painful but learned from it / Still healing / It's been a while
  4. love_language (multiple-choice) — "What's your primary love language?"
     Options: Words of affirmation / Quality time / Physical touch / Acts of service / Gifts
  5. partner_vision (text) — "Describe the partner you're hoping to meet."

second_chapter_man
  1. dating_intent (multiple-choice) — "What brought you back to dating?"
     Options: Ready for something new / Took time to heal, now open / Life changes created space / Just exploring
  2. life_stage (text) — "Briefly describe where you are in life right now."
  3. partner_expectations (text) — "What matters most to you in a new partner?"
  4. lifestyle_values (text) — "What lifestyle values are you bringing to a relationship?"
  5. deal_breakers (text) — "What won't work for you in a partner?"

rebound_healing_man, untouched_heart_man, just_friends_man
  Keep the existing man question set (spending_comfort, dating_intent, lifestyle_values, relationship_timeline, deal_breakers)
  These archetypes do not require salary disclosure — intent and lifestyle alignment is sufficient


IMPLEMENTATION PLAN

1. SpendingQAStep.svelte — swap gender-keyed to archetype-keyed

Change Props:
  Before: { gender?: Gender }
  After:  { archetype?: string; gender?: Gender }

Replace questionSets Record<Gender, Question[]> with:
  const questionSets: Record<string, Question[]> = {
    traditional_matrimony_man: [...],
    forever_focused_man: [...],
    hopeless_romantic_man: [...],
    second_chapter_man: [...],
    // fallback keys
    man: [...existing man questions...],
    woman: [...existing woman questions...],
    prefer_not_to_say: [...existing prefer_not_to_say questions...]
  };

Derivation:
  const questions = $derived(questionSets[archetype ?? gender ?? 'prefer_not_to_say'] ?? questionSets[gender ?? 'prefer_not_to_say']);

No UI changes — the component renders the same cards/text inputs regardless of which question set is active.

2. verify-step API — route by archetype for spending_or_qa

Change handleSpendingOrQAVerification signature to accept archetype:
  Before: const { spendingImage, responses, gender, mimeType } = data;
  After:  const { spendingImage, responses, gender, archetype, mimeType } = data;

Change routing logic:
  Before: const isMale = gender === 'man';
  After:  const needsSpendingProof = archetype === 'casual_generous_man';

  if (needsSpendingProof): → spending verification path
  else: → Q&A path (pass archetype to evaluateQAResponsesWithClaude)

3. evaluateQAResponsesWithClaude — pass archetype context to Claude

In src/lib/verified-vibe/server/verification.ts:
  Change signature: evaluateQAResponsesWithClaude(responses, gender, archetype?)
  In the Claude prompt, add archetype context:
    "Evaluate Q&A responses from a [archetype_name] archetype [gender] user. For archetypes that provided income answers, verify the response is plausible and consistent."

4. Verify page — pass archetype to SpendingQAStep and verify-step API call

In src/routes/verified-vibe/verify/+page.svelte:
  archetype is already read from localStorage / Supabase (line 10-24)
  Pass it to SpendingQAStep: <SpendingQAStep {archetype} {gender} ... />
  Include archetype in the verify-step API request body for spending_or_qa step

5. constants.ts needs arrays — align with matrix

Update the needs labels to match the actual new verification requirements:

  traditional_matrimony_man, forever_focused_man, hopeless_romantic_man:
    'Government ID (prove you\'re real)',
    '5+ photos (prove it\'s really you)',
    'Q&A with income details (prove your stability)'

  casual_generous_man:
    'Government ID (prove you\'re real)',
    '5+ photos (prove it\'s really you)',
    'Finance proof (prove you\'re solid)'

  All other archetypes:
    'Government ID (prove you\'re real)',
    '5+ photos (prove it\'s really you)',
    'Q&A responses (prove your intent)'


FILES TO CHANGE

  src/lib/verified-vibe/components/SpendingQAStep.svelte
    Add archetype prop, add archetype-keyed question sets, update $derived selector

  src/routes/api/verified-vibe/verify-step/+server.ts
    Accept archetype in request body, route spending_or_qa by archetype not gender, pass archetype to evaluateQAResponsesWithClaude

  src/lib/verified-vibe/server/verification.ts
    Update evaluateQAResponsesWithClaude signature to accept optional archetype, include in Claude prompt

  src/routes/verified-vibe/verify/+page.svelte
    Pass archetype to SpendingQAStep component and to the verify-step API call

  src/lib/verified-vibe/constants.ts
    Update needs arrays for affected archetypes


ACCEPTANCE CRITERIA

  User with archetype traditional_matrimony_man reaches step 4 → sees Q&A with income_range question
  User with archetype forever_focused_man reaches step 4 → sees Q&A with income_range question
  User with archetype hopeless_romantic_man reaches step 4 → sees Q&A with income_range question
  User with archetype casual_generous_man reaches step 4 → sees spending proof upload (no Q&A)
  User with archetype rebound_healing_man reaches step 4 → sees existing man Q&A (no income question)
  Women of any archetype reach step 4 → see existing woman Q&A (unchanged)
  verify-step API returns correct trust points for each path (same points, different content)
  Claude evaluation receives archetype context and uses it when assessing Q&A quality
  constants.ts needs arrays show accurate step labels for each archetype
  No regression on existing steps 1–3 (id, liveness, photos)


SCOPE BOUNDARIES (OUT OF SCOPE FOR THIS TICKET)

  Female archetype-specific Q&A customization — follow-on ticket
  Income verification via document upload (pay stubs, tax returns) — separate feature
  Changing trust point values per archetype — separate decision
  Women archetypes (traditional_matrimony_woman, forever_focused_woman) salary questions — not in this ticket
