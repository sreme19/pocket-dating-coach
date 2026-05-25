<script lang="ts">
  import { fade, slide, scale } from 'svelte/transition';
  import type { Gender } from '../types';

  interface Props {
    gender?: Gender;
    archetype?: string;
    onSubmit?: (data: { responses: Record<string, string | string[]> }) => Promise<void>;
    onCancel?: () => void;
  }

  let { gender = 'prefer_not_to_say', archetype, onSubmit, onCancel }: Props = $props();

  // State management
  let currentQuestionIndex = $state(0);
  let responses = $state<Record<string, string | string[]>>({});
  let loading = $state(false);
  let error = $state<string | null>(null);
  let step = $state<'questions' | 'review' | 'submitting'>('questions');

  interface Question {
    id: string;
    type: 'multiple-choice' | 'multi-select' | 'text';
    question: string;
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
  }

  const TIMELINE_OPTIONS = [
    { value: 'asap', label: "⚡ ASAP — I'm ready now" },
    { value: 'months', label: '📅 Within the next few months' },
    { value: 'year', label: '🌱 Within the next year or two' },
    { value: 'no_rush', label: '🌊 No rush, whenever it happens' }
  ];

  const MATRIMONY_QUESTIONS: Question[] = [
    {
      id: 'wedding_vision',
      type: 'multiple-choice',
      question: '💍 What kind of wedding are you envisioning?',
      options: [
        { value: 'intimate', label: '🥂 Intimate — close family & friends' },
        { value: 'traditional', label: '🪔 Traditional — full ceremony & rituals' },
        { value: 'big', label: '🎉 Grand — large, celebratory event' },
        { value: 'destination', label: '✈️ Destination — something unique' }
      ]
    },
    {
      id: 'family_involvement',
      type: 'multiple-choice',
      question: '👨‍👩‍👧‍👦 How involved would your family be in choosing a partner?',
      options: [
        { value: 'fully_involved', label: '🏡 Fully — family leads the search' },
        { value: 'guided', label: '🤝 Guided — family approves the choice' },
        { value: 'informed', label: '💬 Informed — I decide, family knows' },
        { value: 'independent', label: '🦁 Independent — my choice, my way' }
      ]
    },
    {
      id: 'lifestyle_values',
      type: 'text',
      question: '🌿 What lifestyle values matter most to you? (e.g., faith, culture, traditions)',
      placeholder: 'Share what matters to you...'
    },
    {
      id: 'relationship_timeline',
      type: 'multiple-choice',
      question: "🗓️ What's your ideal relationship timeline?",
      options: TIMELINE_OPTIONS
    },
    {
      id: 'deal_breakers',
      type: 'text',
      question: "🚫 What are your deal-breakers in a partner?",
      placeholder: "Be honest about what won't work for you..."
    }
  ];

  const SPOILED_CASUAL_QUESTIONS: Question[] = [
    {
      id: 'date_expectations',
      type: 'multiple-choice',
      question: '✨ What do you expect from a date?',
      options: [
        { value: 'chemistry', label: '☕ Simple chemistry first' },
        { value: 'intentional', label: '🌸 Intentional & thoughtful' },
        { value: 'premium', label: '🍷 Premium experiences' },
        { value: 'spoiled', label: '✨ Spoiled & celebrated' }
      ]
    },
    {
      id: 'relationship_energy',
      type: 'multi-select',
      question: '✨ Describe the energy you want in a relationship',
      options: [
        { value: 'generous', label: '💎 Generous' },
        { value: 'well_traveled', label: '🌍 Well-traveled' },
        { value: 'affectionate', label: '❤️ Affectionate' },
        { value: 'calm_energy', label: '🧘 Calm energy' },
        { value: 'respectful', label: '🤝 Respectful' },
        { value: 'confident', label: '🧲 Confident' },
        { value: 'provider_mindset', label: '🌹 Provider mindset' },
        { value: 'spontaneous', label: '🎉 Spontaneous' },
        { value: 'discreet', label: '🔒 Discreet' },
        { value: 'high_standards', label: '🏆 High standards' },
        { value: 'flirtatious', label: '✨ Flirtatious' },
        { value: 'after_hours', label: '🌙 After-hours energy' }
      ]
    },
    {
      id: 'relationship_vibe',
      type: 'multi-select',
      question: '✨ How would you describe your vibe in a relationship?',
      options: [
        { value: 'romantic', label: '🌹 Romantic' },
        { value: 'feminine_energy', label: '✨ Feminine energy' },
        { value: 'sweet_caring', label: '🥰 Sweet & caring' },
        { value: 'soft_sensual', label: '🕯️ Soft & sensual' },
        { value: 'flirty', label: '😏 Flirty' },
        { value: 'magnetic', label: '🧲 Magnetic presence' },
        { value: 'glamorous', label: '✨ Glamorous' },
        { value: 'mysterious', label: '🌙 Mysterious vibe' },
        { value: 'chemistry_driven', label: '💫 Chemistry-driven' },
        { value: 'playful_teasing', label: '😘 Playful & teasing' },
        { value: 'sensual_connection', label: '🫦 Sensual connection' }
      ]
    },
    {
      id: 'chemistry_type',
      type: 'multi-select',
      question: '🔥 What kind of chemistry do you enjoy most?',
      options: [
        { value: 'emotional_first', label: '❤️ Emotional connection first' },
        { value: 'instant_sparks', label: '⚡ Instant sparks' },
        { value: 'affection_touch', label: '💋 Affection & touch' },
        { value: 'flirty_banter', label: '😏 Flirty banter' },
        { value: 'romantic_intimacy', label: '🌹 Romantic intimacy' },
        { value: 'sensual_experiences', label: '🍷 Sensual experiences' },
        { value: 'slow_burn', label: '🕯️ Slow-burn attraction' },
        { value: 'passionate', label: '🔥 Passionate chemistry' }
      ]
    },
    {
      id: 'lifestyle_experiences',
      type: 'multi-select',
      question: '✨ What kind of experiences do you enjoy most?',
      options: [
        { value: 'international_travel', label: '🌍 International travel' },
        { value: 'luxury_getaways', label: '🛥️ Luxury getaways' },
        { value: 'fine_dining', label: '🍷 Fine dining' },
        { value: 'designer_shopping', label: '🛍️ Designer shopping' },
        { value: 'premium_lifestyle', label: '💎 Premium lifestyle' },
        { value: 'thoughtful_gifts', label: '🎁 Thoughtful gifts' },
        { value: 'luxury_hotels', label: '🏨 Luxury hotels & resorts' },
        { value: 'vip_events', label: '🎭 VIP events & nightlife' },
        { value: 'spontaneous_trips', label: '✈️ Spontaneous trips' },
        { value: 'relaxing_escapes', label: '🌴 Relaxing escapes' },
        { value: 'wellness_spa', label: '🧘 Wellness & spa experiences' },
        { value: 'art_fashion', label: '🎨 Art, fashion & culture' }
      ]
    },
    {
      id: 'appreciation',
      type: 'multi-select',
      question: '✨ What makes you feel most appreciated?',
      options: [
        { value: 'quality_time', label: '❤️ Quality time' },
        { value: 'attention', label: '💬 Attention & communication' },
        { value: 'gifts_surprises', label: '🎁 Gifts & surprises' },
        { value: 'shared_experiences', label: '✈️ Shared experiences' },
        { value: 'financial_generosity', label: '💎 Financial generosity' },
        { value: 'romance_affection', label: '🌹 Romance & affection' },
        { value: 'luxury_treatment', label: '🥂 Luxury treatment' },
        { value: 'consistency', label: '🕰️ Consistency & effort' }
      ]
    },
    {
      id: 'intimacy_openness',
      type: 'multi-select',
      question: '💋 What kind of chemistry and intimacy are you open to exploring?',
      options: [
        { value: 'pda', label: '💋 PDA' },
        { value: 'roleplay', label: '🕯️ Roleplay' },
        { value: 'power_dynamics', label: '⛓️ Power dynamics' },
        { value: 'sensory_sensual', label: '🌹 Sensory & sensual play' },
        { value: 'exploring_fantasies', label: '✨ Exploring fantasies together' },
        { value: 'teasing_flirtation', label: '😏 Teasing & flirtation' },
        { value: 'emotional_intimacy', label: '❤️ Emotional intimacy focus' },
        { value: 'prefer_discretion', label: '🔒 Prefer discretion' },
        { value: 'experimental', label: '🎭 Experimental experiences' }
      ]
    },
    {
      id: 'boundaries',
      type: 'multi-select',
      question: '🛡️ What boundaries or relationship standards matter most to you?',
      options: [
        { value: 'discretion', label: '🔒 Discretion is important' },
        { value: 'emotionally_respectful', label: '❤️ Emotionally respectful behavior' },
        { value: 'honest_communication', label: '💬 Honest communication' },
        { value: 'no_married', label: '🚫 No married partners' },
        { value: 'safety_trust', label: '🛡️ Safety & trust first' },
        { value: 'clear_expectations', label: '✨ Clear expectations' },
        { value: 'mutual_respect', label: '🤝 Mutual respect' },
        { value: 'no_aggression', label: '🚫 No aggressive behavior' },
        { value: 'consistent_treatment', label: '🌹 Consistent treatment' },
        { value: 'drama_free', label: '🧘 Drama-free connections' },
        { value: 'privacy', label: '🔐 Privacy matters' },
        { value: 'emotional_maturity', label: '❤️ Emotional maturity matters' }
      ]
    }
  ];

  const CASUAL_GENEROUS_QUESTIONS: Question[] = [
    {
      id: 'dating_experience',
      type: 'multi-select',
      question: '✨ What kind of dating experience do you enjoy most?',
      options: [
        { value: 'premium_dining', label: '🍷 Premium dining & cocktails' },
        { value: 'spontaneous_getaways', label: '✈️ Spontaneous getaways' },
        { value: 'traveling_together', label: '🌍 Traveling together' },
        { value: 'luxury_experiences', label: '🛥️ Luxury experiences' },
        { value: 'vip_nightlife', label: '🎭 VIP nightlife & events' },
        { value: 'chemistry_dates', label: '🥂 Chemistry-focused dates' },
        { value: 'companionship', label: '❤️ Meaningful companionship' },
        { value: 'making_feel_special', label: '💎 Making my partner feel special' },
        { value: 'romantic_experiences', label: '🌹 Romantic experiences' },
        { value: 'thoughtful_surprises', label: '🎁 Thoughtful surprises' },
        { value: 'low_pressure', label: '🧘 Relaxed & low-pressure energy' },
        { value: 'passion_attraction', label: '🔥 Passion & attraction' },
        { value: 'memorable_moments', label: '📸 Memorable shared experiences' }
      ]
    },
    {
      id: 'partner_energy',
      type: 'multi-select',
      question: '✨ Describe the energy you want in a relationship',
      options: [
        { value: 'feminine_energy', label: '🌹 Feminine energy' },
        { value: 'affectionate', label: '💋 Affectionate' },
        { value: 'flirty_playful', label: '😏 Flirty & playful' },
        { value: 'confident', label: '✨ Confident' },
        { value: 'emotionally_warm', label: '🥰 Emotionally warm' },
        { value: 'well_traveled', label: '🌍 Well-traveled' },
        { value: 'glamorous', label: '💃 Glamorous' },
        { value: 'adventurous', label: '🎭 Adventurous' },
        { value: 'emotionally_intelligent', label: '❤️ Emotionally intelligent' },
        { value: 'passionate', label: '🔥 Passionate' },
        { value: 'chemistry_driven', label: '💫 Chemistry-driven' },
        { value: 'drama_free', label: '🧘 Drama-free' },
        { value: 'elevated_experiences', label: '🛍️ Enjoys elevated experiences' },
        { value: 'spontaneous', label: '🎉 Spontaneous' },
        { value: 'magnetic', label: '🧲 Magnetic presence' },
        { value: 'discreet', label: '🔒 Discreet' },
        { value: 'sensual', label: '🕯️ Sensual' },
        { value: 'strong_attraction', label: '⚡ Strong attraction matters' },
        { value: 'romantic', label: '🌹 Romantic' },
        { value: 'great_communicator', label: '💬 Great communication' }
      ]
    },
    {
      id: 'relationship_approach',
      type: 'multi-select',
      question: '✨ How would you describe your approach in a relationship?',
      options: [
        { value: 'generous', label: '💎 Generous' },
        { value: 'protective', label: '🛡️ Protective' },
        { value: 'romantic', label: '🌹 Romantic' },
        { value: 'thoughtful', label: '🎁 Thoughtful' },
        { value: 'calm_composed', label: '🧘 Calm & composed' },
        { value: 'loves_shared_exp', label: '✈️ Loves shared experiences' },
        { value: 'communicative', label: '💬 Communicative' },
        { value: 'luxury_lifestyle', label: '🥂 Enjoys luxury lifestyles' },
        { value: 'discreet', label: '🔒 Discreet' },
        { value: 'adventurous', label: '🎭 Adventurous' },
        { value: 'emotionally_supportive', label: '❤️ Emotionally supportive' },
        { value: 'passionate', label: '🔥 Passionate' },
        { value: 'confident_presence', label: '🧲 Confident presence' },
        { value: 'consistent_effort', label: '🕰️ Consistent effort' },
        { value: 'ambitious', label: '💼 Ambitious & driven' }
      ]
    },
    {
      id: 'chemistry_type',
      type: 'multi-select',
      question: '🔥 What kind of chemistry do you enjoy most?',
      options: [
        { value: 'instant_sparks', label: '⚡ Instant sparks' },
        { value: 'affection_touch', label: '💋 Affection & touch' },
        { value: 'flirty_banter', label: '😏 Flirty banter' },
        { value: 'romantic_intimacy', label: '🌹 Romantic intimacy' },
        { value: 'sensual_experiences', label: '🍷 Sensual experiences' },
        { value: 'passionate', label: '🔥 Passionate chemistry' },
        { value: 'slow_burn', label: '🕯️ Slow-burn attraction' },
        { value: 'emotional_connection', label: '❤️ Emotional connection first' },
        { value: 'open_minded', label: '💫 Open-minded connection' },
        { value: 'physical_affection', label: '🥰 Physical affection matters' }
      ]
    },
    {
      id: 'shared_experiences',
      type: 'multi-select',
      question: '✨ What kind of experiences do you enjoy sharing with a partner?',
      options: [
        { value: 'international_travel', label: '🌍 International travel' },
        { value: 'luxury_getaways', label: '🛥️ Luxury getaways' },
        { value: 'fine_dining', label: '🍷 Fine dining' },
        { value: 'vip_events', label: '🎭 VIP events & nightlife' },
        { value: 'luxury_hotels', label: '🏨 Luxury hotels & resorts' },
        { value: 'spontaneous_trips', label: '✈️ Spontaneous trips' },
        { value: 'high_end_social', label: '🥂 High-end social experiences' },
        { value: 'luxury_gifting', label: '🎁 Luxury gifting' },
        { value: 'memorable_experiences', label: '📸 Creating memorable experiences' },
        { value: 'art_culture', label: '🎨 Art, culture & fashion' },
        { value: 'relaxing_escapes', label: '🌴 Relaxing escapes' },
        { value: 'exotic_cars', label: '🚗 Exotic cars & experiences' },
        { value: 'wellness_spa', label: '🧘 Wellness & spa experiences' }
      ]
    },
    {
      id: 'show_appreciation',
      type: 'multi-select',
      question: '💎 How do you naturally show appreciation in a relationship?',
      options: [
        { value: 'gifts_surprises', label: '🎁 Gifts & surprises' },
        { value: 'shared_experiences', label: '✈️ Shared experiences' },
        { value: 'attention_communication', label: '💬 Attention & communication' },
        { value: 'quality_time', label: '❤️ Quality time' },
        { value: 'financial_generosity', label: '💎 Financial generosity' },
        { value: 'romance_affection', label: '🌹 Romance & affection' },
        { value: 'consistency', label: '🕰️ Consistency & reliability' },
        { value: 'elevated_experiences', label: '🥂 Elevated experiences' },
        { value: 'thoughtful_luxury', label: '🛍️ Thoughtful luxury' },
        { value: 'providing_support', label: '💼 Providing support' }
      ]
    },
    {
      id: 'intimacy_openness',
      type: 'multi-select',
      question: '🔒 What kind of chemistry and intimacy are you open to exploring?',
      options: [
        { value: 'pda', label: '💋 PDA' },
        { value: 'teasing_flirtation', label: '😏 Teasing & flirtation' },
        { value: 'sensual_connection', label: '🌹 Sensual connection' },
        { value: 'roleplay', label: '🕯️ Roleplay' },
        { value: 'power_dynamics', label: '⛓️ Power dynamics' },
        { value: 'bdsm_friendly', label: '🖤 BDSM-friendly' },
        { value: 'group_experiences', label: '🔥 Group experiences' },
        { value: 'open_relationships', label: '💫 Open relationships' },
        { value: 'exploring_fantasies', label: '✨ Exploring fantasies together' },
        { value: 'experimental', label: '🎭 Experimental experiences' },
        { value: 'emotional_intimacy', label: '❤️ Emotional intimacy focus' },
        { value: 'prefer_discretion', label: '🔒 Prefer discretion' }
      ]
    },
    {
      id: 'relationship_standards',
      type: 'multi-select',
      question: '🛡️ What relationship standards matter most to you?',
      options: [
        { value: 'mutual_respect', label: '🤝 Mutual respect' },
        { value: 'discretion', label: '🔒 Discretion matters' },
        { value: 'honest_communication', label: '💬 Honest communication' },
        { value: 'emotional_maturity', label: '❤️ Emotional maturity' },
        { value: 'safety_trust', label: '🛡️ Safety & trust first' },
        { value: 'clear_expectations', label: '✨ Clear expectations' },
        { value: 'drama_free', label: '🧘 Drama-free connections' },
        { value: 'verified_profiles', label: '🔍 Verified profiles preferred' },
        { value: 'consistency', label: '🌹 Consistency matters' },
        { value: 'no_manipulation', label: '🚫 No manipulation or games' },
        { value: 'public_first', label: '📍 Comfortable meeting publicly first' },
        { value: 'privacy_respected', label: '🔐 Privacy respected' },
        { value: 'respect_boundaries', label: '❤️ Respect for boundaries' }
      ]
    },
    {
      id: 'lifestyle_today',
      type: 'multiple-choice',
      question: '💼 What best describes your lifestyle today?',
      options: [
        { value: 'building', label: 'Building my success' },
        { value: 'comfortable', label: 'Financially comfortable' },
        { value: 'established', label: 'Established & successful' },
        { value: 'high_income', label: 'High-income lifestyle' },
        { value: 'wealth_focused', label: 'Wealth-focused & ambitious' },
        { value: 'executive', label: 'Executive / founder lifestyle' },
        { value: 'luxury', label: 'Luxury lifestyle' }
      ]
    },
    {
      id: 'financial_position',
      type: 'multiple-choice',
      question: '🏆 Which best reflects your financial position?',
      options: [
        { value: 'growing', label: 'Growing steadily' },
        { value: 'comfortable_assets', label: 'Comfortable assets & investments' },
        { value: 'high_value_assets', label: 'High-value lifestyle assets' },
        { value: 'significant_wealth', label: 'Significant wealth accumulation' },
        { value: 'multi_million', label: 'Multi-million net worth' },
        { value: 'private', label: 'Prefer to keep private' }
      ]
    },
    {
      id: 'annual_income',
      type: 'multiple-choice',
      question: '💎 What\'s your approximate annual income?',
      options: [
        { value: 'under_25l', label: 'Under ₹25L' },
        { value: '25l_50l', label: '₹25L – ₹50L' },
        { value: '50l_1cr', label: '₹50L – ₹1Cr' },
        { value: '1cr_3cr', label: '₹1Cr – ₹3Cr' },
        { value: '3cr_10cr', label: '₹3Cr – ₹10Cr' },
        { value: '10cr_plus', label: '₹10Cr+' }
      ]
    }
  ];

  // Archetype-specific question sets (take priority over gender)
  const archetypeQuestionSets: Record<string, Question[]> = {
    traditional_matrimony_man: MATRIMONY_QUESTIONS,
    traditional_matrimony_woman: MATRIMONY_QUESTIONS,
    spoiled_casual_woman: SPOILED_CASUAL_QUESTIONS,
    casual_generous_man: CASUAL_GENEROUS_QUESTIONS
  };

  // Voice input
  let listening = $state(false);
  let voiceSupported = $state(false);
  let recognition: any = null;

  $effect(() => {
    if (typeof window !== 'undefined') {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      voiceSupported = !!SR;
      if (SR) {
        recognition = new SR();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.onresult = (e: any) => {
          const transcript = e.results[0][0].transcript;
          const q = getCurrentQuestion();
          const current = (responses[q.id] as string) || '';
          handleTextInput(current ? current.trimEnd() + ' ' + transcript : transcript);
          listening = false;
        };
        recognition.onerror = () => { listening = false; };
        recognition.onend = () => { listening = false; };
      }
    }
  });

  function toggleVoice() {
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      listening = false;
    } else {
      recognition.start();
      listening = true;
    }
  }

  // Gender-specific questions (fallback when no archetype-specific set exists)
  const questionSets: Record<Gender, Question[]> = {
    man: [
      {
        id: 'spending_comfort',
        type: 'multiple-choice',
        question: "💸 What's your comfort level with spending on dates?",
        options: [
          { value: 'budget', label: '🪙 Budget-conscious (₹1,000–3,000)' },
          { value: 'moderate', label: '💳 Moderate spender (₹3,000–8,000)' },
          { value: 'generous', label: '🥂 Generous spender (₹8,000–20,000)' },
          { value: 'luxury', label: '💎 Luxury spender (₹20,000+)' }
        ]
      },
      {
        id: 'dating_intent',
        type: 'multiple-choice',
        question: "🎯 What's your primary dating intent?",
        options: [
          { value: 'casual', label: '☀️ Casual dating' },
          { value: 'relationship', label: '❤️ Serious relationship' },
          { value: 'marriage', label: '💍 Marriage-minded' },
          { value: 'exploring', label: '🧭 Still exploring' }
        ]
      },
      {
        id: 'lifestyle_values',
        type: 'text',
        question: '🌿 What lifestyle values matter most to you? (e.g., travel, fitness, culture)',
        placeholder: 'Share what matters to you...'
      },
      {
        id: 'relationship_timeline',
        type: 'multiple-choice',
        question: "🗓️ What's your ideal relationship timeline?",
        options: TIMELINE_OPTIONS
      },
      {
        id: 'deal_breakers',
        type: 'text',
        question: "🚫 What are your deal-breakers in a partner?",
        placeholder: "Be honest about what won't work for you..."
      }
    ],
    woman: [
      {
        id: 'date_expectations',
        type: 'multiple-choice',
        question: '✨ What do you expect from a date?',
        options: [
          { value: 'casual', label: '☕ Casual hangout' },
          { value: 'thoughtful', label: '🌸 Thoughtful & planned' },
          { value: 'upscale', label: '🥂 Upscale experience' },
          { value: 'luxury', label: '💎 Luxury treatment' }
        ]
      },
      {
        id: 'partner_qualities',
        type: 'text',
        question: '💫 What qualities matter most in a partner?',
        placeholder: 'Describe your ideal partner...'
      },
      {
        id: 'dating_intent',
        type: 'multiple-choice',
        question: "🎯 What's your primary dating intent?",
        options: [
          { value: 'casual', label: '☀️ Casual dating' },
          { value: 'relationship', label: '❤️ Serious relationship' },
          { value: 'marriage', label: '💍 Marriage-minded' },
          { value: 'exploring', label: '🧭 Still exploring' }
        ]
      },
      {
        id: 'lifestyle_values',
        type: 'text',
        question: '🌿 What lifestyle values matter most to you? (e.g., travel, fitness, culture)',
        placeholder: 'Share what matters to you...'
      },
      {
        id: 'red_flags',
        type: 'text',
        question: "🚩 What are your red flags in a partner?",
        placeholder: "Be honest about what won't work for you..."
      }
    ],
    prefer_not_to_say: [
      {
        id: 'dating_intent',
        type: 'multiple-choice',
        question: "🎯 What's your primary dating intent?",
        options: [
          { value: 'casual', label: '☀️ Casual dating' },
          { value: 'relationship', label: '❤️ Serious relationship' },
          { value: 'marriage', label: '💍 Marriage-minded' },
          { value: 'exploring', label: '🧭 Still exploring' }
        ]
      },
      {
        id: 'lifestyle_values',
        type: 'text',
        question: '🌿 What lifestyle values matter most to you?',
        placeholder: 'Share what matters to you...'
      },
      {
        id: 'partner_qualities',
        type: 'text',
        question: '💫 What qualities matter most in a partner?',
        placeholder: 'Describe your ideal partner...'
      },
      {
        id: 'spending_comfort',
        type: 'multiple-choice',
        question: "💸 What's your comfort level with spending on dates?",
        options: [
          { value: 'budget', label: '🪙 Budget-conscious' },
          { value: 'moderate', label: '💳 Moderate spender' },
          { value: 'generous', label: '🥂 Generous spender' },
          { value: 'luxury', label: '💎 Luxury spender' }
        ]
      },
      {
        id: 'deal_breakers',
        type: 'text',
        question: "🚫 What are your deal-breakers in a partner?",
        placeholder: "Be honest about what won't work for you..."
      }
    ]
  };

  const questions = $derived(archetypeQuestionSets[archetype ?? ''] ?? questionSets[gender]);

  function getCurrentQuestion(): Question {
    return questions[currentQuestionIndex];
  }

  function handleOptionSelect(value: string) {
    const question = getCurrentQuestion();
    if (question.type === 'multi-select') {
      const current = (responses[question.id] as string[]) || [];
      const idx = current.indexOf(value);
      responses[question.id] = idx === -1 ? [...current, value] : current.filter(v => v !== value);
    } else {
      responses[question.id] = value;
    }
    responses = { ...responses };
  }

  function handleTextInput(value: string) {
    const question = getCurrentQuestion();
    responses[question.id] = value;
    responses = { ...responses }; // Trigger reactivity
  }

  function isAnswered(question: Question, response: string | string[] | undefined): boolean {
    if (question.type === 'multi-select') return Array.isArray(response) && response.length > 0;
    return response !== undefined && response !== '' && response !== null;
  }

  function isCurrentQuestionAnswered(): boolean {
    const question = getCurrentQuestion();
    return isAnswered(question, responses[question.id] as string | string[] | undefined);
  }

  function handleNext() {
    error = null;

    if (!isCurrentQuestionAnswered()) {
      error = 'Please answer this question before continuing';
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
      currentQuestionIndex++;
    } else {
      step = 'review';
    }
  }

  function handleBack() {
    error = null;

    if (currentQuestionIndex > 0) {
      currentQuestionIndex--;
    } else if (step === 'review') {
      step = 'questions';
      currentQuestionIndex = questions.length - 1;
    }
  }

  function handleEditQuestion(index: number) {
    currentQuestionIndex = index;
    step = 'questions';
  }

  async function handleSubmit() {
    error = null;

    // Validate all questions are answered
    const allAnswered = questions.every((q) => isAnswered(q, responses[q.id] as string | string[] | undefined));

    if (!allAnswered) {
      error = 'Please answer all questions before submitting';
      return;
    }

    if (!onSubmit) return;

    loading = true;
    step = 'submitting';

    try {
      await onSubmit({ responses });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to submit responses';
      step = 'review';
    } finally {
      loading = false;
    }
  }

  function getProgressPercentage(): number {
    if (step === 'review') return 100;
    return ((currentQuestionIndex + 1) / questions.length) * 100;
  }

  function getProgressLabel(): string {
    if (step === 'review') return `${questions.length} of ${questions.length}`;
    return `${currentQuestionIndex + 1} of ${questions.length}`;
  }
