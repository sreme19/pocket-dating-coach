// Verified Vibe — Constants & Archetype Data

import type { ArchetypeDefinition } from './types';

export const ARCHETYPES: Record<string, ArchetypeDefinition> = {

  // ─── MALE ARCHETYPES ────────────────────────────────────────────────────────

  casual_generous_man: {
    id: 'casual_generous_man',
    gender: 'man',
    emoji: '💸',
    name: 'Casual-Generous',
    tag: 'Confident, generous, experiences over labels',
    longTag: 'You date well and you show it. Experiences over labels — dinners, weekends, no strings attached to who picks up the bill.',
    matchTraits: [
      { tier: 'best', lead: true, label: 'Spoiled-Casual Women' },
      { tier: 'good', label: 'Rebound-Healing Women' },
      { tier: 'good', label: 'Hopeless-Romantic Women' },
    ],
    avoidTraits: [
      { label: 'Forever-Focused' },
      { label: 'Traditional-Matrimony' },
    ],
    brings: [
      'Financial confidence',
      'Upscale experiences',
      'No-pressure energy',
      'Privacy & discretion',
      'Generosity as a love language',
      'Clarity of intent',
    ],
    needs: [
      'Government ID (prove you\'re real)',
      '5+ photos (prove it\'s really you)',
      'Spending pattern (prove you\'re solid)',
      'Q&A responses (prove your intent)',
    ],
    timeMins: 10,
  },

  hopeless_romantic_man: {
    id: 'hopeless_romantic_man',
    gender: 'man',
    emoji: '💞',
    name: 'Hopeless-Romantic',
    tag: 'Emotionally intense, chasing the deep thing',
    longTag: 'You\'re not here for casual. You feel deeply and you\'re not ashamed of it. You want connection that means something.',
    matchTraits: [
      { tier: 'best', lead: true, label: 'Hopeless-Romantic Women' },
      { tier: 'good', label: 'Untouched-Heart Women' },
      { tier: 'good', label: 'Forever-Focused Women' },
      { tier: 'good', label: 'Traditional-Matrimony Women' },
    ],
    avoidTraits: [
      { label: 'Spoiled-Casual' },
      { label: 'Rebound-Healing' },
    ],
    brings: [
      'Deep emotional availability',
      'Fierce loyalty',
      'Romantic intentionality',
      'Vulnerability without weakness',
      'Warmth & presence',
    ],
    needs: [
      'Government ID (prove you\'re real)',
      '5+ photos (prove it\'s really you)',
      'Q&A responses (prove your depth)',
    ],
    timeMins: 8,
  },

  rebound_healing_man: {
    id: 'rebound_healing_man',
    gender: 'man',
    emoji: '🌱',
    name: 'Rebound-Healing',
    tag: 'Recovering, honest, not rushing',
    longTag: 'You\'ve been through it. You\'re not hiding that — and you\'re not dragging it either. You\'re ready to explore, slowly.',
    matchTraits: [
      { tier: 'best', lead: true, label: 'Rebound-Healing Women' },
      { tier: 'good', label: 'Untouched-Heart Women' },
      { tier: 'good', label: 'Spoiled-Casual Women' },
    ],
    avoidTraits: [
      { label: 'Forever-Focused' },
      { label: 'Traditional-Matrimony' },
    ],
    brings: [
      'Hard-won emotional intelligence',
      'Radical honesty',
      'No-games energy',
      'Self-awareness',
      'Appreciation for real connection',
    ],
    needs: [
      'Government ID (prove you\'re real)',
      '5+ photos (prove it\'s really you)',
      'Q&A responses (prove your intent)',
    ],
    timeMins: 8,
  },

  untouched_heart_man: {
    id: 'untouched_heart_man',
    gender: 'man',
    emoji: '🕊️',
    name: 'Untouched-Heart',
    tag: 'Inexperienced, sincere, going slow',
    longTag: 'You haven\'t dated much, and you\'re owning it. You\'re thoughtful, sincere, and bringing zero baggage.',
    matchTraits: [
      { tier: 'best', lead: true, label: 'Untouched-Heart Women' },
      { tier: 'good', label: 'Hopeless-Romantic Women' },
      { tier: 'good', label: 'Forever-Focused Women' },
    ],
    avoidTraits: [
      { label: 'Spoiled-Casual' },
      { label: 'Rebound-Healing' },
    ],
    brings: [
      'Genuine curiosity',
      'Open heart',
      'Zero emotional baggage',
      'Slow, intentional approach',
      'Sincerity in every step',
    ],
    needs: [
      'Government ID (prove you\'re real)',
      '5+ photos (prove it\'s really you)',
      'Q&A responses (prove your sincerity)',
    ],
    timeMins: 6,
  },

  forever_focused_man: {
    id: 'forever_focused_man',
    gender: 'man',
    emoji: '🎯',
    name: 'Forever-Focused',
    tag: 'Marriage-minded, intentional, done with games',
    longTag: 'You\'re building something real and you\'re selective about who\'s in it. Intentional dating only — no maybes.',
    matchTraits: [
      { tier: 'best', lead: true, label: 'Forever-Focused Women' },
      { tier: 'best', label: 'Traditional-Matrimony Women' },
      { tier: 'good', label: 'Untouched-Heart Women' },
      { tier: 'good', label: 'Hopeless-Romantic Women' },
    ],
    avoidTraits: [
      { label: 'Spoiled-Casual' },
      { label: 'Rebound-Healing' },
    ],
    brings: [
      'Long-term commitment',
      'Financial stability',
      'Partnership mindset',
      'Clear communication',
      'Emotional maturity',
      'Settled, grounded lifestyle',
    ],
    needs: [
      'Government ID (prove you\'re real)',
      '5+ photos (prove it\'s really you)',
      'Spending pattern (prove you\'re solid)',
      'Q&A responses (prove your intent)',
    ],
    timeMins: 12,
  },

  traditional_matrimony_man: {
    id: 'traditional_matrimony_man',
    gender: 'man',
    emoji: '🏛️',
    name: 'Traditional-Matrimony',
    tag: 'Hard set on matrimony, family values, cultural fit',
    longTag: 'Marriage is the goal, not the conversation. Family fit, shared values, cultural alignment — these aren\'t compromises, they\'re the point.',
    matchTraits: [
      { tier: 'best', lead: true, label: 'Forever-Focused Women' },
      { tier: 'best', label: 'Traditional-Matrimony Women' },
      { tier: 'good', label: 'Untouched-Heart Women' },
      { tier: 'good', label: 'Hopeless-Romantic Women' },
    ],
    avoidTraits: [
      { label: 'Spoiled-Casual' },
      { label: 'Rebound-Healing' },
    ],
    brings: [
      'Family-first values',
      'Cultural alignment',
      'Long-term commitment',
      'Clear expectations',
      'Stability & structure',
      'Respect for tradition',
    ],
    needs: [
      'Government ID (prove you\'re real)',
      '5+ photos (prove it\'s really you)',
      'Spending pattern (prove you\'re solid)',
      'Q&A responses (prove your values)',
    ],
    timeMins: 12,
  },

  // ─── FEMALE ARCHETYPES ──────────────────────────────────────────────────────

  spoiled_casual_woman: {
    id: 'spoiled_casual_woman',
    gender: 'woman',
    emoji: '✨',
    name: 'Spoiled-Casual',
    tag: 'Luxury vibes, treated well, no pressure',
    longTag: 'You want to be wined, dined and genuinely enjoyed — without labels and without apology. Life is short; experience it at full quality.',
    matchTraits: [
      { tier: 'best', lead: true, label: 'Casual-Generous Men' },
      { tier: 'good', label: 'Rebound-Healing Men' },
    ],
    avoidTraits: [
      { label: 'Forever-Focused' },
      { label: 'Traditional-Matrimony' },
      { label: 'Hopeless-Romantic' },
    ],
    brings: [
      'Elegance & poise',
      'High social IQ',
      'Conversation that actually lands',
      'Style & taste',
      'Loyalty when chosen',
      'Genuine appreciation for effort',
    ],
    needs: [
      'Government ID (prove you\'re real)',
      '5+ photos (prove it\'s really you)',
      'Q&A responses (prove your standards)',
    ],
    timeMins: 8,
  },

  hopeless_romantic_woman: {
    id: 'hopeless_romantic_woman',
    gender: 'woman',
    emoji: '🌹',
    name: 'Hopeless-Romantic',
    tag: 'Emotionally intense, chasing the deep thing',
    longTag: 'You feel everything and you\'re not sorry about it. You want a love that\'s real, consuming and worth the risk.',
    matchTraits: [
      { tier: 'best', lead: true, label: 'Hopeless-Romantic Men' },
      { tier: 'good', label: 'Untouched-Heart Men' },
      { tier: 'good', label: 'Forever-Focused Men' },
    ],
    avoidTraits: [
      { label: 'Casual-Generous' },
      { label: 'Rebound-Healing' },
    ],
    brings: [
      'Deep emotional availability',
      'Fierce loyalty',
      'Romantic intentionality',
      'Warmth & unwavering presence',
      'The kind of love that lingers',
    ],
    needs: [
      'Government ID (prove you\'re real)',
      '5+ photos (prove it\'s really you)',
      'Q&A responses (prove your depth)',
    ],
    timeMins: 8,
  },

  rebound_healing_woman: {
    id: 'rebound_healing_woman',
    gender: 'woman',
    emoji: '🌿',
    name: 'Rebound-Healing',
    tag: 'Recovering, honest, finding her footing',
    longTag: 'You\'ve come out the other side and you know yourself better for it. You\'re not guarded — you\'re thoughtful.',
    matchTraits: [
      { tier: 'best', lead: true, label: 'Rebound-Healing Men' },
      { tier: 'good', label: 'Untouched-Heart Men' },
      { tier: 'good', label: 'Casual-Generous Men' },
    ],
    avoidTraits: [
      { label: 'Traditional-Matrimony' },
      { label: 'Forever-Focused' },
    ],
    brings: [
      'Hard-won self-awareness',
      'Empathy without co-dependence',
      'Emotional authenticity',
      'No baggage disguised as personality',
      'Perspective that makes you a better partner',
    ],
    needs: [
      'Government ID (prove you\'re real)',
      '5+ photos (prove it\'s really you)',
      'Q&A responses (prove your intent)',
    ],
    timeMins: 8,
  },

  untouched_heart_woman: {
    id: 'untouched_heart_woman',
    gender: 'woman',
    emoji: '🌸',
    name: 'Untouched-Heart',
    tag: 'First steps, sincere, no games in her',
    longTag: 'You haven\'t dated much, and you\'re bringing exactly that energy — open, curious and completely without agenda.',
    matchTraits: [
      { tier: 'best', lead: true, label: 'Untouched-Heart Men' },
      { tier: 'good', label: 'Hopeless-Romantic Men' },
      { tier: 'good', label: 'Forever-Focused Men' },
    ],
    avoidTraits: [
      { label: 'Casual-Generous' },
      { label: 'Rebound-Healing' },
    ],
    brings: [
      'Genuine curiosity',
      'Zero emotional baggage',
      'Completely open heart',
      'Slow, intentional pace',
      'Sincerity at every stage',
    ],
    needs: [
      'Government ID (prove you\'re real)',
      '5+ photos (prove it\'s really you)',
      'Q&A responses (prove your sincerity)',
    ],
    timeMins: 6,
  },

  forever_focused_woman: {
    id: 'forever_focused_woman',
    gender: 'woman',
    emoji: '💍',
    name: 'Forever-Focused',
    tag: 'Marriage-minded, knows what she wants',
    longTag: 'You\'re not auditioning anyone. You know what you\'re building and who belongs in it. Intentional — every step.',
    matchTraits: [
      { tier: 'best', lead: true, label: 'Forever-Focused Men' },
      { tier: 'best', label: 'Traditional-Matrimony Men' },
      { tier: 'good', label: 'Untouched-Heart Men' },
      { tier: 'good', label: 'Hopeless-Romantic Men' },
    ],
    avoidTraits: [
      { label: 'Casual-Generous' },
      { label: 'Rebound-Healing' },
    ],
    brings: [
      'Clarity of intent',
      'Ambition in life and love',
      'Partnership-first mindset',
      'Long-term thinking',
      'Emotional intelligence under pressure',
    ],
    needs: [
      'Government ID (prove you\'re real)',
      '5+ photos (prove it\'s really you)',
      'Q&A responses (prove your intent)',
    ],
    timeMins: 10,
  },

  traditional_matrimony_woman: {
    id: 'traditional_matrimony_woman',
    gender: 'woman',
    emoji: '🏛️',
    name: 'Traditional-Matrimony',
    tag: 'Family fit, cultural match, matrimony is the goal',
    longTag: 'Marriage isn\'t a milestone — it\'s the direction. Family alignment, cultural fit and shared values are the foundation, not the fine print.',
    matchTraits: [
      { tier: 'best', lead: true, label: 'Forever-Focused Men' },
      { tier: 'best', label: 'Traditional-Matrimony Men' },
      { tier: 'good', label: 'Hopeless-Romantic Men' },
    ],
    avoidTraits: [
      { label: 'Casual-Generous' },
      { label: 'Rebound-Healing' },
      { label: 'Untouched-Heart' },
    ],
    brings: [
      'Family-first values',
      'Cultural alignment',
      'Commitment with zero ambiguity',
      'Clear expectations upfront',
      'Stability & long-term partnership',
    ],
    needs: [
      'Government ID (prove you\'re real)',
      '5+ photos (prove it\'s really you)',
      'Q&A responses (prove your values)',
    ],
    timeMins: 10,
  },
};

