# Pocket Dating Coach — User Journey Redesign Steering Document

**Status:** Design Phase  
**Owner:** sreme19  
**For:** Claude Design (UX/UI mockups, flows, interactions)  
**Date:** May 17, 2026

---

## Executive Summary

**Current Problem:** Pocket Dating Coach's male profile journey (`Home → Quiz → Intake → Chat → Review → Share`) mirrors generic profile builders and reinforces the "dating app marketplace" problem that Gen Z actively resents.

**Redesign Goal:** Reposition PDC from "profile builder" to **"anti-swipe coach"** — a tool that fixes the root causes of dating app fatigue and builds authentic, connection-first profiles.

**New Positioning:** *"Stop swiping blind. Get the profile that attracts your people."*

---

## Part 1: Context & Research

### Why Gen Z Hates Dating Apps (Top 10 Unfiltered Reasons)

1. **Swipe fatigue is real** — 79% of Gen Z report dating app burnout
2. **Feels like a marketplace** — "You're shopping, but for a guy" — gamification makes people feel like products
3. **Nobody actually pays** — Users swipe, match, ghost. Want connection but spend $0
4. **Conversations go nowhere** — 24% blame repetitive, dead-end convos that fizzle
5. **They want friends, not just dates** — 30%+ use apps to build social circles
6. **Simultaneous intentions** — Top three: "Fun," "Relationship," "Hook Up" — often all at once
7. **Safety is a genuine concern** — Unsolicited images, lying about intentions, unwanted contact
8. **They secretly want commitment** — 50%+ Gen Z seeking marriage/monogamy, but won't admit publicly
9. **Sexual fluidity reshaping behavior** — 30% LGBTQ+, driving toward inclusive platforms
10. **IRL > apps** — Gen Z values meeting naturally, even though most found partners via apps (reluctantly)

### Current PDC Position: The Problem

- **Existing journey:** Home → Vibe Quiz → Intake → Chat → Review → Share
- **Weakness:** Feels like another profile form (reinforces marketplace problem)
- **Copy:** "Build your dating profile" — same as every other app
- **Focus:** Photos + text → not addressing why conversations fail, safety concerns, mixed intentions
- **Missing:** Coaching on what actually works (conversations, red flags, IRL transition)

### Opportunity: Be the Anti-Swipe App

- **Coaching, not shopping** — Teach users what works, not just collect their data
- **Authenticity first** — Emphasize story + values over looks + marketplace vibes
- **Multiple intention types** — Dating, friends, commitment (hidden), casual — all addressable
- **Safety built-in** — Boundaries + red flag spotting, not an afterthought
- **IRL bridge** — Coach them on moving from app to real life

---

## Part 2: Design Principles

### 1. **Anti-Marketplace Positioning**
- ❌ Don't feel like "upload your best photos and wait to be chosen"
- ✅ Feel like "tell your real story and connect with people who get you"

### 2. **Clarity Before Profile**
- ❌ Don't ask "what photos do you have?"
- ✅ Ask "what are you actually looking for?" first

### 3. **Authenticity Over Perfection**
- ❌ Don't reward "best angle" or "highlight reel" thinking
- ✅ Celebrate weirdness, specificity, real stories

### 4. **Coaching, Not Collecting**
- ❌ Don't just gather info and bounce them to the app
- ✅ Teach them conversation openers, red flag spotting, how to move IRL

### 5. **Safety as Default**
- ❌ Don't add safety as a checkbox at the end
- ✅ Make boundaries, red flags, and safety signals core to the profile

### 6. **Hidden Depth for Secret Needs**
- ❌ Don't judge people for wanting commitment while appearing casual
- ✅ Let them signal their real intentions privately (matched with others who also selected it)

---

## Part 3: New User Journey (5 Gates)

### **Gate 1: Intention Clarity**
**Purpose:** Personalize the journey based on what they actually want (not generic)

**Key Questions:**
```
"What are you actually looking for right now?"
○ Serious relationship
○ Casual dating / Hookups
○ Making friends / Community
○ All of the above

"What's your safety priority?"
○ Not getting ghosted
○ Avoiding creeps / red flags
○ Finding someone genuine
○ Meeting IRL quickly

"How do you feel about dating apps?"
○ Love them (I'm built in)
○ Tolerate them (I need help)
○ Hate them (but I use them anyway)
```