</script>

<div class="spending-qa-step">
  <!-- Header -->
  <div class="header" transition:fade={{ duration: 200 }}>
    <div class="header-content">
      <h2 class="title">
        {#if step === 'questions'}
          Spending & Values
        {:else if step === 'review'}
          Review Your Answers
        {:else}
          Submitting...
        {/if}
      </h2>
      <p class="subtitle">
        {#if step === 'questions'}
          Help matches understand your values and intent
        {:else if step === 'review'}
          Make sure everything looks good
        {:else}
          Processing your responses...
        {/if}
      </p>
    </div>

    <!-- Progress Bar -->
    <div class="progress-container">
      <div class="progress-bar">
        <div class="progress-fill" style="width: {getProgressPercentage()}%"></div>
      </div>
      <p class="progress-label">{getProgressLabel()}</p>
    </div>
  </div>

  <!-- Error Message -->
  {#if error}
    <div class="error-message" role="alert" transition:slide={{ duration: 200 }}>
      <span class="error-icon">⚠️</span>
      <span class="error-text">{error}</span>
    </div>
  {/if}

  <!-- Questions View -->
  {#if step === 'questions'}
    <div class="questions-container" transition:fade={{ duration: 200 }}>
      {#each [getCurrentQuestion()] as question (question.id)}
        <div class="question-card" transition:scale={{ duration: 200 }}>
          <h3 class="question-text">{question.question}</h3>

          {#if question.type === 'multiple-choice'}
            <div class="options-grid" class:chips={q.options && q.options.length > 6}>
              {#each question.options || [] as option (option.value)}
                <button
                  class="option-button"
                  class:selected={responses[question.id] === option.value}
                  onclick={() => handleOptionSelect(option.value)}
                  aria-pressed={responses[question.id] === option.value}
                  disabled={loading}
                >
                  <span class="option-label">{option.label}</span>
                  {#if responses[question.id] === option.value}
                    <span class="checkmark">✓</span>
                  {/if}
                </button>
              {/each}
            </div>
          {:else if question.type === 'multi-select'}
            <p class="multi-select-hint">Select all that apply</p>
            <div class="bubbles-grid">
              {#each question.options || [] as option (option.value)}
                {@const selected = ((responses[question.id] as string[]) || []).includes(option.value)}
                <button
                  class="bubble-chip"
                  class:selected
                  onclick={() => handleOptionSelect(option.value)}
                  aria-pressed={selected}
                  disabled={loading}
                >
                  {option.label}
                </button>
              {/each}
            </div>
          {:else if question.type === 'text'}
            <div class="textarea-wrap">
              <textarea
                class="text-input"
                placeholder={question.placeholder}
                value={responses[question.id] || ''}
                oninput={(e) => handleTextInput(e.currentTarget.value)}
                disabled={loading}
                aria-label={question.question}
                maxlength="500"
              ></textarea>
              <div class="textarea-footer">
                <span class="char-count">{(responses[question.id] as string)?.length || 0}/500</span>
                {#if voiceSupported}
                  <div class="mic-row">
                    {#if listening}
                      <span class="voice-hint">Listening…</span>
                    {/if}
                    <button
                      type="button"
                      class="mic-btn {listening ? 'listening' : ''}"
                      onclick={toggleVoice}
                      aria-label={listening ? 'Stop recording' : 'Speak your answer'}
                      title={listening ? 'Tap to stop' : 'Tap to speak'}
                    >
                      {#if listening}
                        <span class="mic-ring"></span>
                      {/if}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" y1="19" x2="12" y2="23"/>
                        <line x1="8" y1="23" x2="16" y2="23"/>
                      </svg>
                    </button>
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Navigation Buttons -->
    <div class="button-group">
      <button
        class="button button-secondary"
        onclick={handleBack}
        disabled={loading || currentQuestionIndex === 0}
        aria-label="Go to previous question"
      >
        ← Back
      </button>

      <button
        class="button button-primary"
        onclick={handleNext}
        disabled={loading || !isCurrentQuestionAnswered()}
        aria-label="Go to next question"
      >
        {currentQuestionIndex === questions.length - 1 ? 'Review' : 'Next'} →
      </button>
    </div>
  {/if}

  <!-- Review View -->
  {#if step === 'review' || step === 'submitting'}
    <div class="review-container" transition:fade={{ duration: 200 }}>
      <div class="review-list">
        {#each questions as question, index (question.id)}
          <div class="review-item">
            <div class="review-header">
              <h4 class="review-question">{question.question}</h4>
              {#if step !== 'submitting' && !loading}
                <button
                  class="edit-button"
                  onclick={() => handleEditQuestion(index)}
                  disabled={loading}
                  aria-label="Edit answer to {question.question}"
                >
                  Edit
                </button>
              {/if}
            </div>
            <div class="review-answer">
              {#if question.type === 'multiple-choice'}
                <p class="answer-text">
                  {question.options?.find((o) => o.value === responses[question.id])?.label || 'Not answered'}
                </p>
              {:else if question.type === 'multi-select'}
                <p class="answer-text">
                  {((responses[question.id] as string[]) || [])
                    .map(v => question.options?.find(o => o.value === v)?.label)
                    .filter(Boolean)
                    .join(' · ') || 'Not answered'}
                </p>
              {:else}
                <p class="answer-text">{responses[question.id] || 'Not answered'}</p>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <!-- Review Navigation -->
      <div class="button-group">
        <button
          class="button button-secondary"
          onclick={handleBack}
          disabled={loading}
          aria-label="Go back to questions"
        >
          ← Back
        </button>

        <button
          class="button button-primary"
          onclick={handleSubmit}
          disabled={loading}
          aria-label="Submit your responses"
        >
          {#if loading}
            Submitting...
          {:else}
            Submit Responses
          {/if}
        </button>
      </div>
    </div>
  {/if}

</div>

<style>
  .spending-qa-step {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 600px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .header-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-1);
    margin: 0;
  }

  .subtitle {
    font-size: 0.95rem;
    color: var(--text-2);
    margin: 0;
  }

  .progress-container {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background-color: var(--bg-2);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background-color: var(--accent-bright);
    transition: width 0.3s ease;
  }

  .progress-label {
    font-size: 0.85rem;
    color: var(--text-3);
    margin: 0;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background-color: rgba(239, 68, 68, 0.1);
    border-left: 4px solid #ef4444;
    border-radius: 8px;
  }

  .error-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .error-text {
    color: #ef4444;
    font-size: 0.95rem;
  }

  .questions-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .question-card {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
    background-color: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 12px;
  }

  .question-text {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--text-1);
    margin: 0;
  }

  .options-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .options-grid.chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .options-grid.chips .option-button {
    flex: none;
    padding: 7px 16px;
    border-radius: 100px;
    font-size: 0.85rem;
    min-height: 36px;
    justify-content: center;
    white-space: nowrap;
  }

  .options-grid.chips .checkmark { display: none; }

  .option-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background-color: var(--bg-3);
    border: 2px solid var(--border-1);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.95rem;
    color: var(--text-1);
    font-weight: 500;
    text-align: left;
  }

  .option-button:hover:not(:disabled) {
    border-color: var(--accent-bright);
    background-color: var(--accent-tint);
  }

  .option-button.selected {
    border-color: var(--accent-bright);
    background-color: var(--accent-tint);
  }

  .option-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .option-label {
    text-align: left;
  }

  .checkmark {
    color: var(--accent-bright);
    font-weight: bold;
  }

  .text-input {
    padding: 1rem;
    border: 2px solid var(--border-1);
    border-radius: 8px;
    font-size: 0.95rem;
    font-family: inherit;
    color: var(--text-1);
    background-color: var(--bg-3);
    resize: vertical;
    min-height: 120px;
    transition: border-color 0.2s ease;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--accent-bright);
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
  }

  .text-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .char-count {
    font-size: 0.8rem;
    color: var(--text-3);
  }

  .review-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .review-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .review-item {
    padding: 1rem;
    background-color: var(--bg-2);
    border-radius: 8px;
    border: 1px solid var(--border-1);
  }

  .review-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .review-question {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--text-1);
    margin: 0;
    flex: 1;
  }

  .edit-button {
    padding: 0.25rem 0.75rem;
    background-color: transparent;
    border: 1px solid var(--accent-bright);
    border-radius: 6px;
    color: var(--accent-bright);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .edit-button:hover:not(:disabled) {
    background-color: var(--accent-bright);
    color: var(--bg-1);
  }

  .edit-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .review-answer {
    display: flex;
    flex-direction: column;
  }

  .answer-text {
    font-size: 0.95rem;
    color: var(--text-2);
    margin: 0;
    line-height: 1.5;
  }

  .button-group {
    display: flex;
    gap: 1rem;
    justify-content: space-between;
  }

  .button {
    flex: 1;
    padding: 1rem;
    border: none;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 44px;
  }

  .button-primary {
    background-color: var(--accent-bright);
    color: var(--bg-1);
  }

  .button-primary:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  .button-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .button-secondary {
    background-color: var(--bg-2);
    color: var(--text-1);
    border: 1px solid var(--border-1);
  }

  .button-secondary:hover:not(:disabled) {
    background-color: var(--bg-3);
    border-color: var(--border-2);
  }

  .button-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* ── Multi-select bubbles ────────────────────────────────────────────────── */

  .multi-select-hint {
    font-size: 0.8rem;
    color: var(--text-3);
    margin: 0 0 0.5rem;
  }

  .bubbles-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .bubble-chip {
    display: inline-flex;
    align-items: center;
    padding: 0.45rem 0.9rem;
    border-radius: 100px;
    border: 1.5px solid var(--border-1);
    background-color: var(--bg-3);
    color: var(--text-2);
    font-size: 0.875rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.18s ease;
    white-space: nowrap;
  }

  .bubble-chip:hover:not(:disabled) {
    border-color: var(--accent-bright);
    color: var(--text-1);
  }

  .bubble-chip.selected {
    border-color: var(--accent-bright);
    background-color: var(--accent-tint);
    color: var(--accent-bright);
    font-weight: 600;
  }

  .bubble-chip:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* ── Voice input ─────────────────────────────────────────────────────────── */

  .textarea-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .textarea-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .mic-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .mic-btn {
    position: relative;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1px solid var(--border-2);
    background: var(--bg-1);
    color: var(--text-3);
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .mic-btn:hover {
    border-color: var(--accent-bright);
    color: var(--accent-bright);
  }

  .mic-btn.listening {
    border-color: var(--accent-bright);
    background: var(--accent-tint);
    color: var(--accent-bright);
  }

  .mic-ring {
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    border: 2px solid var(--accent-bright);
    animation: mic-pulse 1.2s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes mic-pulse {
    0%, 100% { opacity: 0.8; transform: scale(1); }
    50%       { opacity: 0.2; transform: scale(1.25); }
  }

  .voice-hint {
    font-size: 11px;
    color: var(--accent-bright);
    font-style: italic;
  }
  @media (max-width: 767px) {
    .spending-qa-step {
      gap: 1rem;
    }

    .title {
      font-size: 1.25rem;
    }

    .question-card {
      padding: 1rem;
    }

    .button-group {
      flex-direction: column;
    }

    .button {
      width: 100%;
    }

    .review-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .edit-button {
      align-self: flex-start;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-fill,
    .option-button,
    .text-input,
    .button {
      transition: none;
    }
  }
</style>
