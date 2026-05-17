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
    }
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
    spending: { dining: 920, entertainment: 540, travel: 1100 }
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
    spending: { dining: 740, entertainment: 380, travel: 1450 }
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
    spending: { dining: 980, entertainment: 320, travel: 880 }
  }
];

window.MATCH_PROFILE = window.PROFILES[0];

window.MESSAGES = [
  { id: 1, from: "them", text: "Okay your hiking trail photo got me. Where was that?", time: "yesterday" },
  { id: 2, from: "me", text: "Bear Mountain, last weekend. Way easier than it looks. You hike?", time: "yesterday" },
  { id: 3, from: "them", text: "I want to. Mostly I run, but I have been eyeing a thing in the Catskills for ages.", time: "yesterday" },
  { id: 4, from: "me", text: "Then we should fix that.", time: "10:42 AM" },
  { id: 5, from: "them", text: "Bold move on day one 😏", time: "10:43 AM" },
  { id: 6, from: "me", text: "I will earn it. What does your Friday look like?", time: "10:44 AM" }
];

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
    { name: "Sarah",   age: 26, profession: "Actress",          archetype: "spoilt_woman",       photo: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=160&q=80&auto=format&fit=crop", online: true,  city: "Brooklyn" },
    { name: "Maya",    age: 28, profession: "Architect",        archetype: "spoilt_woman",       photo: "https://images.unsplash.com/photo-1530785602389-07594beb8b73?w=160&q=80&auto=format&fit=crop", online: true,  city: "Williamsburg" },
    { name: "Zoe",     age: 25, profession: "Photographer",     archetype: "safety_first_woman", photo: "https://images.unsplash.com/photo-1614283233556-f35b0c801ef1?w=160&q=80&auto=format&fit=crop", online: false, city: "Park Slope",        lastSeen: "12m" },
    { name: "Lena",    age: 27, profession: "Brand strategist", archetype: "spoilt_woman",       photo: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=160&q=80&auto=format&fit=crop", online: true,  city: "Fort Greene" },
    { name: "Iris",    age: 24, profession: "Med student",      archetype: "safety_first_woman", photo: "https://images.unsplash.com/photo-1502323777036-f29e3972d82f?w=160&q=80&auto=format&fit=crop", online: false, city: "Bushwick",          lastSeen: "1h" },
    { name: "Camille", age: 29, profession: "Lawyer",           archetype: "spoilt_woman",       photo: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=160&q=80&auto=format&fit=crop", online: true,  city: "DUMBO" },
    { name: "Noor",    age: 26, profession: "Designer",         archetype: "safety_first_woman", photo: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=160&q=80&auto=format&fit=crop", online: true,  city: "Cobble Hill" },
    { name: "Talia",   age: 30, profession: "VC analyst",       archetype: "spoilt_woman",       photo: "https://images.unsplash.com/photo-1546961342-1531b89bb091?w=160&q=80&auto=format&fit=crop", online: false, city: "Prospect Heights", lastSeen: "1d" },
    { name: "Reyna",   age: 25, profession: "Fashion buyer",    archetype: "spoilt_woman",       photo: "https://images.unsplash.com/photo-1554151228-14d9def656e4?w=160&q=80&auto=format&fit=crop", online: true,  city: "Greenpoint" },
    { name: "Anouk",   age: 27, profession: "Curator",          archetype: "safety_first_woman", photo: "https://images.unsplash.com/photo-1554727242-741c14fa561c?w=160&q=80&auto=format&fit=crop", online: false, city: "Bed-Stuy",         lastSeen: "2d" }
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
