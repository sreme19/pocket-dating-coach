// Verified Vibe — Constants & Archetype Data

import type { ArchetypeDefinition } from './types';

export const ARCHETYPES: Record<string, ArchetypeDefinition> = {
  casual_man: {
    id: 'casual_man',
    gender: 'man',
    emoji: '🎯',
    name: 'Casual Man',
    tag: 'Casual dating & real connection',
    longTag: 'You want casual dating & real connection. No pretense. Real vibes.',
    matchTraits: [
      { lead: true, label: '💎 Spoilt Women' },
      { label: 'Financially motivated' },
      { label: 'Loves established men' },
      { label: 'Socially savvy' },
      { label: 'Luxury dater' },
      { label: 'Open to short-term' }
    ],
    avoidTraits: [
      { label: 'Romantic idealists' },
      { label: 'Anti-transactional' },
      { label: 'Anti-materialistic' },
      { label: 'Hates status games' },
      { label: 'Looking for forever' }
    ],
    brings: [
      'Financial stability',
      'Generosity mindset',
      'Upscale travel & restaurants',
      'Privacy & discretion',
      'Confidence without arrogance',
      'Respect & safety',
      'Business insight',
      'Emotional maturity'
    ],
    needs: [
      'Government ID (prove you\'re real)',
      '5+ photos (prove it\'s really you)',
      'Spending pattern (prove you\'re solid)',
      'Q&A responses (prove your intent)'
    ],
    timeMins: 10
  },
  spoilt_woman: {
    id: 'spoilt_woman',
    gender: 'woman',
    emoji: '💎',
    name: 'Spoilt Woman',
    tag: 'Want to be treated like royalty',
    longTag: 'You want to be cherished — properly. Dinners, weekends, intent.',
    matchTraits: [
      { lead: true, label: '🎯 Casual Men' },
      { lead: true, label: '💍 Marriage-Minded Men' },
      { label: 'Established earners' },
      { label: 'Generous on dates' },
      { label: 'Knows what he wants' },
      { label: 'Cherishes effort' }
    ],
    avoidTraits: [
      { label: 'Cheapskates' },
      { label: 'Avoidants' },
      { label: 'Anti-luxury' },
      { label: 'Game players' },
      { label: 'Bare-minimum daters' }
    ],
    brings: [
      'Elegance & poise',
      'High social IQ',
      'Conversation chops',
      'Style & taste',
      'Loyalty when chosen',
      'Sense of occasion',
      'Sharp wit',
      'Genuine appreciation'
    ],
    needs: [
      'Government ID (prove you\'re real)',
      '5+ photos (prove it\'s really you)',
      'Q&A responses (prove your standards)'
    ],
    timeMins: 8
  },
  marriage_minded_man: {
    id: 'marriage_minded_man',
    gender: 'man',
    emoji: '💍',
    name: 'Marriage-Minded Man',
    tag: 'Looking for serious & forever',
    longTag: 'You\'re done playing. You want a partner, and you\'re building toward it.',
    matchTraits: [
      { lead: true, label: '💎 Spoilt Women' },
      { lead: true, label: '🛡️ Safety-First Women' },
      { label: 'Marriage-ready' },
      { label: 'Family-oriented' },
      { label: 'Done with games' },
      { label: 'Wants commitment' }
    ],
    avoidTraits: [
      { label: 'Situationship seekers' },
      { label: 'Anti-commitment' },
      { label: 'Hookup mindset' },
      { label: 'Forever-single types' },
      { label: 'Career-only (for now)' }
    ],
    brings: [
      'Long-term commitment',
      'Financial stability',
      'Family-ready mindset',
      'Emotional availability',
      'Provider mentality',
      'Respect & safety',
      'Clear communication',
      'Settled lifestyle'
    ],
    needs: [
      'Government ID',
      '5+ photos',
      'Spending pattern',
      'Q&A responses',
      '(Optional) Background check'
    ],
    timeMins: 12
  },
  safety_first_woman: {
    id: 'safety_first_woman',
    gender: 'woman',
    emoji: '🛡️',
    name: 'Safety-First Woman',
    tag: 'Need verified, non-creep vibes',
    longTag: 'Trust is non-negotiable. You date people who have done the work.',
    matchTraits: [
      { lead: true, label: '💍 Marriage-Minded Men only' },
      { label: 'Verified earners' },
      { label: 'Boundary-respecters' },
      { label: 'Slow-pace daters' },
      { label: 'Therapized' },
      { label: 'Background-check ready' }
    ],
    avoidTraits: [
      { label: 'Anonymous accounts' },
      { label: 'Boundary-pushers' },
      { label: 'Fast-movers' },
      { label: 'Casual-only' },
      { label: 'Red-flag carriers' }
    ],
    brings: [
      'Clear boundaries',
      'Emotional intelligence',
      'Self-respect',
      'Sharp discernment',
      'Total honesty',
      'Healthy attachment',
      'Reliable presence',
      'Patience'
    ],
    needs: [
      'Government ID',
      '5+ photos',
      'Q&A responses'
    ],
    timeMins: 6
  }
};

export const MATCH_MATRIX: Record<string, string[]> = {
  casual_man: ['spoilt_woman'],
  marriage_minded_man: ['spoilt_woman', 'safety_first_woman'],
  spoilt_woman: ['casual_man', 'marriage_minded_man'],
  safety_first_woman: ['marriage_minded_man']
};

export const ARCHETYPES_BY_GENDER = {
  man: ['casual_man', 'marriage_minded_man'],
  woman: ['spoilt_woman', 'safety_first_woman'],
  prefer_not_to_say: ['casual_man', 'marriage_minded_man', 'spoilt_woman', 'safety_first_woman']
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
  casual_man: COLOR_PALETTE.emerald,
  marriage_minded_man: COLOR_PALETTE.mint,
  spoilt_woman: COLOR_PALETTE.amber,
  safety_first_woman: COLOR_PALETTE.lime
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
