/* Mock data for Verified Vibe prototype */

window.ARCHETYPES = [
  {
    id: "casual_man",
    gender: "man",
    emoji: "🎯",
    name: "Casual Man",
    tag: "Casual dating & real connection",
    longTag: "You want casual dating & real connection. No pretense. Real vibes.",
    matchTraits: [
      { lead: true, label: "💎 Spoilt Women" },
      { label: "Financially motivated" },
      { label: "Loves established men" },
      { label: "Socially savvy" },
      { label: "Luxury dater" },
      { label: "Open to short-term" }
    ],
    avoidTraits: [
      { label: "Romantic idealists" },
      { label: "Anti-transactional" },
      { label: "Anti-materialistic" },
      { label: "Hates status games" },
      { label: "Looking for forever" }
    ],
    brings: [
      "Financial stability",
      "Generosity mindset",
      "Upscale travel & restaurants",
      "Privacy & discretion",
      "Confidence without arrogance",
      "Respect & safety",
      "Business insight",
      "Emotional maturity"
    ],
    needs: [
      "Government ID (prove you're real)",
      "5+ photos (prove it's really you)",
      "Spending pattern (prove you're solid)",
      "Q&A responses (prove your intent)"
    ],
    timeMins: 10
  },
  {
    id: "spoilt_woman",
    gender: "woman",
    emoji: "💎",
    name: "Spoilt Woman",
    tag: "Want to be treated like royalty",
    longTag: "You want to be cherished — properly. Dinners, weekends, intent.",
    matchTraits: [
      { lead: true, label: "🎯 Casual Men" },
      { lead: true, label: "💍 Marriage-Minded Men" },
      { label: "Established earners" },
      { label: "Generous on dates" },
      { label: "Knows what he wants" },
      { label: "Cherishes effort" }
    ],
    avoidTraits: [
      { label: "Cheapskates" },
      { label: "Avoidants" },
      { label: "Anti-luxury" },
      { label: "Game players" },
      { label: "Bare-minimum daters" }
    ],
    brings: [
      "Elegance & poise",
      "High social IQ",
      "Conversation chops",
      "Style & taste",
      "Loyalty when chosen",
      "Sense of occasion",
      "Sharp wit",
      "Genuine appreciation"
    ],
    needs: [
      "Government ID (prove you're real)",
      "5+ photos (prove it's really you)",
      "Q&A responses (prove your standards)"
    ],
    timeMins: 8
  },
  {
    id: "marriage_minded_man",
    gender: "man",
    emoji: "💍",
    name: "Marriage-Minded Man",
    tag: "Looking for serious & forever",
    longTag: "You're done playing. You want a partner, and you're building toward it.",
    matchTraits: [
      { lead: true, label: "💎 Spoilt Women" },
      { lead: true, label: "🛡️ Safety-First Women" },
      { label: "Marriage-ready" },
      { label: "Family-oriented" },
      { label: "Done with games" },
      { label: "Wants commitment" }
    ],
    avoidTraits: [
      { label: "Situationship seekers" },
      { label: "Anti-commitment" },
      { label: "Hookup mindset" },
      { label: "Forever-single types" },
      { label: "Career-only (for now)" }
    ],
    brings: [
      "Long-term commitment",
      "Financial stability",
      "Family-ready mindset",
      "Emotional availability",
      "Provider mentality",
      "Respect & safety",
      "Clear communication",
      "Settled lifestyle"
    ],
    needs: [
      "Government ID",
      "5+ photos",
      "Spending pattern",
      "Q&A responses",
      "(Optional) Background check"
    ],
    timeMins: 12
  },
  {
    id: "safety_first_woman",
    gender: "woman",
    emoji: "🛡️",
    name: "Safety-First Woman",
    tag: "Need verified, non-creep vibes",
    longTag: "Trust is non-negotiable. You date people who have done the work.",
    matchTraits: [
      { lead: true, label: "💍 Marriage-Minded Men only" },
      { label: "Verified earners" },
      { label: "Boundary-respecters" },
      { label: "Slow-pace daters" },
      { label: "Therapized" },
      { label: "Background-check ready" }
    ],
    avoidTraits: [
      { label: "Anonymous accounts" },
      { label: "Boundary-pushers" },
      { label: "Fast-movers" },
      { label: "Casual-only" },
      { label: "Red-flag carriers" }
    ],
    brings: [
      "Clear boundaries",
      "Emotional intelligence",
      "Self-respect",
      "Sharp discernment",
      "Total honesty",
      "Healthy attachment",
      "Reliable presence",
      "Patience"
    ],
    needs: [
      "Government ID",
      "5+ photos",
      "Q&A responses"
    ],
    timeMins: 6
  }
];