export const MATCH_MATRIX: Record<string, string[]> = {
  // Men → compatible women (best + good fit)
  casual_generous_man:      ['spoiled_casual_woman', 'rebound_healing_woman', 'hopeless_romantic_woman'],
  hopeless_romantic_man:    ['hopeless_romantic_woman', 'untouched_heart_woman', 'forever_focused_woman', 'traditional_matrimony_woman'],
  rebound_healing_man:      ['rebound_healing_woman', 'untouched_heart_woman', 'spoiled_casual_woman'],
  untouched_heart_man:      ['untouched_heart_woman', 'hopeless_romantic_woman', 'forever_focused_woman'],
  forever_focused_man:      ['forever_focused_woman', 'traditional_matrimony_woman', 'untouched_heart_woman', 'hopeless_romantic_woman'],
  traditional_matrimony_man:['forever_focused_woman', 'traditional_matrimony_woman', 'untouched_heart_woman', 'hopeless_romantic_woman'],
  // Women → compatible men
  spoiled_casual_woman:        ['casual_generous_man', 'rebound_healing_man'],
  hopeless_romantic_woman:     ['hopeless_romantic_man', 'untouched_heart_man', 'forever_focused_man'],
  rebound_healing_woman:       ['rebound_healing_man', 'untouched_heart_man', 'casual_generous_man'],
  untouched_heart_woman:       ['untouched_heart_man', 'hopeless_romantic_man', 'forever_focused_man'],
  forever_focused_woman:       ['forever_focused_man', 'traditional_matrimony_man', 'untouched_heart_man', 'hopeless_romantic_man'],
  traditional_matrimony_woman: ['forever_focused_man', 'traditional_matrimony_man', 'hopeless_romantic_man'],
};

