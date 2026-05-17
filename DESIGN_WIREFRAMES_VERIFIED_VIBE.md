# Verified Vibe — Design Wireframes & Specifications

**Phase 1 MVP**  
**Archetypes:** Casual Man, Spoilt Woman, Marriage-Minded Man, Safety-First Woman  
**Artifacts:** Photos, Q&A, Bank Statement, Government ID  
**Status:** Ready for Claude Design mockups

---

## **Design System (Dark Mode, Gen Z Aesthetic)**

### **Colors**
- **Background:** `#0f172a` (slate-950)
- **Surface:** `#1e293b` (slate-800)
- **Accent (Trust):** `#10b981` (emerald) — trust/verification theme
- **Warning:** `#f97316` (orange) — needs action
- **Error:** `#ef4444` (red) — failed verification
- **Text Primary:** `#f1f5f9` (slate-100)
- **Text Secondary:** `#94a3b8` (slate-400)

### **Typography**
- **Headlines:** SF Pro Display, 32px bold (hero), 24px bold (section)
- **Body:** -apple-system, 16px regular
- **Small:** 14px, slate-400
- **Mono:** 12px (bank statement numbers redacted as `XXXX`)

### **Components**
- **Buttons:** 48px tall (tap target), 16px rounded, emerald or slate
- **Cards:** 12px rounded, border: 1px slate-700
- **Progress:** Linear bar, emerald fill, slate-800 background
- **Badges:** 6px rounded pill, compact

---

## **Screen 1: Home — Archetype Selector**

### **Purpose**
First screen on app open. User selects their archetype. No account creation yet.

