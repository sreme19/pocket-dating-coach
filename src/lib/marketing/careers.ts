// Careers content — open roles and full job descriptions.
// Kept as plain data so the /careers index and each /careers/[slug] detail
// page render from a single source of truth.

export interface JobRole {
  slug: string;
  title: string;
  team: string;
  location: string;
  type: string; // e.g. "Full-time" · "Remote"
  /** One-line hook shown at the top of the detail page. */
  tagline: string;
  /** Intro paragraphs for the role. */
  about: string[];
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
  /** What riteangle offers. */
  offer: string[];
}

export const OPEN_ROLES: JobRole[] = [
  {
    slug: 'marketing-associate-indonesia',
    title: 'Marketing Associate',
    team: 'Growth & Marketing',
    location: 'Jakarta, Indonesia (Remote)',
    type: 'Part-time',
    tagline:
      'Own riteangle’s launch and growth across Indonesia — from campus campaigns to creators to community.',
    about: [
      'riteangle is a verified-first dating app: every member is identity-verified, matches are earned on what people actually value, and a private AI coach helps each side date honestly. We’re expanding into Indonesia — one of the most vibrant, mobile-first dating markets in the world — and we’re looking for a Marketing Associate to help us launch and grow here.',
      'This is a hands-on, high-ownership role for someone early in their marketing career who wants to build a brand from the ground up in their home market. You’ll be our person on the ground in Indonesia: shaping how riteangle shows up locally, running experiments, and turning curiosity into verified members.',
    ],
    responsibilities: [
      'Plan and run local growth campaigns across Instagram, TikTok, and emerging Indonesian social platforms — from concept to creative brief to reporting.',
      'Localize riteangle’s brand and messaging for Indonesian audiences (Bahasa Indonesia and English), keeping the tone honest, warm, and safety-first.',
      'Build and manage relationships with local creators, micro-influencers, and campus ambassadors to drive verified sign-ups.',
      'Coordinate on-the-ground activations — campus events, city meetups, and partnership pop-ups in Jakarta and other key cities.',
      'Track funnel metrics (installs, verifications, activated matches) and report weekly on what’s working and what to cut.',
      'Gather local user insight and feed it back to product and trust & safety so the app fits how Indonesians actually date.',
      'Manage community channels and respond to the local audience with a consistent, on-brand voice.',
    ],
    requirements: [
      'No prior experience required — this role is open to freshers. Full training is provided; what matters is drive, curiosity, and a feel for social media.',
      'Based in Indonesia (Jakarta preferred) with a strong understanding of local culture, platforms, and dating norms.',
      'Native or fluent Bahasa Indonesia and professional working English.',
      'Hands-on with content creation and social tooling — you can brief, shoot, caption, and ship a post without waiting on a big team.',
      'Comfortable with numbers: you set a goal, measure it, and adjust.',
      'Self-starter who thrives with autonomy in a small, remote-first team.',
    ],
    niceToHave: [
      'Experience launching a product or brand in a new market.',
      'An existing network of Indonesian creators or campus communities.',
      'Familiarity with dating, social, or trust & safety products.',
      'Basic design skills (Canva/Figma) or short-form video editing.',
    ],
    offer: [
      'Real ownership of a market from day one — your work is the growth engine for riteangle in Indonesia.',
      'Remote-first, async-friendly team with senior teammates who’ve built consumer products before.',
      'Competitive salary in IDR plus performance-based growth bonuses.',
      'Budget for campaigns, creators, and local activations that you help direct.',
      'A mission you can stand behind: making dating safer and more honest.',
    ],
  },
];

export const getRole = (slug: string): JobRole | undefined =>
  OPEN_ROLES.find((r) => r.slug === slug);