export const ARCHETYPES_BY_GENDER = {
  man: [
    'casual_generous_man',
    'hopeless_romantic_man',
    'rebound_healing_man',
    'untouched_heart_man',
    'forever_focused_man',
    'traditional_matrimony_man',
  ],
  woman: [
    'spoiled_casual_woman',
    'hopeless_romantic_woman',
    'rebound_healing_woman',
    'untouched_heart_woman',
    'forever_focused_woman',
    'traditional_matrimony_woman',
  ],
  prefer_not_to_say: [
    'casual_generous_man', 'hopeless_romantic_man', 'rebound_healing_man',
    'untouched_heart_man', 'forever_focused_man', 'traditional_matrimony_man',
    'spoiled_casual_woman', 'hopeless_romantic_woman', 'rebound_healing_woman',
    'untouched_heart_woman', 'forever_focused_woman', 'traditional_matrimony_woman',
  ],
};

export const VERIFICATION_STEPS = [
  { step: 'id', label: 'Government ID', description: 'Verify your identity', time: '2 min' },
  { step: 'liveness', label: 'Liveness Check', description: 'Prove it\'s really you', time: '1 min' },
  { step: 'photos', label: 'Photo Story', description: 'Upload 5+ photos', time: '3 min' },
  { step: 'spending_or_qa', label: 'Spending/Q&A', description: 'Prove your intent', time: '4 min' }
];