window.SELF = {
  archetype: "casual_man",
  firstName: "Alex",
  age: 28,
  city: "Brooklyn, NY",
  avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&q=80&auto=format&fit=crop",
  trustScore: 72,
  identity: { score: 29, max: 35, items: [
    { label: "Government ID verified", ok: true },
    { label: "Liveness check passed", ok: true },
    { label: "Face matches ID", ok: true }
  ]},
  lifestyle: { score: 38, max: 45, items: [
    { label: "5 photos · same person", ok: true },
    { label: "Spending pattern credible", ok: true },
    { label: "Grooming signal · strong", ok: true }
  ]},
  intent: { score: 5, max: 20, items: [
    { label: "Q&A honesty", ok: true },
    { label: "Archetype clarity", ok: false, note: "needs work" }
  ]}
};

/* Public profile — the version other people see.
   Photos are AI-rendered from the user's real verified photos (real ones
   only unlock after a match). Vibe / personality / lifestyle are
   inferred from the verification data + Q&A. */
window.PUBLIC_PROFILE = {
  // AI-rendered portraits — distinct moods, none reveal the real face.
  aiPhotos: [
    { url: "https://images.unsplash.com/photo-1463453091185-61582044d556?w=720&q=80&auto=format&fit=crop", mood: "Golden hour · rooftop" },
    { url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=720&q=80&auto=format&fit=crop", mood: "Brooklyn cafe · morning" },
    { url: "https://images.unsplash.com/photo-1488161628813-04466f872be2?w=720&q=80&auto=format&fit=crop", mood: "Hiking · upstate" },
    { url: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=720&q=80&auto=format&fit=crop", mood: "Dinner · soft light" }
  ],
  tagline: "Doesn't waste your time. Plans the date. Doesn't overcomplicate.",
  /* Three-word vibe summary */
  vibeChips: ["Calm", "Decisive", "Generous", "Curious", "Direct"],
  /* Personality reads — derived from Q&A + spending */
  personality: [
    { trait: "Decisiveness", level: 0.88, blurb: "Picks a place, picks a time, follows through." },
    { trait: "Warmth",       level: 0.72, blurb: "Generous without being a pushover." },
    { trait: "Openness",     level: 0.81, blurb: "Reads, travels, asks better questions than most." },
    { trait: "Pace",         level: 0.65, blurb: "Moves at a comfortable, intentional clip." },
    { trait: "Stability",    level: 0.79, blurb: "Settled work life. Predictable in the good way." }
  ],
  /* Lifestyle — pulled from spending + activity verification */
  lifestyle: [
    { label: "Eats out",        value: "2–3×/week",   detail: "Casual to upscale · $850/mo",   icon: "🍽️" },
    { label: "Travels",         value: "Monthly",     detail: "Weekends + 1 big trip/qtr",     icon: "✈️" },
    { label: "Active",          value: "4×/week",     detail: "Climbing · running · trails",   icon: "🥾" },
    { label: "Bedtime",         value: "11:30 PM",    detail: "Not a night-owl, not an early bird", icon: "🌙" }
  ],
  /* Communication style — inferred */
  communication: {
    style: "Plain English",
    detail: "Doesn't text-essay. Replies same day. Calls when it matters.",
    pace: "Same-day",
    voice: "Dry humor"
  },
  /* What he's bringing — from archetype "brings" + Q&A */
  bringing: [
    "Financial stability",
    "Generosity on dates",
    "Time he actually gives you",
    "Privacy & discretion",
    "Real opinions, gently held"
  ],
  /* Dealbreakers — from QA */
  dealbreakers: [
    "Dishonesty about what someone wants",
    "Game-playing",
    "Flake energy"
  ],
  /* Looking for — pulled from archetype matchTraits */
  lookingFor: {
    headline: "💎 Spoilt Women",
    detail: "Wants effort, taste, and a calendar that respects yours."
  }
};

/* Boost actions — ways to raise the trust score from 72 toward 100 */
window.BOOST_ACTIONS = [
  { id: "qa",       pts: 5, title: "Tighten your Q&A",       sub: "Q1 said 'casual', Q3 hinted long-term. Reconcile them.",       icon: "compass",   time: "2 min" },
  { id: "bg",       pts: 3, title: "Background check",       sub: "Optional. Unlocks 'Safety-First Women' as matches.",            icon: "shield",    time: "30 sec · $9" },
  { id: "linkedin", pts: 4, title: "Link LinkedIn",          sub: "Confirms profession. Won't show — just signals.",               icon: "user-check",time: "20 sec" },
  { id: "video",    pts: 4, title: "30-sec video intro",     sub: "Voice + face — gives matches a real read on you.",              icon: "video",     time: "1 min" },
  { id: "refs",     pts: 3, title: "2 personal references",  sub: "Friends vouch quietly. They never see your matches.",           icon: "heart",     time: "5 min" },
  { id: "habits",   pts: 2, title: "Connect a habit tracker",sub: "Sleep, gym, reading — proves the lifestyle isn't fiction.",     icon: "spark",     time: "1 min" }
];

window.PROFILES = [
  {
    id: "sarah",
    name: "Sarah",
    age: 26,
    archetype: "spoilt_woman",
    archEmoji: "💎",
    city: "Brooklyn, NY",
    distance: "2 mi away",
    photo: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=720&q=80&auto=format&fit=crop",
    trustScore: 81,
    about: "Likes good wine, late dinners, weekend trips that aren't planned.",
    looking: "Someone who shows up — present, not performative.",
    verified: ["ID", "Photos", "Spending"],
    spending: {
      dining: 1180,
      entertainment: 460,
      travel: 1900
    },
    bestie: { name: "Mira",   personality: "sharp",     passed: 3, total: 5 }
  },
  {
    id: "maya",
    name: "Maya",
    age: 28,
    archetype: "spoilt_woman",
    archEmoji: "💎",
    city: "Williamsburg",
    distance: "4 mi away",
    photo: "https://images.unsplash.com/photo-1530785602389-07594beb8b73?w=720&q=80&auto=format&fit=crop",
    trustScore: 77,
    about: "Architect by day. Probably reading something dense at the bar.",
    looking: "Curious people who can hold a conversation past 11pm.",
    verified: ["ID", "Photos", "Spending"],
    spending: { dining: 920, entertainment: 540, travel: 1100 },
    bestie: { name: "Vesper", personality: "skeptical", passed: 2, total: 5 }
  },
  {
    id: "zoe",
    name: "Zoe",
    age: 25,
    archetype: "marriage_minded_man",
    archEmoji: "💍",
    city: "Park Slope",
    distance: "3 mi away",
    photo: "https://images.unsplash.com/photo-1614283233556-f35b0c801ef1?w=720&q=80&auto=format&fit=crop",
    trustScore: 88,
    about: "Climbing, photography, my dog Pip. Open to where this goes.",
    looking: "Someone with their own life that I get to be a part of.",
    verified: ["ID", "Photos", "Spending", "Q&A"],
    spending: { dining: 740, entertainment: 380, travel: 1450 },
    bestie: { name: "Juno",   personality: "warm",      passed: 4, total: 5 }
  },
  {
    id: "lena",
    name: "Lena",
    age: 27,
    archetype: "spoilt_woman",
    archEmoji: "💎",
    city: "Fort Greene",
    distance: "5 mi away",
    photo: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=720&q=80&auto=format&fit=crop",
    trustScore: 74,
    about: "Brand strategist. I plan dates better than I plan my own life.",
    looking: "Energy. Honest about what you want. Decisive.",
    verified: ["ID", "Photos"],
    spending: { dining: 980, entertainment: 320, travel: 880 },
    bestie: { name: "Cleo",   personality: "playful",   passed: 1, total: 4 }
  }
];

window.MATCH_PROFILE = window.PROFILES[0];

/* Conversations / inbox.
   Each entry: profile + last message preview, unread count, typing flag,
   optional dateProposed metadata, matchedAgo for fresh matches that have
   not been replied to yet (those surface in "New matches" strip). */
window.CONVERSATIONS = [
  {
    profileId: "sarah",
    lastFrom: "them",
    preview: "Bold move on day one 😏",
    time: "10:43 AM",
    unread: 2,
    typing: false,
    dateProposed: "Fri · 7:30 PM",
    pinned: true
  },
  {
    profileId: "zoe",
    lastFrom: "them",
    preview: "Pip says hi. He approves of dogs first, men second.",
    time: "9:12 AM",
    unread: 1,
    typing: true
  },
  {
    profileId: "maya",
    lastFrom: "me",
    preview: "You: the Cervo's reservation is locked in",
    time: "Yesterday",
    unread: 0,
    typing: false,
    dateConfirmed: "Sat · 8:00 PM"
  },
  {
    profileId: "lena",
    lastFrom: "them",
    preview: "Okay decisive. I respect it. What's the move?",
    time: "Yesterday",
    unread: 0,
    typing: false
  }
];

/* Fresh matches — appear in the "New matches" carousel above the inbox.
   Stay here until you send the first message. */
window.NEW_MATCHES = [
  { profileId: "iris",    matchedAgo: "12m" },
  { profileId: "camille", matchedAgo: "1h"  },
  { profileId: "noor",    matchedAgo: "3h"  },
  { profileId: "reyna",   matchedAgo: "Yesterday" }
];

/* Look up a profile by id — falls back to LIVE_NOW women for new-match
   strip avatars that aren't full Discovery profiles. */
window.getProfileById = function(id) {
  const full = window.PROFILES.find(p => p.id === id);
  if (full) return full;
  const live = (window.LIVE_NOW?.women || []).find(p => p.name.toLowerCase() === id);
  if (live) {
    return {
      id, name: live.name, age: live.age, photo: live.photo,
      archetype: live.archetype, archEmoji: live.archetype === "spoilt_woman" ? "💎" : "🛡️",
      city: live.city, distance: "—",
      trustScore: 70 + ((live.name.length * 7) % 25),
      about: "", looking: "",
      verified: ["ID", "Photos"],
      spending: { dining: 700, entertainment: 300, travel: 900 },
      bestie: live.bestie || { name: "Mira", passed: 1, total: 5 }
    };
  }
  return null;
};

window.MESSAGES = [
  { id: 1, from: "them", text: "Okay your hiking trail photo got me. Where was that?", time: "yesterday" },
  { id: 2, from: "me", text: "Bear Mountain, last weekend. Way easier than it looks. You hike?", time: "yesterday" },
  { id: 3, from: "them", text: "I want to. Mostly I run, but I have been eyeing a thing in the Catskills for ages.", time: "yesterday" },
  { id: 4, from: "me", text: "Then we should fix that.", time: "10:42 AM" },
  { id: 5, from: "them", text: "Bold move on day one 😏", time: "10:43 AM", fromAI: true },
  { id: 6, from: "me", text: "I will earn it. What does your Friday look like?", time: "10:44 AM" },
  { id: 7, from: "them", text: "Real one before Friday — what was the longest relationship you've had, and what ended it? (asking the awkward stuff so she doesn't have to)", time: "10:51 AM", fromAI: true }
];

/* AI Bestie — the woman's screening agent that converses on her behalf */
window.AI_BESTIE_DEFAULT = {
  name: "Mira",
  gender: "female-cis",      // female-cis | female-trans | male-cis | male-trans | nonbinary
  age: 28,
  personality: "sharp",      // sharp | warm | skeptical | playful
  tone: 0.5,                 // 0 = cordial, 0.5 = probing, 1 = cutting
  bringMeIn: "3-of-5",       // 4-of-5 | 3-of-5 | every-5 | end-of-day
  checks: {
    "Financial stability": true,
    "Intent clarity": true,
    "Communication consistency": true,
    "Generosity beyond money": true,
    "Long-term thinking": false,
    "Past relationships handled": false,
    "Family / kids alignment": false
  },
  passed: 3,                 // checks the man has currently cleared
  prompts: [
    "Does he plan dates or expect me to?",
    "When did he last make a real effort for someone?"
  ]
};

/* AI Wingman — the man's equivalent. Same shape, masculine defaults. */
window.AI_WINGMAN_DEFAULT = {
  name: "Theo",
  gender: "male-cis",
  age: 30,
  personality: "sharp",
  tone: 0.5,
  bringMeIn: "3-of-5",
  checks: {
    "Genuine interest": true,
    "Pace expectations": true,
    "Honesty about wants": true,
    "Communication style": true,
    "Past relationships": false,
    "Long-term alignment": false
  },
  passed: 2,
  prompts: [
    "What does her week look like when she's not impressing anyone?",
    "How does she handle a clear no?"
  ]
};

/* Suggested prompts per archetype — surfaced as tappable chips in the
   configurator. Each carries a short "why" tag so the user understands
   what signal the question is meant to extract. */
window.SUGGESTED_PROMPTS = {
  spoilt_woman: [
    { p: "Tell me about a time he was generous — not just with money",         why: "Generosity" },
    { p: "How does he talk about his ex?",                                      why: "Maturity" },
    { p: "What's his energy at 7pm on a Tuesday?",                              why: "Lifestyle fit" },
    { p: "Has he ever cancelled on someone last-minute?",                       why: "Reliability" },
    { p: "What's the most thoughtful thing he's done for a date?",              why: "Effort signal" },
    { p: "Who pays on date one, two, three — and why?",                         why: "Values" }
  ],
  safety_first_woman: [
    { p: "Is he willing to do a background check?",                             why: "Verification" },
    { p: "How does he respond when someone says no the first time?",            why: "Boundaries" },
    { p: "Will he do a video call before meeting in person?",                   why: "Pacing" },
    { p: "What does conflict look like with him?",                              why: "Regulation" },
    { p: "Who in his life would vouch for him — and what would they say?",      why: "Social proof" },
    { p: "What was his longest relationship and what ended it?",                why: "Pattern" }
  ],
  casual_man: [
    { p: "What does her dating week look like, honestly?",                       why: "Honesty" },
    { p: "How does she handle disappointment?",                                  why: "Maturity" },
    { p: "What's her energy with her closest friends?",                          why: "Authenticity" },
    { p: "Does she text first when she wants to?",                               why: "Communication" },
    { p: "What was the last thing she said no to and felt good about?",          why: "Self-respect" },
    { p: "Is she dating to be cherished, or to be entertained?",                 why: "Intent" }
  ],
  marriage_minded_man: [
    { p: "Where does she see herself in 3 years?",                               why: "Alignment" },
    { p: "How does she talk about her family?",                                  why: "Family values" },
    { p: "What did her last relationship teach her?",                            why: "Self-awareness" },
    { p: "How would she handle a real conflict with someone she loves?",         why: "Emotional skill" },
    { p: "What's her financial picture, broadly?",                               why: "Partnership clarity" },
    { p: "Does she want kids — and what's her timeline?",                         why: "Life alignment" }
  ]
};

/* Men don't get an AI Bestie by default — they earn it after a couple
   days of real conversation. */
window.AI_BESTIE_LOCK = {
  unlocksIn: "1d 14h",
  reason: "Earn it by showing up — for her, and for Mira."
};

window.DATE_PROPOSAL = {
  when: "Friday, May 22 · 7:30 PM",
  where: "Cervo's, Lower East Side",
  vibe: "Wine + small plates · casual",
  budget: "$80–120"
};

/* People currently in the app — used in the Home "Live now" carousel.
   archetype: which compatibility bucket they're in (drives filtering)
   women → spoilt_woman | safety_first_woman
   men   → casual_man    | marriage_minded_man */
window.LIVE_NOW = {
  women: [
    { name: "Sarah",   age: 26, profession: "Actress",          archetype: "spoilt_woman",       photo: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=160&q=80&auto=format&fit=crop", online: true,  city: "Brooklyn", bestie: { name: "Mira",   passed: 3, total: 5 } },
    { name: "Maya",    age: 28, profession: "Architect",        archetype: "spoilt_woman",       photo: "https://images.unsplash.com/photo-1530785602389-07594beb8b73?w=160&q=80&auto=format&fit=crop", online: true,  city: "Williamsburg", bestie: { name: "Vesper", passed: 2, total: 5 } },
    { name: "Zoe",     age: 25, profession: "Photographer",     archetype: "safety_first_woman", photo: "https://images.unsplash.com/photo-1614283233556-f35b0c801ef1?w=160&q=80&auto=format&fit=crop", online: false, city: "Park Slope",        lastSeen: "12m", bestie: { name: "Juno",   passed: 4, total: 5 } },
    { name: "Lena",    age: 27, profession: "Brand strategist", archetype: "spoilt_woman",       photo: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=160&q=80&auto=format&fit=crop", online: true,  city: "Fort Greene", bestie: { name: "Cleo",   passed: 1, total: 4 } },
    { name: "Iris",    age: 24, profession: "Med student",      archetype: "safety_first_woman", photo: "https://images.unsplash.com/photo-1502323777036-f29e3972d82f?w=160&q=80&auto=format&fit=crop", online: false, city: "Bushwick",          lastSeen: "1h", bestie: { name: "Aya",    passed: 1, total: 5 } },
    { name: "Camille", age: 29, profession: "Lawyer",           archetype: "spoilt_woman",       photo: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=160&q=80&auto=format&fit=crop", online: true,  city: "DUMBO", bestie: { name: "Sigrid", passed: 0, total: 5 } },
    { name: "Noor",    age: 26, profession: "Designer",         archetype: "safety_first_woman", photo: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=160&q=80&auto=format&fit=crop", online: true,  city: "Cobble Hill", bestie: { name: "Layla",  passed: 2, total: 5 } },
    { name: "Talia",   age: 30, profession: "VC analyst",       archetype: "spoilt_woman",       photo: "https://images.unsplash.com/photo-1546961342-1531b89bb091?w=160&q=80&auto=format&fit=crop", online: false, city: "Prospect Heights", lastSeen: "1d", bestie: { name: "Astrid", passed: 0, total: 5 } },
    { name: "Reyna",   age: 25, profession: "Fashion buyer",    archetype: "spoilt_woman",       photo: "https://images.unsplash.com/photo-1554151228-14d9def656e4?w=160&q=80&auto=format&fit=crop", online: true,  city: "Greenpoint", bestie: { name: "Sloane", passed: 1, total: 5 } },
    { name: "Anouk",   age: 27, profession: "Curator",          archetype: "safety_first_woman", photo: "https://images.unsplash.com/photo-1554727242-741c14fa561c?w=160&q=80&auto=format&fit=crop", online: false, city: "Bed-Stuy",         lastSeen: "2d", bestie: { name: "Brooke", passed: 1, total: 5 } }
  ],
  men: [
    { name: "Marcus",  age: 32, profession: "Software engineer", archetype: "casual_man",          photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&q=80&auto=format&fit=crop", online: true,  city: "Brooklyn Heights" },
    { name: "Theo",    age: 29, profession: "Producer",          archetype: "casual_man",          photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&q=80&auto=format&fit=crop", online: false, city: "Tribeca",          lastSeen: "20m" },
    { name: "Adrien",  age: 34, profession: "Surgeon",           archetype: "marriage_minded_man", photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=160&q=80&auto=format&fit=crop", online: true,  city: "West Village" },
    { name: "Jamal",   age: 31, profession: "Founder",           archetype: "casual_man",          photo: "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=160&q=80&auto=format&fit=crop", online: true,  city: "Harlem" },
    { name: "Ezra",    age: 33, profession: "Architect",         archetype: "marriage_minded_man", photo: "https://images.unsplash.com/photo-1488161628813-04466f872be2?w=160&q=80&auto=format&fit=crop", online: false, city: "SoHo",             lastSeen: "1d" },
    { name: "Dev",     age: 30, profession: "PM at Stripe",      archetype: "marriage_minded_man", photo: "https://images.unsplash.com/photo-1463453091185-61582044d556?w=160&q=80&auto=format&fit=crop", online: true,  city: "Williamsburg" },
    { name: "Hugo",    age: 35, profession: "Hedge fund",        archetype: "casual_man",          photo: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=160&q=80&auto=format&fit=crop", online: true,  city: "Chelsea" },
    { name: "Kian",    age: 28, profession: "Photographer",      archetype: "casual_man",          photo: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=160&q=80&auto=format&fit=crop", online: false, city: "LES",              lastSeen: "45m" },
    { name: "Otis",    age: 33, profession: "Chef",              archetype: "marriage_minded_man", photo: "https://images.unsplash.com/photo-1499996860823-5214fcc65f8f?w=160&q=80&auto=format&fit=crop", online: true,  city: "Park Slope" },
    { name: "Rafa",    age: 31, profession: "Investment banker", archetype: "marriage_minded_man", photo: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=160&q=80&auto=format&fit=crop", online: false, city: "Greenwich Village", lastSeen: "3d" }
  ]
};

/* Compatibility: given the user's chosen archetype, which archetypes they're shown */
window.MATCH_MATRIX = {
  casual_man:          ["spoilt_woman"],
  marriage_minded_man: ["spoilt_woman", "safety_first_woman"],
  spoilt_woman:        ["casual_man", "marriage_minded_man"],
  safety_first_woman:  ["marriage_minded_man"]
};