**Why This Gate?**
- Addresses: "mixed intentions," "safety concerns," "secret commitment"
- Personalizes: Profile language, coaching, feature visibility
- Builds: Investment (they've already thought through what they want)

**Design Notes:**
- Large, bold buttons (not radio boxes)
- Emoji reactions per answer (Gen Z preference)
- Progressive disclosure (show next Q based on previous A)
- Save to `pdc_profile.intentions` for downstream personalization

---

### **Gate 2: Anti-Marketplace Profile**
**Purpose:** Replace generic photo/prompt story with authentic narrative

**Sections (In This Order):**

#### A. **Photos** (De-emphasized, but required)
```
Upload 3-5 photos
"No need for the most flattering angle. Just be you."

Labels:
○ Main (just you, good lighting)
○ Lifestyle (doing something fun)
○ Hobby (your thing)
○ Group (with friends)
○ Close-up (face/smile)
```

**Design Note:** Photos section is smaller, grayer, less prominent than text sections. Opposite of Tinder/Hinge where photos are hero.

---

#### B. **Your Real Story** (HERO SECTION)
```
"What's something you'd tell a close friend, not a dating app?"

Textarea:
- Hobby, passion, weird thing you do
- Pet peeve, unpopular opinion, real goal
- Avoid: "I love hiking" (generic)
- Target: "I'm weirdly obsessed with trail names"

Tone guide: "Specific beats generic. Weird beats perfect."
Word count: 100-300 chars
```

**Design Note:**
- Large, prominent textarea
- Real examples shown on hover/focus
- Character count encouraged (not limited)
- Different label + placeholder based on intention (e.g., if "hookup": "What should someone know upfront?", if "relationship": "What does your ideal week look like?")

---

#### C. **Red Flags You Avoid** (NEW)
```
"I don't vibe with people who..."

Examples:
- "...are on their phone all dinner"
- "...say 'I don't have close friends'"
- "...need me to text back immediately"

Tone guide: "Be honest. Boundaries attract boundaried people."
Word count: 3-5 phrases, 10-50 chars each
```

**Design Note:**
- Bullet list, not paragraphs
- Example red flags pre-filled (they can delete/edit)
- Each item has an X to remove
- "Add another" button to add custom ones

---

#### D. **Safety Signals** (NEW)
```
"Things that matter to me:"

Checkboxes (multi-select):
☐ Has real friends / close relationships
☐ Can laugh at themselves
☐ Wants to meet IRL eventually
☐ Values honesty over charm
☐ Has their life figured out (mostly)
☐ Respects boundaries
☐ [Custom option to write]
```

**Design Note:**
- Visualize as tags/pills, not checkboxes
- Color: emerald or rose (positive, safety vibe)
- Show up in final profile as "What matters: Friends, Honesty, IRL soon"

---

### **Gate 3: Conversation Mastery**
**Purpose:** Teach them what actually works before they swipe

**Three Sections:**

#### A. **Your Openers** (Generated by Claude)
```
"Based on your profile, here's how people could start a convo with you:"

3-5 example openers, generated:
- Specific to their story/interests
- Not generic ("Hey!")
- Gives them a template to respond to

E.g.:
- "The trail name obsession is killing me — do you have a go-to?"
- "What's your most controversial hobby opinion?"
- "Meet IRL soon or test the waters first?"
```

**Design Note:**
- Show in quote cards
- "Copy" button under each
- "Try this opener" CTA if they want to start conversation

---

#### B. **Red Flag Spotting** (Checklist + Education)
```
"What to watch for in early messages:"

Red flags (with explanations):
🚩 Asks for photos before real conversation
   Why it matters: Treating you as image, not person
   
🚩 Won't answer direct questions
   Why it matters: Avoids vulnerability, hiding something
   
🚩 Love-bombs after 2 messages
   Why it matters: Lovebombing ≠ genuine interest, classic manipulation
   
🚩 Pushes physical too fast
   Why it matters: Clear about intentions, but maybe not YOUR intentions
   
🚩 Refuses to meet IRL after 5+ messages
   Why it matters: Might be catfishing, not serious, or just collecting matches
```

**Design Note:**
- Interactive cards (click to reveal explanation)
- Emoji + red text for visual clarity
- Educational tone (not preachy)
- Actionable next steps ("If you see this, move on or ask directly")

---

#### C. **App → IRL Bridge** (Guidance)
```
"When to suggest meeting + how to stay safe:"

Timeline:
3-5 good messages → "Want to grab coffee?" (if vibes are good)
5-7 messages max → Move to text/phone (get their real number)
Phone call/video → Decide on meetup

Safety checklist before first date:
☐ Tell a friend where you're going + who with
☐ Share location live with trusted person
☐ Video call first (quick verification)
☐ Meetup in public (café, bar, park)
☐ Trust your gut (if something feels off, it probably is)
☐ Have an exit strategy (own transport, not trapped)
```

**Design Note:**
- Timeline graphic (visual flow)
- Checkbox items (actionable)
- Short, punchy copy
- Emphasize: "Safety isn't boring, it's smart"

---

### **Gate 4: Friend-Mode Toggle** (OPTIONAL)
**Purpose:** Address that 30% use apps for friends, not just dating

**UI:**
```
"Also open to making friends?"

○ Yes (show friend vibe section)
○ No (skip to next)
○ It's complicated (friends first, maybe more)
```

**If YES:**
```
FRIEND VIBE SECTION (appears in profile)

"What kind of friendship vibe are you?"
- Looking for hiking buddies
- Into late-night conversations
- Sports league / activity friends
- Platonic hanging (brunch, concerts, etc.)
- Build a crew

"Friendship signals:"
☐ Good listener
☐ Can make plans stick
☐ Adventurous
☐ Meme-haver
☐ Non-judgmental
```

**Design Note:**
- Separate from dating section (clear distinction)
- Different color scheme (blue instead of rose)
- Own preview card ("Friend vibe")
- Badge on final profile if selected

---

### **Gate 5: Safety First & Hidden Depth**
**Purpose:** Set boundaries + signal private intentions (commitment)

**A. Boundary Setting**
```
"What does a respectful first conversation look like to you?"

Text inputs (optional):
- "I don't appreciate..." 
- "Please don't..."
- "I value..." (shown publicly as signal)

Examples:
- "I don't appreciate unsolicited photos"
- "I value people who can take no for an answer"
- "I need someone respectful about my time"
```

**Design Note:**
- Honest tone (not defensive, just clear)
- Only the positive framing shown in profile ("I value...")
- Negative framing kept private but alerted to Claude for filtering

---

**B. Hidden Commitment Signal** (CRUCIAL FOR #8)
```
"What are you actually looking for?" (PRIVATE)

Radio (not visible to browsers, only to matches):
○ Casual dating only
○ Open to casual or serious
○ Looking for something serious / LT relationship
○ Not sure yet

Logic:
- If two people both select "serious," they're matched together
- But they don't broadcast it (appears casual to outside)
- Solves: "50% secretly want commitment but won't admit publicly"
```

**Design Note:**
- Hidden from profile view (only visible to matches)
- Never shown in "explored by X people" stats
- Private, non-judgmental
- Solves the paradox of Gen Z wanting commitment but appearing casual

---

## Part 4: Profile Generation & Review

### **Claude Integration Points**

#### A. **Personalized Prompts per Intention**
```
If intention = "Relationship":
  "Tell me about your values"
  "What does a good partner look like?"
  "Where do you see this going?"

If intention = "Casual":
  "What makes someone fun to hang with?"
  "What are you looking for right now?"
  "How do you feel about being direct?"

If intention = "Friends":
  "What kind of friend are you?"
  "What activities do you love?"
  "How do you build friendships?"
```

#### B. **Generated Profile JSON Structure**
```json
{
  "headline": "...",
  "story": "...",
  "redFlags": ["...", "..."],
  "safetySignals": ["...", "..."],
  "conversationStarters": ["...", "..."],
  "friendVibe": "...", // optional
  "whyThisProfile": "Based on your story about [specific thing], your values around [specific thing], and your intention for [specific thing]...",
  "citations": [...]
}
```

#### C. **Tone Adjustments per Intention**
- **Relationship:** Sincere, intentional, depth-focused
- **Casual:** Playful, direct, fun-forward
- **Friends:** Warm, inviting, activity-oriented

---

## Part 5: Final Profile Display & Export

### **Profile Card Structure**
```
[HEADER]
Headline (big, gradient text)

[STORY]
Your real story (2-3 sentences)

[SIGNALS]
Safety Signals: Has real friends, Values honesty, Wants IRL
Red Flags Avoided: Unsolicited photos, Not over their ex

[OPENERS]
"People could start a conversation with:"
- "..."
- "..."

[FRIEND VIBE] (if selected)
"Also looking for friends — hiking, concerts, brunch crew"

[FOOTER]
"Built with Pocket Dating Coach"
```

### **Actions**
- **Download as PNG** (shareable, viral)
- **Copy to clipboard** (paste into Hinge/Bumble/Tinder bio)
- **Share link** (read-only public preview)

---

## Part 6: Key Differentiators vs. Current

| Dimension | Current | Redesigned |
|-----------|---------|-----------|
| **Positioning** | "Build your profile" | "Stop swiping blind" |
| **First question** | "What's your vibe?" | "What are you actually looking for?" |
| **Hero section** | Photos + captions | Your real story |
| **New sections** | None | Red flags, safety signals, friend vibe, hidden commitment |
| **Tone** | Generic coaching | Anti-marketplace, anti-burnout |
| **Coaching** | Generated profile | Profile + openers + red flag spotting + IRL bridge |
| **Safety** | Not addressed | Core to every section |
| **Community** | Dating only | Dating + friends + hidden commitment |

---

## Part 7: UX/Flow Requirements for Design

### **Homepage Redesign**
**Current:** Simple CTA to vibe quiz  
**Redesigned:** Hero + 4 feature cards + CTA

```
HERO:
"You're not shopping for a partner.
You're looking for your person.

Let's fix your profile so they find YOU."

[Start Now]

FEATURE CARDS:
✨ Authentic, not Airbrushed
   Your real story, not a highlight reel

🚩 Red Flags First
   Teach you what to spot early

💬 Conversations that Work
   Openers that actually connect

🛡️ Safety by Design
   Boundaries built in from day one

🤝 Friends or Dating?
   Tell us what you're really looking for
```

**Design Notes:**
- Dark mode, rose/amber accents (Gen Z aesthetic)
- Large, readable fonts
- Emoji + short copy
- Mobile-first (most users on phone)

---

### **Gate Flows**
- **Gate 1** (Intention): Single-screen questionnaire, progressive disclosure
- **Gate 2** (Profile): Multi-section form, different visual emphasis per section (photos small, story big)
- **Gate 3** (Coaching): 3-tab interface (Openers | Red Flags | IRL Bridge)
- **Gate 4** (Friends): Toggle + optional new section
- **Gate 5** (Safety): Multi-input form + hidden commitment radio
- **Review:** Full-page profile with edit buttons per section
- **Export:** Card preview + download/share buttons

---

### **Personalization Hooks**
- **Intention affects:** Textarea labels, Claude prompts, profile tone, coaching focus
- **Safety priority affects:** Visibility of red flag section, emphasis on IRL timeline
- **Feeling about apps affects:** Copy tone (help vs. empathy vs. playfulness)

---

## Part 8: Copy Tone & Voice

### **Tone Profile**
- **Gen Z:** Direct, playful, emoji-aware, anti-cringe
- **Authentic:** Real, honest, no BS, validating
- **Coaching:** Helpful, non-judgmental, empowering
- **Anti-marketplace:** People-first, not product-first

### **Example Copy Variations**

**Generic (❌):**
"Upload a photo and write something interesting"

**PDC (✅):**
"Just be you. The lighting doesn't need to be perfect."

---

**Generic (❌):**
"Tell us what you're looking for in a match"

**PDC (✅):**
"What are you actually looking for right now? (Relationship, casual, friends, all of it — all valid.)"

---

**Generic (❌):**
"Complete your profile to start swiping"

**PDC (✅):**
"Your profile is ready. Now stop swiping and let them find you."

---

## Part 9: Success Metrics (For Future Validation)

**Hypothesis: Fixing dating app fatigue → higher engagement + longer conversations → more IRL meetups**

- **Completion rate:** % of users who finish all 5 gates (target: 85%+, vs. 60% for current flow)
- **Profile sharing:** % of users who download/share card (target: 60%+)
- **Conversation quality:** Avg message length in post-PDC conversations (target: +40% words)
- **Safety**: % of users who report feeling safer (survey post-generate)
- **Intention clarity:** % of users who feel more confident about what they want (survey)
- **App-to-IRL:** % who move to IRL meetup within 1 week (target: 55%+)

---

## Part 10: Open Questions for Design

1. **Visual system:** How prominent should safety signals be vs. red flags? (Alert tone or positive tone?)
2. **Mobile vs. Desktop:** Should gates be full-screen modal or scrolling single page?
3. **Photos section:** How do we de-emphasize without making them feel less important? (Gray it out? Move to end?)
4. **Friend vibe:** Should it be a separate profile or integrated with dating profile? (Current design: separate)
5. **Hidden commitment:** Should we show a "Private" badge to users so they know it's hidden?
6. **Profile preview:** Should they see the final card before download, or just text preview?
7. **Edit modal:** Same design as current inline edits, or new design?
8. **Mobile photo upload:** How to handle multiple photo uploads on phone? (Batch vs. one-at-a-time?)

---

## Part 11: Implementation Notes

### **For Claude Builders (Later Phase)**
- All 5 gates feed into **Claude profile generation prompt** (personalized per intention)
- **Intention + Safety Priority + Boundaries** all go into Claude context
- **Red flags & safety signals** inform match filtering logic (Phase 2 feature)
- **Hidden commitment** requires new DB schema field (not visible to swipe algorithm)
- **Friend vibe** optional, but should appear in profile if selected

### **No Breaking Changes**
- Existing features (Ask Coach, Profile Review, Chat Analyzer, Reply Suggester) untouched
- Male profile journey is separate from female journey
- Supabase schema: add `intentions`, `redFlags`, `safetySignals`, `friendVibe`, `hiddenIntention`, `boundaries`

---

## Part 12: Timeline & Phases

### **Phase A: Design** (This doc → Claude Design mockups)
- Wireframes (mobile + desktop)
- Interaction flows
- Copy finalization
- Component library

### **Phase B: Frontend Build** (Claude Builders)
- Implement 5 gates with new flow
- Update homepage hero + cards
- Responsive design (mobile-first)
- Build new form components

### **Phase C: Claude Integration** (Claude Builders + Anthropic team)
- Update `buildMaleProfileGenerationPrompt()` for personalization
- Test Claude output per intention type
- Tune tone + citations per profile type

### **Phase D: Testing & Launch**
- QA all gates, edge cases
- User testing (Gen Z feedback)
- Deploy to Vercel
- Monitor completion rates + engagement

---

## Appendix A: Competitive Positioning

**vs. Tinder:**
- Tinder emphasizes photos; we emphasize story
- Tinder gamifies swiping; we coach on real connection
- Tinder's problem: shallow, marketplace feel; our solution: authenticity + safety

**vs. Hinge:**
- Hinge: "App designed to be deleted" (relationship-focused, but generic)
- PDC: "Stop swiping. Get coached." (intention-agnostic, but deeply personalized)

**vs. Bumble:**
- Bumble: Women message first (power structure fix)
- PDC: Better profile + coaching (quality over quantity)

---

## Appendix B: Gen Z Copy Examples

### **Do:**
- "No need for the most flattering angle. Just be you."
- "It's okay to want a relationship. Stop hiding it."
- "What would be a dealbreaker for you? Be honest."
- "Weird beats perfect."

### **Don't:**
- "Craft the perfect bio"
- "Show off your best self"
- "Let us analyze your profile"
- "Optimize your chances"

---

## Sign-Off

This redesign flips the narrative from **"help users compete in a marketplace"** to **"help users build authentic connections."**

It's not just a UI refresh—it's a positioning shift that addresses why Gen Z actually hates dating apps, while still providing the tools to succeed within them.

**Ready for Claude Design to build mockups and interaction flows.**

Questions? Open an issue or Slack sreme19.