export const TRUST_SCORE_BREAKDOWN = {
  identity: { max: 30, label: 'Identity' },
  lifestyle: { max: 45, label: 'Lifestyle' },
  intent: { max: 20, label: 'Intent' }
};

// Color Palette Constants
export const COLOR_PALETTE = {
  // Primary Accent Colors
  emerald: '#10b981',
  mint: '#14b8a6',
  lime: '#84cc16',
  amber: '#f59e0b',

  // Background Colors (Light Mode)
  bgPrimary: '#ffffff',
  bgSecondary: '#f9fafb',
  bgTertiary: '#f3f4f6',

  // Text Colors (Light Mode)
  textPrimary: '#111827',
  textSecondary: '#374151',
  textTertiary: '#6b7280',
  textQuaternary: '#9ca3af',

  // Border Colors
  border: '#e5e7eb',
  borderLight: '#f3f4f6',

  // Status Colors
  success: '#84cc16',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6'
};

// UI Text Constants
export const UI_TEXT = {
  // Gate Screen
  gate: {
    title: 'Verified Vibe',
    subtitle: 'Real connections. Real people. Real trust.',
    genderLabel: 'I identify as',
    ageLabel: 'I confirm I\'m 18+',
    continueButton: 'Continue',
    selectGender: 'Please select your gender',
    confirmAge: 'Please confirm you\'re 18+'
  },

  // Home Screen
  home: {
    title: 'Choose Your Archetype',
    subtitle: 'Pick the one that feels most like you',
    lockButton: 'Lock it in',
    expandButton: 'Learn more',
    collapseButton: 'Hide details',
    liveNowTitle: 'Live Now',
    liveNowSubtitle: 'Active users right now'
  },

  // Verify Requirements Screen
  verify: {
    title: 'Verification Steps',
    subtitle: 'Build trust in 4 simple steps',
    totalTime: 'Total time',
    startButton: 'Start Verification',
    backButton: 'Back',
    stepNumber: 'Step',
    of: 'of'
  },

  // Verification Flow
  verification: {
    title: 'Verify Your Profile',
    progressLabel: 'Progress',
    nextButton: 'Next',
    backButton: 'Back',
    skipButton: 'Skip',
    submitButton: 'Submit',
    completeButton: 'Complete',
    
    // Step 1: ID
    idTitle: 'Government ID',
    idDescription: 'Upload a clear photo of your government ID',
    idUploadLabel: 'Upload ID Photo',
    idConfirmLabel: 'Confirm extracted information',
    idExtracted: 'ID information extracted',
    
    // Step 2: Liveness
    livenessTitle: 'Liveness Check',
    livenessDescription: 'Take a selfie to prove it\'s really you',
    livenessUploadLabel: 'Take Selfie',
    livenessMatching: 'Comparing your face to your ID...',
    livenessSuccess: 'Face matches ID',
    
    // Step 3: Photos
    photosTitle: 'Photo Story',
    photosDescription: 'Upload 5+ photos that tell your story',
    photosUploadLabel: 'Upload Photos',
    photosLabel: 'Label each photo',
    photosConsistency: 'Checking photo consistency...',
    photosSuccess: 'Photos verified',
    
    // Step 4: Spending/Q&A
    spendingTitle: 'Spending Pattern',
    spendingDescription: 'Upload a bank statement or spending screenshot',
    qaTitle: 'Q&A',
    qaDescription: 'Answer a few questions about your dating intent',
    qaSuccess: 'Q&A complete'
  },

  // Trust Dashboard
  trust: {
    title: 'Your Trust Score',
    subtitle: 'How trustworthy you appear to matches',
    profileTitle: 'Your Profile',
    editButton: 'Edit Profile',
    editQaButton: 'Edit Q&A',
    shareButton: 'Share Profile',
    categoryBreakdown: 'Category Breakdown',
    completedSteps: 'Completed Steps'
  },

  // Discovery Screen
  discover: {
    title: 'Discover',
    noMoreCards: 'No more profiles',
    noMoreCardsSubtitle: 'Check back later for new matches',
    likeButton: 'Like',
    passButton: 'Pass',
    messageButton: 'Message',
    distance: 'mi away',
    trustScore: 'Trust Score'
  },

  // Chat Screen
  chat: {
    title: 'Messages',
    inputPlaceholder: 'Type a message...',
    sendButton: 'Send',
    noMessages: 'No messages yet',
    noMessagesSubtitle: 'Start the conversation',
    typing: 'is typing...',
    online: 'Online',
    offline: 'Offline',
    lastSeen: 'Last seen'
  },

  // Match Overlay
  match: {
    title: 'It\'s a Match!',
    subtitle: 'You both liked each other',
    sendMessageButton: 'Send Message',
    closeButton: 'Close',
    congratulations: 'Congratulations!'
  },

  // Common
  loading: 'Loading...',
  error: 'Something went wrong',
  retry: 'Try Again',
  cancel: 'Cancel',
  save: 'Save',
  delete: 'Delete',
  close: 'Close',
  confirm: 'Confirm',
  success: 'Success',
  warning: 'Warning',
  info: 'Info'
};

