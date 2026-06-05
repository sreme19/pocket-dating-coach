PDC-56: AI ASSISTANTS UPDATE THE PROFILE
Scoped: 2026-05-24 (updated to include photo upload + Pick Your Lane)

WHAT THE TICKET ASKS FOR

The user should be able to update their Verified Vibe profile by talking to AI Bestie (women) or AI Wingman (men) — without touching any buttons. A new "Update Preferences" chip triggers a guided chat mode where the AI interprets instructions like "change my bio", "I'm based in Dubai now", or "switch my lane to Hopeless Romantic" and applies the changes directly. This includes uploading profile photos via chat and selecting their archetype (Pick Your Lane).


WHAT EXISTS TODAY

AI Bestie chat (src/routes/verified-vibe/chat/ai-bestie/+page.svelte)
  Current chips: "Summarize my matches", "Fresh insights", "Configure Bestie"
  Intent types handled: 'summary' | 'insights' | 'configure'
  Already has an attach button (fileInputEl) that accepts image/* — currently used for match analysis, not profile photo upload

AI Wingman chat (src/routes/verified-vibe/chat/ai-wingman/+page.svelte)
  Current chips: "Summarize my matches", "New insights", "Upload proof"
  Intent types handled: 'summary' | 'insights' | 'upload'
  Upload proof flow uploads to POST /api/verified-vibe/artifacts (Supabase Storage, 'profiles' bucket)

Profile fields writable via upsertProfile (src/lib/verified-vibe/services/profileService.ts):
  first_name — display name shown on profile
  city — location
  about — bio paragraph
  looking — relationship intent statement
  archetype — see full list below
  avatar_url — lead/hero photo URL

Profile photos are currently stored in localStorage (vv_photos) as data URLs with 5 slots: lead, warmth, lifestyle, conversation, social. The lead photo URL is also mirrored in avatar_url in Supabase.

Supabase Storage bucket: 'profiles'
Existing upload pattern: POST /api/verified-vibe/artifacts (accepts FormData: file, userId, claimTag, description)

Full archetype list (src/lib/verified-vibe/constants.ts → ARCHETYPES_BY_GENDER):
  Men: traditional_matrimony_man, forever_focused_man, hopeless_romantic_man, second_chapter_man,
       casual_generous_man, rebound_healing_man, untouched_heart_man, just_friends_man
  Women: traditional_matrimony_woman, forever_focused_woman, hopeless_romantic_woman, second_chapter_woman,
         spoiled_casual_woman, rebound_healing_woman, untouched_heart_woman, just_friends_woman

autoUpdateProfile already exists in src/lib/server/ai-assistant-service.ts but runs in the background to extract implicit preferences. This feature is explicit and user-initiated.


WHAT CANNOT BE UPDATED VIA CHAT (restricted)

  gender — set at gate, immutable
  age — set during profile intake, immutable
  Verification steps (id, liveness, spending_or_qa) — gated flows, not editable
  trust_score — auto-calculated from verification records
  email — account-level field, not profile-level


IMPLEMENTATION PLAN

1. New chip in both chat pages

AI Bestie (ai-bestie/+page.svelte):
  Add to CHIPS array: { label: 'Update my profile', icon: '✏️', intent: 'update_profile' }
  Extend intent union: 'summary' | 'insights' | 'configure' | 'update_profile'
  Opening message (injected, no user bubble):
    "I can update your profile from here. You can change your name, city, bio, what you're looking for, your lane, and your photos. What would you like to change?"

AI Wingman (ai-wingman/+page.svelte):
  Add to CHIPS array: { label: 'Update preferences', icon: '✏️', intent: 'update_profile' }
  Extend intent union: 'summary' | 'insights' | 'upload' | 'update_profile'
  Opening message (injected, no user bubble):
    "You can update your profile from here — name, city, bio, what you're looking for, your lane, and your photos. What do you want to change?"

2. Photo upload via chat

Both AI Bestie and AI Wingman already have mechanisms for image attachment. The profile update mode needs to intercept attached images and route them to a new profile photo endpoint instead of the existing match-analysis or artifact upload paths.

New endpoint: POST /api/verified-vibe/profile-photo

Request: FormData
  file        File    — image file (jpeg/png/webp, max 10 MB)
  slot        string  — 'lead' | 'warmth' | 'lifestyle' | 'conversation' | 'social' (default: 'lead')

Server logic:
  a. Validate auth, file type, file size
  b. Upload to Supabase Storage: profiles/photos/{userId}/{slot}.{ext}  (upsert: true — replaces existing)
  c. Get public URL from storage
  d. If slot === 'lead': call upsertProfile({ avatar_url: publicUrl }) to update Supabase
  e. Return { url: string; slot: string; message: "Your [slot] photo has been updated." }

Chat page handling:
  When intent is 'update_profile' and the user attaches a file:
    If no slot mentioned in the message: ask "Which slot is this for? Lead (main profile photo), warmth, lifestyle, conversation, or social?"
    Once slot is known: POST to /api/verified-vibe/profile-photo with the file and slot
    Inject the returned URL into vv_photos in localStorage at the correct slot
    Confirm with the returned message

If intent is NOT 'update_profile' and the user attaches a file: keep existing behavior (match analysis for Bestie, nothing / redirect for Wingman).

3. Pick Your Lane (archetype) via chat

When the user says something like "switch me to Hopeless Romantic" or "what are my lane options?":

  The AI should:
    a. Recognize the update_profile intent for archetype
    b. If user asks for options: list the archetypes valid for their gender with their friendly names
       Use ARCHETYPES[id].name (e.g. 'hopeless_romantic_man' → "Hopeless-Romantic")
    c. Match the user's text to the closest valid archetype for their gender
       (fuzzy: "hopeless romantic" → hopeless_romantic_man, "traditional" → traditional_matrimony_man)
    d. Call profile-update endpoint with { archetype: matched_id }
    e. Confirm: "Done — your lane is now set to [Archetype Name]. [Archetype tag line]."

The archetype tag line comes from ARCHETYPES[id].tag. Include it in the confirmation so the user knows what they signed up for.

Validation: archetype must be from ARCHETYPES_BY_GENDER[user.gender]. If the user tries to pick a cross-gender archetype, decline and list valid options.

4. Core profile update endpoint

Create: src/routes/api/verified-vibe/profile-update/+server.ts

POST /api/verified-vibe/profile-update

Request body:
{
  "instruction": "Change my city to Dubai",
  "currentProfile": { "first_name": "...", "city": "...", "about": "...", "looking": "...", "archetype": "...", "gender": "..." }
}

The endpoint:
  a. Calls Claude with a structured extraction prompt to parse the instruction into a profile patch
  b. Validates: archetype must be in ARCHETYPES_BY_GENDER[gender]; about max 300 chars; looking max 200 chars
  c. Calls upsertProfile with the validated patch
  d. Returns:
     {
       "updated": { "city": "Dubai" },
       "restricted": [],
       "message": "Done — your city is now set to Dubai."
     }

Claude extraction prompt:
  System: "Parse a profile update instruction. Return JSON only.
    Updatable fields: first_name (string), city (string), about (string, max 300 chars), looking (string, max 200 chars), archetype (string, must match gender-specific list).
    Restricted fields: gender, age, photos (handled separately), verification steps, trust_score.
    Format: { \"updates\": { ...fields }, \"restricted\": [\"field if asked\"], \"needsClarification\": \"question if ambiguous\" }"
  User: the instruction text

If needsClarification is set: return it as the reply without calling upsertProfile.
If restricted fields are requested: include a clear explanation in the message field.

5. Handle 'update_profile' intent in message API routes

src/routes/api/ai-bestie/message/+server.ts
src/routes/api/ai-wingman/message/+server.ts

When intent === 'update_profile':
  If message is empty (chip just tapped): return opening message
  If message contains a photo attachment: route to profile-photo endpoint (see step 2)
  If message is text: route to profile-update endpoint (see step 4)
  Return the endpoint's message as the assistant reply

6. Update client state after changes

After profile-update returns successfully:
  Call user.set({ ...$user, ...updated }) immediately (optimistic update)
  Then call hydrateUserFromSupabase() in background to confirm

After profile-photo returns successfully:
  Update vv_photos in localStorage at the correct slot
  If slot === 'lead': also call user.set({ ...$user, avatar: url })

7. System prompt additions

Add to both buildAIBestieSystemPrompt and buildAIWingmanSystemPrompt:

  "PROFILE UPDATE MODE: When in profile update mode, you help the user update: name, city, bio (about), looking-for statement, lane (archetype), and profile photos. Gender, age, verification steps, and trust score cannot be changed through chat. Always confirm exactly what was changed. For archetype updates, include the archetype's tag line in your confirmation."


FILES TO CHANGE

  src/routes/verified-vibe/chat/ai-bestie/+page.svelte
    Add 'update_profile' chip, intent handler, photo routing in update_profile mode

  src/routes/verified-vibe/chat/ai-wingman/+page.svelte
    Add 'update_profile' chip, intent handler, photo routing in update_profile mode

  src/routes/api/ai-bestie/message/+server.ts
    Handle 'update_profile' intent — text and photo paths

  src/routes/api/ai-wingman/message/+server.ts
    Handle 'update_profile' intent — text and photo paths

  src/lib/server/ai-assistant-service.ts
    Add extractProfileUpdate(instruction, currentProfile, gender) function

  src/lib/prompts.ts
    Add profile update mode instructions to both system prompts

NEW FILES TO CREATE

  src/routes/api/verified-vibe/profile-update/+server.ts
    Core text update endpoint — Claude extraction + upsertProfile

  src/routes/api/verified-vibe/profile-photo/+server.ts
    Photo upload endpoint — Supabase Storage upload + avatar_url sync


WHAT THE AI SHOULD NOT DO

  Invent field values if the instruction is ambiguous — ask for clarification
  Silently fail — always confirm what happened, even on error
  Accept archetypes from the wrong gender
  Route profile photos to the artifacts endpoint (different purpose, different bucket path)
  Apply photo updates when not in update_profile intent mode


ACCEPTANCE CRITERIA

  Woman in AI Bestie chat taps "Update my profile" chip → opening message appears
  Man in AI Wingman chat taps "Update preferences" chip → opening message appears
  User types "Change my city to Kuala Lumpur" → city updates in DB → AI confirms
  User types "Update my bio to [text]" → about field updates → AI confirms
  User types "Switch my lane to Hopeless Romantic" → archetype updates → AI confirms with tag line
  User types "What are my lane options?" → AI lists all archetypes valid for their gender with friendly names
  User attaches a photo in update_profile mode → AI asks for slot if not specified → uploads to profile-photo endpoint → localStorage updated → lead photo syncs to avatar_url
  User attaches a photo in normal chat mode → existing behavior unchanged (no regression)
  User asks to change their age → AI declines and explains it is immutable
  After update, navigating to /verified-vibe/profile shows all new values immediately
  Free-text messages (no chip) in normal chat mode are unaffected — no regression


SCOPE BOUNDARIES (OUT OF SCOPE FOR THIS TICKET)

  Batch profile update ("update everything based on what I've told you") — separate ticket
  Undo / revision history — not required
  Verification step re-entry via chat — not required
  AI-generated photo enhancements via chat (already exists at /api/photo-enhance, separate flow)