### **Visual Layout**
```
┌─────────────────────────────────────────┐
│                                         │
│     Verified Vibe                       │
│     Trust First                         │
│                                         │
│  "What brings you here?"                │
│  (subheading) Pick the one that's you   │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ 🎯 Casual Man                    │  │
│  │ ────────────────────────────     │  │
│  │ Want casual dating & connection  │  │
│  │                                  │  │
│  │           [Learn More ↓]         │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ 💎 Spoilt Woman                  │  │
│  │ ────────────────────────────     │  │
│  │ Want to be treated like royalty  │  │
│  │                                  │  │
│  │           [Learn More ↓]         │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ 💍 Marriage-Minded Man           │  │
│  │ ────────────────────────────     │  │
│  │ Looking for serious & forever    │  │
│  │                                  │  │
│  │           [Learn More ↓]         │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ 🛡️  Safety-First Woman           │  │
│  │ ────────────────────────────     │  │
│  │ Need verified, non-creep vibes   │  │
│  │                                  │  │
│  │           [Learn More ↓]         │  │
│  └──────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

### **Card Specifications**

**Each archetype card:**
- Height: 120px
- Border: 1px slate-700, no fill
- Hover: border → emerald (subtle highlight)
- Icon: 40px, emoji or custom SVG
- Title: 18px bold, white
- Subtitle: 14px, slate-400
- Button: "Learn More ↓" text link, slate-400 → emerald on hover

**Tap interaction:**
- Tap card → Expand modal OR navigate to `Archetype Learn` screen
- Modal shows: Icon, full name, compatible match, what you need to verify

---

### **Archetype Card Details (Expanded)**

```
┌─────────────────────────────────────────┐
│                                         │
│  Casual Man                             │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  What it means:                         │
│  You want casual dating & connection.   │
│  No pretense. Real vibes.               │
│                                         │
│  You'll match with:                     │
│  🎯 Spoilt Woman (primary)              │
│  💍 Marriage-Minded if she's open       │
│                                         │
│  You'll need to verify:                 │
│  ✓ Government ID (prove you're real)    │
│  ✓ 5+ photos (prove it's really you)    │
│  ✓ Spending pattern (prove you're solid)│
│  ✓ Q&A responses (prove your intent)    │
│                                         │
│  Takes ~10 minutes                      │
│                                         │
│     [This is Me] [Back]                 │
│                                         │
└─────────────────────────────────────────┘
```

**Modal/Screen specs:**
- Title: 24px bold, emerald gradient text
- Sections: left-aligned, 16px spacing
- Checkboxes: emerald when verified
- CTA buttons: [This is Me] full-width emerald, [Back] slate

---

## **Screen 2: Intent Declaration**

### **Purpose**
Confirm user understands the archetype commitment before onboarding.

### **Visual Layout**
```
┌─────────────────────────────────────────┐
│                                         │
│  You're a Casual Man                    │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  Here's what that means on Verified     │
│  Vibe:                                  │
│                                         │
│  ✓ You want casual dating & real        │
│    connection — no games                │
│                                         │
│  ✓ You'll only match with women who     │
│    also chose casual (or are open to)   │
│                                         │
│  ✓ Your profile will show:              │
│    - Your real identity (verified ID)   │
│    - Your spending habits (restaurant,  │
│      travel, entertainment)             │
│    - Your photos (proven same person)   │
│    - Your answers (proven honest)       │
│                                         │
│  ✓ We'll give you a trust score (0-100) │
│    Higher score = more matches          │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  Ready to prove you're the real deal?   │
│                                         │
│        [Yes, This is Me]                │
│        [← Go Back]                      │
│                                         │
└─────────────────────────────────────────┘
```

### **Specifications**
- Title: 24px bold
- Body: 16px, left-aligned, 24px line height
- Checkmarks: emerald, small
- CTAs: [Yes] full-width emerald, [Back] ghost slate

---

## **Screen 3: Profile Builder — Artifact Checklist**

### **Purpose**
Step-by-step guided upload of all artifacts with real-time AI status.

### **Visual Layout**
```
┌─────────────────────────────────────────┐
│                                         │
│  Build Your Profile                     │
│  Complete: 0/4 artifacts                │
│                                         │
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░ 0%    │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  ✓ Government ID                        │
│  Let's verify you're real. Takes 30 sec │
│  [Start Upload]                         │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  ○ Bank Statement (3 months)            │
│  We'll see where you spend on dates.    │
│  Spending details shown, not amounts.   │
│  [Start Upload] (locked)                │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  ○ 5+ Photos                            │
│  Prove it's really you. Same person     │
│  in every shot.                         │
│  [Start Upload] (locked)                │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  ○ Q&A Responses                        │
│  Answer what matters to you.            │
│  [Start Q&A] (locked)                   │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  Tips:                                  │
│  • Go in order — each unlocks the next  │
│  • Verification is instant (under 60s)  │
│  • All info is private until you say OK │
│                                         │
└─────────────────────────────────────────┘
```

### **Specifications**

**Progress Bar:**
- Full width, 8px height, emerald fill
- Animated (0% → 100% as artifacts complete)

**Artifact Item Card:**
- 100px height, border: 1px slate-700
- Left: Icon + title (18px) + description (14px slate-400)
- Right: Status indicator or CTA button
- Locked artifact: opacity 0.5, button disabled

**Status Indicators:**
- `✓ Completed` — emerald checkmark, "Verified"
- `⏳ Pending...` — orange spinner, "Checking"
- `✕ Failed` — red X, "Try again"

**CTA Buttons:**
- `[Start Upload]` — emerald, full-width on tap
- `[Locked]` — slate, disabled
- `[Retry]` — orange (if failed)

---

## **Screen 4: Upload ID + Liveness Check**

### **Purpose**
Verify user's government ID and prove they're a real person (liveness).

### **Visual Layout**

**Step 1: ID Upload**
```
┌─────────────────────────────────────────┐
│                                         │
│  Verify Your Identity                   │
│                                         │
│  Step 1 of 2: Government ID             │
│  ────────────────────────────────────  │
│                                         │
│  Take a clear photo of your:            │
│  • Passport, driver's license, or       │
│  • National ID card                     │
│                                         │
│  Make sure you can see:                 │
│  ✓ Your face (clear & centered)         │
│  ✓ ID number (visible but not blurred)  │
│  ✓ Expiry date (not expired)            │
│  ✓ Security features (holograms, etc.)  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  📷 Take a Photo                │   │
│  │     (or upload from gallery)    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  We'll verify your ID in <60 seconds.   │
│  No data is stored — only that you're   │
│  a real person.                         │
│                                         │
└─────────────────────────────────────────┘
```

**Step 2: Liveness Check**
```
┌─────────────────────────────────────────┐
│                                         │
│  Step 2 of 2: Prove You're Real         │
│                                         │
│  Look at your phone camera and follow   │
│  the instructions below.                │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  [Live video preview box]               │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  Instruction: "Tilt your head left"     │
│  (or "Nod", "Smile", etc. — randomized)│
│                                         │
│  ⏱️  3 challenges, ~30 seconds total    │
│                                         │
│  [Start Liveness Check]                 │
│                                         │
│  Why this? It proves you're not a bot   │
│  or a fake photo.                       │
│                                         │
└─────────────────────────────────────────┘
```

**Step 3: Verifying**
```
┌─────────────────────────────────────────┐
│                                         │
│  Verifying Your ID...                   │
│                                         │
│  [⏳ Spinner]                            │
│                                         │
│  Checking:                              │
│  ⏳ ID format & authenticity            │
│  ⏳ Face match (ID photo ↔ your selfie) │
│  ⏳ Liveness check (you're real)         │
│                                         │
│  Takes <60 seconds                      │
│                                         │
└─────────────────────────────────────────┘
```

**Step 4: Success**
```
┌─────────────────────────────────────────┐
│                                         │
│  ✓ ID Verified!                         │
│                                         │
│  Your identity is confirmed.            │
│  +35 trust score points                 │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  What we verified:                      │
│  ✓ Real government ID (not fake)        │
│  ✓ You're a real person (liveness OK)   │
│  ✓ Face matches ID (same person)        │
│                                         │
│  Your ID details are encrypted &        │
│  private. No one sees your ID number.   │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│        [Next: Photos]                   │
│                                         │
└─────────────────────────────────────────┘
```

### **Specifications**

**ID Upload:**
- Large tap zone (200px height, centered)
- Camera + upload icons
- Copy: clear, reassuring, brief

**Liveness Video:**
- Full-width video preview, centered
- Border: 2px emerald (when recording)
- Instructions: 24px bold, emerald
- Real-time feedback: animated spinners

**Loading State:**
- Spinner icon, rotating emerald
- Checklist items animate in as verified

**Success Card:**
- Emerald checkmark, 60px
- Green/emerald background (light), text white
- Trust score increment highlighted

---

## **Screen 5: Upload Photos + Face Consistency Check**

### **Visual Layout**

**Step 1: Multi-Photo Upload**
```
┌─────────────────────────────────────────┐
│                                         │
│  Upload Your Photos                     │
│  Requirement: 5+ photos (same person)   │
│                                         │
│  Progress: 0/5 photos                   │
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░ 0%    │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  Different settings, same you:          │
│  ☐ One casual (t-shirt, everyday)       │
│  ☐ One nice (dressed up)                │
│  ☐ One activity (hobby/outdoor)         │
│  ☐ One with friends (social proof)      │
│  ☐ One close-up (face/smile)            │
│  ☐ (Optional) One more for variety      │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  Why this? Face recognition checks if   │
│  it's really you in every photo.        │
│                                         │
│  [Add Photos] (drag & drop or tap)      │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  Added photos:                          │
│  [photo 1]  [photo 2]  [photo 3]        │
│                                         │
│  [📱 + icon] [📱 + icon] [📱 + icon]   │
│  (showing thumbnails with status)       │
│                                         │
└─────────────────────────────────────────┘
```

**Photo Thumbnail Cards (While Uploading):**
```
┌──────────┐
│ [Photo]  │  Status: ⏳ Checking...
│          │  (Verifying face match)
│ ↺ Retry  │
└──────────┘

STATES:
✓ Verified — green check, text "Consistent"
⏳ Checking — orange spinner, text "Verifying..."
✕ Failed — red X, text "Try again" (retry button)
```

**Step 2: Face Consistency Verification**
```
┌─────────────────────────────────────────┐
│                                         │
│  Verifying Photos...                    │
│                                         │
│  Checking if it's really you in every   │
│  photo.                                 │
│                                         │
│  ⏳ Photo 1: Checking...                 │
│  ✓ Photo 2: Verified                    │
│  ⏳ Photo 3: Checking...                 │
│  ⏳ Photo 4: Pending                     │
│  ⏳ Photo 5: Pending                     │
│                                         │
│  Takes <60 seconds for all photos       │
│                                         │
│  [⏳ Spinner]                            │
│                                         │
└─────────────────────────────────────────┘
```

**Step 3: Success**
```
┌─────────────────────────────────────────┐
│                                         │
│  ✓ All Photos Verified!                 │
│  +20 trust score points                 │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  What we confirmed:                     │
│  ✓ Same person in all 5 photos          │
│  ✓ No fake/AI-generated photos          │
│  ✓ Face clearly visible in each         │
│                                         │
│  Grooming signal: Well-groomed ✓        │
│  (This helps your trust score)          │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│        [Next: Bank Statement]           │
│                                         │
└─────────────────────────────────────────┘
```

### **Specifications**

**Upload Zone:**
- 200px height, dashed border slate-700, center-aligned
- Hover: border → emerald, background slate-800/50
- Drag-over: glow emerald, text change to "Drop here"
- Icon: 60px, slate-600

**Thumbnail Gallery:**
- Grid: 3 columns (mobile) → 4 columns (tablet)
- Each: 120px × 120px, 8px rounded, border slate-700
- Status badge: 32px emerald/orange/red circle in top-right corner
- Hover: border → emerald, slight scale up
- Long-press or tap: delete option appears

**Status Badges (absolute positioned, top-right):**
- ✓ Green circle with white checkmark
- ⏳ Orange circle with spinner
- ✕ Red circle with X

---

## **Screen 6: Upload Bank Statement + Spending Extraction**

### **Visual Layout**

**Step 1: Bank Statement Upload**
```
┌─────────────────────────────────────────┐
│                                         │
│  Upload Bank Statement                  │
│  Requirement: 3 months (recent)         │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  Why this? It shows where you spend     │
│  on dating & experiences (restaurants,  │
│  travel, activities).                   │
│                                         │
│  What we extract:                       │
│  ✓ Dining & restaurants                 │
│  ✓ Entertainment & events                │
│  ✓ Travel & experiences                 │
│  ✗ NOT your balance or account #        │
│  (All financial numbers are redacted)   │
│                                         │
│  Privacy:                               │
│  • Your full statement never leaves     │
│    your phone                           │
│  • Account numbers are removed          │
│  • Only we can see the raw file         │
│  • You choose what to show on profile   │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  [Add Bank Statement (PDF/JPG)]         │
│  (Tap to upload 3-month statement)      │
│                                         │
└─────────────────────────────────────────┘
```

**Step 2: Extracting Spending Pattern**
```
┌─────────────────────────────────────────┐
│                                         │
│  Analyzing Your Spending...             │
│                                         │
│  [⏳ Spinner]                            │
│                                         │
│  Scanning for:                          │
│  ⏳ Restaurants & dining                 │
│  ⏳ Entertainment & activities           │
│  ⏳ Travel & experiences                 │
│  ⏳ Removing sensitive info              │
│                                         │
│  Takes <60 seconds                      │
│                                         │
└─────────────────────────────────────────┘
```

**Step 3: Spending Summary (Non-identifiable)**
```
┌─────────────────────────────────────────┐
│                                         │
│  ✓ Spending Pattern Verified!           │
│  +25 trust score points                 │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  Your Spending Profile (3 months):      │
│                                         │
│  🍽️  Dining & Restaurants: $850         │
│      (Frequency: 2-3x/week)             │
│      Venues: Casual, mid-range,         │
│      occasional upscale                 │
│                                         │
│  🎭 Entertainment: $320                 │
│      (Events, concerts, movies)         │
│                                         │
│  ✈️  Travel: $1,200                     │
│      (Weekend trips, experiences)       │
│                                         │
│  📊 Signal: You invest in dates &       │
│     experiences (not cheap, not flashy) │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  Privacy: Your account number, full     │
│  balances, and salary transfers are     │
│  never seen or stored.                  │
│                                         │
│  Choose what shows on your profile:     │
│  ☑ Dining (show restaurant spend)       │
│  ☑ Entertainment (show activity spend)  │
│  ☐ Travel (hide travel spend)           │
│  (User controls visibility per category)│
│                                         │
│  ────────────────────────────────────  │
│                                         │
│        [Next: Q&A]                      │
│                                         │
└─────────────────────────────────────────┘
```

### **Specifications**

**Upload Zone:**
- Instructions: 16px, clear language
- Privacy assurance: italicized, slate-400 (smaller text)
- File upload: button with document icon
- Accepted formats: PDF, JPG, PNG (mention explicitly)

**Processing State:**
- Spinner + progress steps
- Checklist items animate green as complete

**Spending Summary:**
- Category cards: 16px title, 14px description
- Amounts displayed as currency: $XXX
- Frequency notation: (2-3x/week)
- Privacy reassurance: italicized disclaimer

**Visibility Toggles:**
- Checkboxes for each spending category
- If unchecked: doesn't appear on public profile
- Still counts toward trust score (internal only)

---

## **Screen 7: Q&A Responses — Intent Consistency**

### **Visual Layout**

**Casual Man Archetype Questions:**
```
┌─────────────────────────────────────────┐
│                                         │
│  Answer the Questions                   │
│  (3 min read) Proves your intent        │
│                                         │
│  Progress: 1/4                          │
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░ 25%   │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  Q1: What does "casual" mean to you?    │
│  ────────────────────────────────────  │
│                                         │
│  [Text input box]                       │
│  Placeholder: "Casual dating where      │
│  both of us know what we want..."       │
│                                         │
│  (0/300 chars)                          │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  Q2: What are you looking for right     │
│  now?                                   │
│                                         │
│  [Text input box]                       │
│  Placeholder: "Real connection, some    │
│  chemistry, no games..."                │
│                                         │
│  (0/300 chars)                          │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  Q3: How do you treat the people you    │
│  date?                                  │
│                                         │
│  [Text input box]                       │
│  Placeholder: "With respect, honesty,   │
│  and consideration..."                  │
│                                         │
│  (0/300 chars)                          │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  Q4: What would be a dealbreaker for    │
│  you?                                   │
│                                         │
│  [Text input box]                       │
│  Placeholder: "Someone who lies or      │
│  isn't honest about what they want..."  │
│                                         │
│  (0/300 chars)                          │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│        [Submit Answers]                 │
│                                         │
└─────────────────────────────────────────┘
```

**Different Archetypes, Different Questions:**

**Spoilt Woman:**
- "What does being 'spoilt' mean to you?"
- "What are you looking for in a date?"
- "What should a guy know about your values?"
- "What's your ideal first date?"

**Marriage-Minded Man:**
- "What does 'marriage-minded' mean to you?"
- "What are your values in a partner?"
- "Where do you see yourself in 5 years?"
- "How important is building a family?"

**Safety-First Woman:**
- "What does 'safety-first' mean for you?"
- "What are the biggest red flags you watch for?"
- "How do you decide if someone is trustworthy?"
- "What reassurance do you need early on?"

---

**Step 2: Checking Consistency**
```
┌─────────────────────────────────────────┐
│                                         │
│  Checking Your Answers...               │
│                                         │
│  [⏳ Spinner]                            │
│                                         │
│  Are you actually casual? Or are you    │
│  secretly looking for something serious?│
│  (We're checking for honesty & intent)  │
│                                         │
│  Takes <60 seconds                      │
│                                         │
└─────────────────────────────────────────┘
```

**Step 3a: Success (Consistent)**
```
┌─────────────────────────────────────────┐
│                                         │
│  ✓ Your Intent is Clear!                │
│  +10 trust score points                 │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  Your answers show you're:              │
│  ✓ Honest about what you want           │
│  ✓ Not contradicting yourself           │
│  ✓ Clear on boundaries                  │
│                                         │
│  This helps matches trust you from day  │
│  one.                                   │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│        [Next: Review Profile]           │
│                                         │
└─────────────────────────────────────────┘
```

**Step 3b: Warning (Inconsistent)**
```
┌─────────────────────────────────────────┐
│                                         │
│  ⚠️  Some Inconsistency Detected        │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  You said: "Casual dating only"         │
│  But also: "Looking for marriage soon"  │
│                                         │
│  Which is it?                           │
│                                         │
│  Matching people on Verified Vibe means │
│  being clear about intent. Your match   │
│  depends on your honesty.               │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  Options:                               │
│  [Clarify Answers] (edit responses)     │
│  [Change Archetype] (pick different)    │
│  [Keep Answers As-Is] (not recommended) │
│                                         │
└─────────────────────────────────────────┘
```

### **Specifications**

**Text Input:**
- 300 char limit
- Character count shown: (0/300) under input
- Placeholder: example answer (not instructive, real example)
- Monospace: optional (for quotes/examples)

**Progress Bar:**
- Updated per question (25%, 50%, 75%, 100%)

**Inconsistency Alert:**
- Yellow/orange background card
- Title: ⚠️  emoji
- Clear explanation of what's conflicting
- No judgment tone ("which is it?" not "you're lying")

---

## **Screen 8: Trust Score Dashboard**

### **Visual Layout**

**Trust Score Summary**
```
┌─────────────────────────────────────────┐
│                                         │
│  Your Trust Score                       │
│                                         │
│  ╔═════════════════════════════════╗   │
│  ║                                 ║   │
│  ║            72                   ║   │
│  ║           /100                  ║   │
│  ║                                 ║   │
│  ║        [===== 72% ====]         ║   │
│  ║                                 ║   │
│  ║      High Trust - Great!         ║   │
│  ║     (Top 40% of Casual Men)      ║   │
│  ║                                 ║   │
│  ╚═════════════════════════════════╝   │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  Breakdown:                             │
│                                         │
│  Identity       🟢 29/35 pts            │
│  ├─ ID verified ✓                      │
│  ├─ Liveness check ✓                   │
│  └─ Face consistency ✓                 │
│                                         │
│  Lifestyle      🟢 38/45 pts            │
│  ├─ Photos verified ✓                  │
│  ├─ Spending credible ✓                │
│  └─ Grooming signal ✓                  │
│                                         │
│  Intent         🟡 5/20 pts             │
│  ├─ Q&A honesty ✓                      │
│  └─ Archetype clarity ⚠️ (needs work)  │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  Ways to Improve:                       │
│                                         │
│  ➕ Boost "Intent Clarity"              │
│     Your Q&A had some conflict. Clear   │
│     that up = +5 pts. Edit answers?    │
│                                         │
│  [Edit Q&A]                             │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  What This Means:                       │
│  Your score determines match visibility:│
│                                         │
│  72/100 = You're in top tier. Most      │
│  women will see your profile early in   │
│  feed.                                  │
│                                         │
│  Scores below 60 = limited visibility   │
│  until you improve.                     │
│                                         │
│        [Re-upload Artifacts]            │
│        [← Back to Home]                 │
│                                         │
└─────────────────────────────────────────┘
```

### **Specifications**

**Trust Score Display:**
- Large circular or radial gauge: 72/100
- Fill color: emerald for 60+, orange for 40-59, red for <40
- Percentage bar below number
- Label: "High Trust — Great!" or "Needs Work — Get to 60+"

**Breakdown Sections:**
- Three category rows: Identity, Lifestyle, Intent
- Green dot if >80%, yellow if 50-79%, red if <50%
- Sub-bullets: checkmarks for passed, warning icons for needs work

**Improvement Nudges:**
- Non-judgmental ("needs work", not "bad")
- Specific ("Your Q&A had some conflict...") not generic
- Clear CTA ("Edit Q&A" not "improve profile")

---

## **Screen 9: Discovery Feed — Archetype-Filtered**

### **Visual Layout**

**Feed Header**
```
┌─────────────────────────────────────────┐
│                                         │
│  Discover                               │
│  Casual Men                             │
│                                         │
│  Compatible archetypes:                 │
│  🎯 Spoilt Women (primary)              │
│  💍 Marriage-Minded (if open)           │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  Filters: [Min Score: 50+] [Distance]  │
│                                         │
│  You have 10 passes today. Use wisely.  │
│                                         │
└─────────────────────────────────────────┘
```

**Profile Card (Stack View)**
```
┌─────────────────────────────────────────┐
│                                         │
│ [Full-width photo, 300px height]        │
│ [Photo of user]                         │
│                                         │
│ [Top-right corner]                      │
│ 🛡️  VERIFIED                             │
│ Trust Score: 72/100                     │
│                                         │
│ ────────────────────────────────────   │
│                                         │
│ Casual Man, 28                          │
│ Brooklyn, NY · 2 miles away             │
│                                         │
│ Verified artifacts:                     │
│ ✓ ID verified  ✓ Photos  ✓ Spending    │
│                                         │
│ ────────────────────────────────────   │
│                                         │
│ About him:                              │
│ "Into hiking, coffee, and real convos"  │
│                                         │
│ Dining & date spend:                    │
│ 🍽️  $850/month on experiences           │
│                                         │
│ ────────────────────────────────────   │
│                                         │
│    [← Pass]  [→ Interested]             │
│                                         │
│ Or tap photo for full profile           │
│                                         │
└─────────────────────────────────────────┘
```

**Full Profile Expand (on tap)**
```
┌─────────────────────────────────────────┐
│                                         │
│  Casual Man, 28                         │
│  Brooklyn, NY                           │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  Trust Score: 72/100                    │
│  [Green gauge bar]                      │
│                                         │
│  Identity (29/35):                      │
│  ✓ ID verified & liveness passed        │
│  ✓ Real person (face consistent)        │
│                                         │
│  Lifestyle (38/45):                     │
│  ✓ 5+ photos verified (same person)     │
│  ✓ Spends on dates & experiences       │
│  ✓ Well-groomed                         │
│                                         │
│  Intent (5/20):                         │
│  ⚠️  Some Q&A inconsistency             │
│                                         │
│  About:                                 │
│  "Into hiking, coffee, and real convos. │
│   Looking for something casual but real.│
│   Not here for games."                  │
│                                         │
│  What he's looking for:                 │
│  "Someone fun, genuine, open to a      │
│   vibe. Chemistry matters most."        │
│                                         │
│  Spending Pattern:                      │
│   🍽️  Dining: $850/month (casual-upscale)│
│  🎭 Entertainment: $320/month           │
│  ✈️  Travel: $1,200/month               │
│  (Signal: Values experiences & dates)   │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│    [← Back to Cards]                    │
│    [← Pass] [→ Interested]              │
│                                         │
└─────────────────────────────────────────┘
```

**Daily Passes Display**
```
You have 10 passes left today.
New passes at midnight.

[====== 7 used ███░░░░░░░░ 3 left]

Passes are limited to prevent fatigue
and encourage quality matches.
```

### **Specifications**

**Card Design:**
- Full-screen swipe interface (left = pass, right = interested)
- Photo: 300px height, object-fit cover
- Badge (top-right): "VERIFIED" emerald pill
- Trust score: white text on dark, top-right
- Text overlay: dark gradient at bottom for readability

**Trust Badge:**
- 🛡️  emoji or custom shield icon
- "VERIFIED" text
- Score: "72/100" or "High Trust"
- Location: top-right, absolute positioned

**Interaction:**
- Swipe left 30%+ width → pass (photo slides out left, new card appears)
- Swipe right 30%+ width → interested (card animates up, "❤️ Liked!" message shows)
- Tap card → expand full profile
- Tap profile area → swipe controls visible at bottom

**Filters:**
- Sticky at top: [Score slider] [Distance] [Apply]
- Collapse/expand on tap

---

## **Screen 10: Match Confirmation**

### **Visual Layout**

**Mutual Match Celebration**
```
┌─────────────────────────────────────────┐
│                                         │
│  ✨ It's a Match! ✨                     │
│                                         │
│  [Photo of matched person]              │
│                                         │
│  You both showed interest!              │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  🎯 Casual Man                          │
│  +                                      │
│  💎 Spoilt Woman                        │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│  What happens next?                     │
│  1. Start a conversation here (safe app)│
│  2. Get to know each other              │
│  3. Move to text/meet IRL when ready    │
│                                         │
│  Safety tip:                            │
│  Both profiles are verified. If anything│
│  feels off, report it instantly.        │
│                                         │
│  ────────────────────────────────────  │
│                                         │
│     [Send First Message]                │
│     [View Profile Again]                │
│                                         │
└─────────────────────────────────────────┘
```

### **Specifications**

- Celebratory tone (✨ emoji, bold fonts)
- Large photo of matched person (centered)
- Archetype pairing visualization (icon + name)
- Next steps listed (numbered, clear)
- Safety reminder (small, reassuring tone)
- CTAs: Primary [Send Message], Secondary [View Profile]

---

## **Screen 11: Chat with Intent Banner**

### **Visual Layout**

```
┌─────────────────────────────────────────┐
│                                         │
│  [← Back]  Messages  [⋮ More]           │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  🎯 Casual Man matched with             │
│  💎 Spoilt Woman                        │
│                                         │
│  [Photo] Sarah, 26 · Brooklyn           │
│                                         │
│  Both verified. Trust score: 72 & 81    │
│  [Report User] [Video Call]             │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│                              ┌────────┐ │
│                              │ Hey! ☺️ │ │
│                              │ How's  │ │
│                              │ your   │ │
│                              │ week?  │ │
│                              └────────┘ │
│                                         │
│ ┌────────────────────────────────────┐  │
│ │ Ah hey! Pretty good, just got back │  │
│ │ from hiking. You into the outdoors?│  │
│ └────────────────────────────────────┘  │
│                                         │
│                              ┌────────┐ │
│                              │ Yeah!  │ │
│                              │ Trail  │ │
│                              │ this   │ │
│                              │ weekend│ │
│                              └────────┘ │
│                                         │
│ ┌────────────────────────────────────┐  │
│ │ You thinking what I'm thinking? 😏 │  │
│ └────────────────────────────────────┘  │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  📅 Suggest a Date                      │
│  ────────────────────────────────────  │
│  When: [Friday evening] [Time: 7 PM]   │
│  Where: [Restaurant/Bar] [Pick place]  │
│  Budget: [$20-50] [Casual vibe]        │
│                                         │
│  [Send Proposal]                        │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  [Message input box]                    │
│  Type here...                           │
│  ────────────────────────────────────  │
│  [Emoji]  [Photos]          [Send] →    │
│                                         │
└─────────────────────────────────────────┘
```

### **Specifications**

**Intent Banner (sticky at top):**
- Archetype icons + text: "🎯 Casual Man matched with 💎 Spoilt Woman"
- Trust scores for both: "72/100" & "81/100"
- Quick actions: [Report User] [Video Call]
- Background: slate-700, text emerald

**Message Bubbles:**
- User messages (right): emerald background, white text
- Matched person (left): slate-700, slate-100 text
- Timestamps: optional, slate-500 small text
- Read receipts: small checkmarks

**Date Proposal Card:**
- Sticky within chat (or separate tab)
- Fields: When (date picker), Where (location search), Budget (slider)
- Pre-fill: "Friday evening", restaurant type, budget signal
- Send button: emerald

**Input Area (sticky at bottom):**
- Text input: full width, slate-700 border
- Quick actions: emoji, photo, voice
- Send button: emerald arrow icon

---

## **Component Library Summary**

| Component | Spec |
|-----------|------|
| **Archetype Card** | 120px tall, emerald hover, emoji + title + description |
| **Status Badge** | Emerald ✓, Orange ⏳, Red ✕ — small pill |
| **Trust Score Display** | Radial gauge (0-100), colored by performance |
| **Progress Bar** | Linear, emerald fill, animated |
| **Text Input** | 300 char limit, placeholder examples, char count |
| **Photo Upload** | Dashed border, drag-and-drop, thumbnails |
| **Button (Primary)** | Full width, 48px, emerald, "This is Me" / "Start" |
| **Button (Secondary)** | Full width, 48px, slate, "Back" / "← Go Back" |
| **Intent Banner** | Sticky top, archetype pairs, trust scores, actions |
| **Message Bubble** | Aligned right/left, emerald/slate, max 100 chars visible |
| **Date Proposal** | Card with When/Where/Budget fields, emerald CTA |

---

## **Copy Tone & Voice**

- **Reassuring, not clinical:** "Let's verify you're real" not "Submit ID documentation"
- **Specific, not generic:** "You spend ~$850/month on dining" not "You spend on experiences"
- **Honest, not pushy:** "If anything feels off, report it" not "Always check for red flags"
- **Smart, not preachy:** "We redact account numbers" not "Your privacy is sacred"

---

## **Next Steps for Claude Design**

1. **Create Figma mockups** for each of these 11 screens
2. **Prototype interactions** (swipe cards, expand modals, upload states)
3. **Finalize component library** (buttons, badges, input fields)
4. **Test on mobile** (all screens should work at 375px width)
5. **Hand off to builders** for frontend implementation

---

## **Open Questions for Design Phase**

1. **Color for "needs improvement" sections?** Currently orange. Should it be different from error (red)?
2. **Trust score threshold visual?** Should we show a target (e.g., "Get to 70+") or just the current?
3. **Photo grid on discovery card?** Show all 5 photos in carousel, or just main photo + expandable?
4. **Date proposal in-chat or separate tab?** Currently in-chat sticky card — feels intrusive?
5. **Pass count visibility?** "10 passes left" always visible, or just when running low?
6. **Archetype change flow?** If user wants to switch from Casual Man to Marriage-Minded, re-verify everything?

---

## **Accessibility Notes**

- All buttons: min 48px height (tap target)
- Text contrast: WCAG AA on all text
- Alt text: all icons should have aria labels
- Focus states: keyboard navigation supported
- Color + icon: don't rely on color alone (use ✓, ✕, ⏳)