// Archetype Color Mapping
export const ARCHETYPE_COLORS: Record<string, string> = {
  casual_generous_man:       COLOR_PALETTE.emerald,
  hopeless_romantic_man:     COLOR_PALETTE.mint,
  rebound_healing_man:       COLOR_PALETTE.lime,
  untouched_heart_man:       COLOR_PALETTE.info,
  forever_focused_man:       COLOR_PALETTE.mint,
  traditional_matrimony_man: COLOR_PALETTE.amber,
  spoiled_casual_woman:        COLOR_PALETTE.amber,
  hopeless_romantic_woman:     COLOR_PALETTE.mint,
  rebound_healing_woman:       COLOR_PALETTE.lime,
  untouched_heart_woman:       COLOR_PALETTE.info,
  forever_focused_woman:       COLOR_PALETTE.emerald,
  traditional_matrimony_woman: COLOR_PALETTE.amber,
};

// Verification Step Status Messages
export const VERIFICATION_STATUS_MESSAGES = {
  pending: 'Not started',
  completed: 'Completed',
  failed: 'Failed - Please try again',
  inProgress: 'In progress...'
};

// Trust Score Ranges
export const TRUST_SCORE_RANGES = {
  veryLow: { min: 0, max: 20, label: 'Very Low', color: COLOR_PALETTE.error },
  low: { min: 21, max: 40, label: 'Low', color: COLOR_PALETTE.warning },
  medium: { min: 41, max: 60, label: 'Medium', color: COLOR_PALETTE.amber },
  high: { min: 61, max: 80, label: 'High', color: COLOR_PALETTE.lime },
  veryHigh: { min: 81, max: 100, label: 'Very High', color: COLOR_PALETTE.emerald }
};
