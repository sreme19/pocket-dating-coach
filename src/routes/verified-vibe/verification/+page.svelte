<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import {
    verificationStep,
    verificationProgress,
    addVerificationRecord,
    setPhase,
    setError,
    clearError,
    user,
    userVerification,
    updateTrustScore,
    loading as globalLoading
  } from '$lib/verified-vibe/stores';
  import { calculateTrustScore } from '$lib/verified-vibe/server/trustScore';
  import { getSupabaseClient } from '$lib/client/supabase';
  import { upsertProfile } from '$lib/verified-vibe/services/profileService';
  import PhotoUploadStep from '$lib/verified-vibe/components/PhotoUploadStep.svelte';
  import SpendingQAStep from '$lib/verified-vibe/components/SpendingQAStep.svelte';
  import IDExtractionStep from '$lib/verified-vibe/components/IDExtractionStep.svelte';
  import LivenessStep from '$lib/verified-vibe/components/LivenessStep.svelte';
  import IdentityCheckStep from '$lib/verified-vibe/components/IdentityCheckStep.svelte';
  import ProfileIntakeStep from '$lib/verified-vibe/components/ProfileIntakeStep.svelte';
  import DrawnToStep from '$lib/verified-vibe/components/DrawnToStep.svelte';
  import HowYouLiveStep from '$lib/verified-vibe/components/HowYouLiveStep.svelte';
  import PhotosPlaceStep from '$lib/verified-vibe/components/PhotosPlaceStep.svelte';
  import TrustPointsBadge from '$lib/verified-vibe/components/TrustPointsBadge.svelte';
  import ProfilePreviewSheet from '$lib/verified-vibe/components/ProfilePreviewSheet.svelte';
  import type { SeedCarouselProfile } from '$lib/verified-vibe/components/LiveWomenCarousel.svelte';
  import type { ProfileIntakeData } from '$lib/verified-vibe/components/ProfileIntakeStep.svelte';
  import type { VerificationStep as VerificationStepType, LivenessCheckResult } from '$lib/verified-vibe/types';
  import { fade, slide } from 'svelte/transition';
  import { onMount } from 'svelte';
  import { X } from 'lucide-svelte';

  /** Returns auth headers with the current session token (if available). */
  async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await getSupabaseClient().auth.getSession();
    if (!session?.access_token) return { 'Content-Type': 'application/json' };
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    };
  }

  let currentStep = $state(1);
  let returnTo = $state('');
  let loading = $state(false);
  let openedMotivationProfile = $state<SeedCarouselProfile | null>(null);
  let error = $state<string | null>(null);
  let completedSteps = $state<Set<number>>(new Set());
  let skippedSteps = $state<Set<number>>(new Set());
  let showSkipWarning = $state(false);
  let stepData = $state<Record<number, any>>({});
  let idPhotoBase64 = $state('');
  let identitySubView = $state<'overview' | 'liveness'>('overview');
  let identityIdDone = $state(false);
  let identitySelfieDone = $state(false);
  // Extracted from ID step — pre-fills profile intake
  let extractedName = $state('');
  let extractedAge = $state(0);
  let extractedIDFields = $state<{ name: string; dob: string; gender?: string; idNumber: string } | null>(null);

  // ── Motivation cards ────────────────────────────────────────────────────────

  interface MotivationCard {
    profile: SeedCarouselProfile;
    quoteBefore: string;
    highlight: string;
    quoteAfter: string;
    profession: string;
  }

  const womenMotivationCards: MotivationCard[] = [
    {
      profile: {
        id: 'priya', name: 'Priya', age: 30, gender: 'woman',
        archetypeId: 'forever_focused_woman',
        photoUrl: '/female_profiles/priya_High_Value_Feminist_f2k7zt/photos/Priya_2.jpg',
        bio: 'UX researcher. Feminist who still wants the fairytale — without the compromise.',
        isOnline: true, lastActive: 'online',
      },
      quoteBefore: '"I still want the fairytale — but with someone ',
      highlight: 'serious enough to prove it',
      quoteAfter: '. That\'s all verification is."',
      profession: 'UX Researcher',
    },
    {
      profile: {
        id: 'anjali', name: 'Anjali', age: 25, gender: 'woman',
        archetypeId: 'traditional_matrimony_woman',
        photoUrl: '/female_profiles/anjali_Traditional_Family_First_g3s7mn/photos/Anjali_1.jpg',
        bio: 'Pharmacist. Family-first, not by default — by choice.',
        isOnline: true, lastActive: 'online',
      },
      quoteBefore: '"Family-first is easy to say. A ',
      highlight: 'verified profile',
      quoteAfter: ' shows you actually mean it."',
      profession: 'Pharmacist',
    },
    {
      profile: {
        id: 'sarah', name: 'Sarah', age: 24, gender: 'woman',
        archetypeId: 'forever_focused_woman',
        photoUrl: '/female_profiles/sarah_Tech_Founder_045db3/photos/Sarah_1.jpg',
        bio: 'Tech founder. Knows what she\'s building and who belongs in it.',
        isOnline: true, lastActive: 'online',
      },
      quoteBefore: '"I give my time to people I can trust. ',
      highlight: 'Verification',
      quoteAfter: ' is how I know someone\'s worth that."',
      profession: 'Tech Founder',
    },
  ];

  const menMotivationCards: MotivationCard[] = [
    {
      profile: {
        id: 'marcus', name: 'Marcus', age: 38, gender: 'man',
        archetypeId: 'forever_focused_man',
        photoUrl: '/male_profiles/marcus_Self_Made_Ambitious_b3k9rz/photos/Lauren_4.jpg',
        bio: 'Built a company from scratch. Same standard in everything — including this.',
        isOnline: true, lastActive: 'online',
      },
      quoteBefore: '"I built something from nothing. A ',
      highlight: 'verified profile',
      quoteAfter: ' shows we\'re operating at the same standard."',
      profession: 'Entrepreneur',
    },
    {
      profile: {
        id: 'tim', name: 'Tim', age: 33, gender: 'man',
        archetypeId: 'forever_focused_man',
        photoUrl: '/male_profiles/tim_VC_Founder_ono35i/photos/Ethan_4.jpg',
        bio: 'VC-backed founder. Filters signal from noise for a living.',
        isOnline: true, lastActive: 'online',
      },
      quoteBefore: '"I read pitches all day. The first thing I check is whether someone\'s ',
      highlight: 'actually real',
      quoteAfter: '. Same applies here."',
      profession: 'VC Founder',
    },
    {
      profile: {
        id: 'karan', name: 'Karan', age: 34, gender: 'man',
        archetypeId: 'forever_focused_man',
        photoUrl: '/male_profiles/karan_Progressive_Traditional_u9j5ql/photos/Karan_5.jpg',
        bio: 'PM at a unicorn. Knows exactly what he\'s building — in work and in love.',
        isOnline: true, lastActive: 'online',
      },
      quoteBefore: '"I know what I want — in work and in life. ',
      highlight: 'This just shows I\'m willing to prove it',
      quoteAfter: '."',
      profession: 'Product Manager',
    },
  ];

  const viewerGender = $derived.by(() => {
    if ($user?.gender) return $user.gender;
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('verified_vibe_gender') as 'man' | 'woman') ?? 'man';
    }
    return 'man';
  });

  const motivationCard = $derived.by(() => {
    const pool = viewerGender === 'woman' ? menMotivationCards : womenMotivationCards;
    return pool[Math.floor(Math.random() * pool.length)];
  });

  // ── Per-archetype step cards (steps 3–6) ─────────────────────────────────────
  // Returns cards for the current archetype + viewer gender.
  // step3 = Photo Story, step4 = Intent/Spending, step5 = Profile/About,
  // step6 = Preferences/Partner. Undefined means no card for that step.
  const archetypeCards = $derived.by((): Partial<Record<'step3'|'step4'|'step5'|'step6', MotivationCard>> => {
    const isMale = viewerGender !== 'woman';

    // ── Reusable seed profiles ──────────────────────────────────────────────
    const pPriya  = womenMotivationCards[0].profile;
    const pAnjali = womenMotivationCards[1].profile;
    const pSarah  = womenMotivationCards[2].profile;
    const pMarcus = menMotivationCards[0].profile;
    const pTim    = menMotivationCards[1].profile;
    const pKaran  = menMotivationCards[2].profile;

    const pNeha: SeedCarouselProfile = {
      id: 'neha', name: 'Neha', age: 27, gender: 'woman',
      archetypeId: 'traditional_matrimony_woman',
      photoUrl: '/female_profiles/neha_NRI_Diaspora_x5r2vd/photos/Neha_1.jpg',
      bio: 'Navigating two cultures with equal pride. Knows exactly what she\'s building.',
      isOnline: true, lastActive: 'online',
    };
    const pZara: SeedCarouselProfile = {
      id: 'zara', name: 'Zara', age: 26, gender: 'woman',
      archetypeId: 'forever_focused_woman',
      photoUrl: '/female_profiles/zara_Soft_Life_Seeker_m4p9rx/photos/fenomen-zara-1.jpg',
      bio: 'Works smart and values quality in everything — including the people around her.',
      isOnline: true, lastActive: 'online',
    };
    const pRyan: SeedCarouselProfile = {
      id: 'ryan', name: 'Ryan', age: 28, gender: 'man',
      archetypeId: 'forever_focused_man',
      photoUrl: '/male_profiles/ryan_Serial_Dater_f4m2px/photos/Ryan_1.jpg',
      bio: 'Took the long way to knowing what he wanted. Got there.',
      isOnline: true, lastActive: 'online',
    };
    const pJohn: SeedCarouselProfile = {
      id: 'john', name: 'John', age: 23, gender: 'man',
      archetypeId: 'untouched_heart_man',
      photoUrl: '/male_profiles/john_Young_Student_nsysor/photos/John_1.jpg',
      bio: 'First-generation achiever. More emotional intelligence than most men twice his age.',
      isOnline: true, lastActive: 'online',
    };

    // ── Step 3 — Photo Story (universal, gender-split) ──────────────────────
    const step3: MotivationCard = isMale ? {
      profile: pAnjali,
      quoteBefore: '"I want to see your world a little — not just your face. The energy you bring. The life you\'ve built. A man who\'s ',
      highlight: 'generous with his attention, effort, and presence',
      quoteAfter: ' stands out for me."',
      profession: 'Pharmacist',
    } : {
      profile: pRyan,
      quoteBefore: '"I\'m not looking for a perfect shot. I\'m looking for someone willing to show me ',
      highlight: 'who they actually are',
      quoteAfter: '. That\'s what makes me pay attention."',
      profession: 'Marketing Lead',
    };

    // ── casual_generous_man ─────────────────────────────────────────────────
    if ($user?.archetype === 'casual_generous_man') return {
      step3,
      step4: {
        profile: pAnjali,
        quoteBefore: '"The most interesting men I\'ve matched with weren\'t showing off. They were just ',
        highlight: 'genuinely sure of what they enjoy',
        quoteAfter: '. That\'s the real flex."',
        profession: 'Pharmacist',
      },
      step5: {
        profile: pSarah,
        quoteBefore: '"I don\'t care about a man\'s résumé. I care about what he\'d do with a free weekend. ',
        highlight: 'That\'s what tells me everything',
        quoteAfter: '."',
        profession: 'Tech Founder',
      },
    };

    // ── traditional_matrimony ───────────────────────────────────────────────
    if (isMatrimonyArchetype) return isMale ? {
      step3,
      step4: {
        profile: pAnjali,
        quoteBefore: '"The men who take this seriously aren\'t just filling in forms. They\'re already ',
        highlight: 'showing me who they are',
        quoteAfter: '. That matters."',
        profession: 'Pharmacist',
      },
      step5: {
        profile: pNeha,
        quoteBefore: '"Your profile is the first conversation we\'ll have. I read every word — ',
        highlight: 'what you say here tells me more than the photos',
        quoteAfter: '."',
        profession: 'Strategy Consultant',
      },
      step6: {
        profile: pAnjali,
        quoteBefore: '"A man who knows what he\'s looking for isn\'t intimidating. ',
        highlight: 'He\'s a relief',
        quoteAfter: '."',
        profession: 'Pharmacist',
      },
    } : {
      step3,
      step4: {
        profile: pKaran,
        quoteBefore: '"She completed every step — I noticed. ',
        highlight: 'That level of seriousness tells me everything I need to know',
        quoteAfter: '."',
        profession: 'Product Manager',
      },
      step5: {
        profile: pKaran,
        quoteBefore: '"I\'ve read profiles that said nothing. The ones that said something real — ',
        highlight: 'I still think about those women',
        quoteAfter: '."',
        profession: 'Product Manager',
      },
      step6: {
        profile: pKaran,
        quoteBefore: '"A woman who knows what she\'s looking for doesn\'t intimidate me. ',
        highlight: 'She inspires me',
        quoteAfter: '."',
        profession: 'Product Manager',
      },
    };

    // ── forever_focused ─────────────────────────────────────────────────────
    if (isForeverFocusedArchetype) return isMale ? {
      step3,
      step4: {
        profile: pPriya,
        quoteBefore: '"I can tell in five minutes if someone actually knows what they want. The ones who do? ',
        highlight: 'I don\'t let them go',
        quoteAfter: '."',
        profession: 'UX Researcher',
      },
      step5: {
        profile: pSarah,
        quoteBefore: '"I\'m not reading a profile to see how impressive you are. I\'m reading it to feel ',
        highlight: 'whether I\'d actually want to talk to you',
        quoteAfter: '."',
        profession: 'Tech Founder',
      },
      step6: {
        profile: pNeha,
        quoteBefore: '"Knowing what you want isn\'t demanding. It\'s ',
        highlight: 'the most attractive thing about a person',
        quoteAfter: '."',
        profession: 'Strategy Consultant',
      },
    } : {
      step3,
      step4: {
        profile: pMarcus,
        quoteBefore: '"I stopped swiping when I found someone serious enough to verify. ',
        highlight: 'That\'s my filter now',
        quoteAfter: '."',
        profession: 'Entrepreneur',
      },
      step5: {
        profile: pMarcus,
        quoteBefore: '"Your profile is where I decide if I\'m curious. ',
        highlight: 'Don\'t waste it on the obvious stuff',
        quoteAfter: '."',
        profession: 'Entrepreneur',
      },
      step6: {
        profile: pTim,
        quoteBefore: '"The women I\'ve stayed interested in always knew ',
        highlight: 'exactly what they needed',
        quoteAfter: '. That clarity is everything."',
        profession: 'VC Founder',
      },
    };

    // ── hopeless_romantic ───────────────────────────────────────────────────
    if (isRomanticArchetype) return isMale ? {
      step3,
      step4: {
        profile: pZara,
        quoteBefore: '"I stopped matching with men who \'kind of\' wanted something real. I need to know ',
        highlight: 'you feel it too',
        quoteAfter: '."',
        profession: 'Art Director',
      },
      step5: {
        profile: pZara,
        quoteBefore: '"I\'m not looking for a highlight reel. I want to know ',
        highlight: 'who you actually are at 7pm on a Tuesday',
        quoteAfter: '."',
        profession: 'Art Director',
      },
      step6: {
        profile: pZara,
        quoteBefore: '"I know exactly what I\'m drawn to in a person. ',
        highlight: 'I need you to know it too',
        quoteAfter: '."',
        profession: 'Art Director',
      },
    } : {
      step3,
      step4: {
        profile: pRyan,
        quoteBefore: '"I never thought I\'d care about verification. Then I met someone who\'d done all of it — ',
        highlight: 'it told me she was real before I even said hello',
        quoteAfter: '."',
        profession: 'Marketing Lead',
      },
      step5: {
        profile: pRyan,
        quoteBefore: '"I want to feel something from a profile. Not be impressed — just feel like ',
        highlight: 'I already know you a little',
        quoteAfter: '."',
        profession: 'Marketing Lead',
      },
      step6: {
        profile: pRyan,
        quoteBefore: '"I\'ve learned to stop guessing what someone wants. ',
        highlight: 'The ones who tell me — those are the ones I remember',
        quoteAfter: '."',
        profession: 'Marketing Lead',
      },
    };

    // ── second_chapter ──────────────────────────────────────────────────────
    if (isSecondChapterArchetype) return isMale ? {
      step3,
      step4: {
        profile: pNeha,
        quoteBefore: '"I\'ve been through enough to know — a man who\'s thought this through is worth ',
        highlight: 'ten who haven\'t',
        quoteAfter: '."',
        profession: 'Strategy Consultant',
      },
      step5: {
        profile: pNeha,
        quoteBefore: '"At this point in my life, I can\'t afford to guess at who someone is. ',
        highlight: 'Your profile is the first real honesty',
        quoteAfter: '."',
        profession: 'Strategy Consultant',
      },
      step6: {
        profile: pPriya,
        quoteBefore: '"I spent years with someone who never quite knew what he wanted. ',
        highlight: 'I won\'t make that mistake again',
        quoteAfter: '."',
        profession: 'UX Researcher',
      },
    } : {
      step3,
      step4: {
        profile: pTim,
        quoteBefore: '"There\'s a difference between a woman who\'s ready and one who\'s just available. ',
        highlight: 'How she shows up here tells me which one',
        quoteAfter: '."',
        profession: 'VC Founder',
      },
      step5: {
        profile: pTim,
        quoteBefore: '"After a difficult few years, I appreciate directness more than anything. Your profile is ',
        highlight: 'the first place I look for it',
        quoteAfter: '."',
        profession: 'VC Founder',
      },
      step6: {
        profile: pMarcus,
        quoteBefore: '"I don\'t have time for guesswork anymore. A woman who knows what she wants ',
        highlight: 'makes the whole thing easier',
        quoteAfter: '."',
        profession: 'Entrepreneur',
      },
    };

    // ── rebound_healing (5 steps — step 4 only) ─────────────────────────────
    if (isReboundHealingArchetype) return isMale ? {
      step3,
      step4: {
        profile: pZara,
        quoteBefore: '"I don\'t need someone who has it all figured out. I need someone who\'s ',
        highlight: 'being honest about where they are',
        quoteAfter: '."',
        profession: 'Art Director',
      },
    } : {
      step3,
      step4: {
        profile: pJohn,
        quoteBefore: '"I\'m not looking for someone who has everything sorted. I\'m looking for someone who\'s ',
        highlight: 'genuinely present with where they are',
        quoteAfter: '."',
        profession: 'Graduate Engineer',
      },
    };

    // ── untouched_heart ─────────────────────────────────────────────────────
    if (isUntouchedHeartArchetype) return isMale ? {
      step3,
      step4: {
        profile: pSarah,
        quoteBefore: '"There\'s something quietly attractive about someone who doesn\'t pretend to have ',
        highlight: 'more experience than they do',
        quoteAfter: '. It\'s refreshing."',
        profession: 'Tech Founder',
      },
      step5: {
        profile: pNeha,
        quoteBefore: '"The best profile I ever saw was two sentences. Both of them ',
        highlight: 'told me everything I needed to know',
        quoteAfter: '."',
        profession: 'Strategy Consultant',
      },
      step6: {
        profile: pAnjali,
        quoteBefore: '"You don\'t need a list. Just knowing ',
        highlight: 'what actually matters to you',
        quoteAfter: ' — that\'s everything."',
        profession: 'Pharmacist',
      },
    } : {
      step3,
      step4: {
        profile: pJohn,
        quoteBefore: '"She hadn\'t been on many dates. But the way she showed up to this — ',
        highlight: 'that told me more than any experience could',
        quoteAfter: '."',
        profession: 'Graduate Engineer',
      },
      step5: {
        profile: pJohn,
        quoteBefore: '"I don\'t need a polished story. I need to feel like ',
        highlight: 'you\'re actually talking to me',
        quoteAfter: '."',
        profession: 'Graduate Engineer',
      },
      step6: {
        profile: pKaran,
        quoteBefore: '"When she knew what she was looking for, it made everything ',
        highlight: 'so much clearer for both of us',
        quoteAfter: '."',
        profession: 'Product Manager',
      },
    };

    // ── just_friends ────────────────────────────────────────────────────────
    if (isJustFriendsArchetype) return isMale ? {
      step3,
      step4: {
        profile: pZara,
        quoteBefore: '"The best connections I\'ve made started with someone just being ',
        highlight: 'honest about what they were looking for',
        quoteAfter: '. No performance. Just real."',
        profession: 'Art Director',
      },
      step5: {
        profile: pNeha,
        quoteBefore: '"I can tell in three sentences whether someone would be ',
        highlight: 'genuinely fun to be around',
        quoteAfter: '. Make yours count."',
        profession: 'Strategy Consultant',
      },
      step6: {
        profile: pSarah,
        quoteBefore: '"The connections that stuck were the ones where both people knew ',
        highlight: 'exactly what kind of thing they were building',
        quoteAfter: '."',
        profession: 'Tech Founder',
      },
    } : {
      step3,
      step4: {
        profile: pRyan,
        quoteBefore: '"The women I\'ve stayed close with were always the ones who were ',
        highlight: 'upfront about the kind of connection they wanted',
        quoteAfter: '. No confusion, no awkward pivots."',
        profession: 'Marketing Lead',
      },
      step5: {
        profile: pRyan,
        quoteBefore: '"A good profile makes me feel like ',
        highlight: 'we\'d already have something to talk about',
        quoteAfter: '."',
        profession: 'Marketing Lead',
      },
      step6: {
        profile: pKaran,
        quoteBefore: '"The best friendships started with someone who said exactly ',
        highlight: 'what kind of people they were looking for',
        quoteAfter: '. Saves everyone time."',
        profession: 'Product Manager',
      },
    };

    // ── default fallback ────────────────────────────────────────────────────
    return { step3 };
  });

  // ── Archetype derived booleans ──────────────────────────────────────────────

  const isMatrimonyArchetype = $derived(
    $user?.archetype === 'traditional_matrimony_man' ||
    $user?.archetype === 'traditional_matrimony_woman'
  );

  const isForeverFocusedArchetype = $derived(
    $user?.archetype === 'forever_focused_man' ||
    $user?.archetype === 'forever_focused_woman'
  );

  const isRomanticArchetype = $derived(
    $user?.archetype === 'hopeless_romantic_man' ||
    $user?.archetype === 'hopeless_romantic_woman'
  );

  const isSecondChapterArchetype = $derived(
    $user?.archetype === 'second_chapter_man' ||
    $user?.archetype === 'second_chapter_woman'
  );

  const isReboundHealingArchetype = $derived(
    $user?.archetype === 'rebound_healing_man' ||
    $user?.archetype === 'rebound_healing_woman'
  );

  const isUntouchedHeartArchetype = $derived(
    $user?.archetype === 'untouched_heart_man' ||
    $user?.archetype === 'untouched_heart_woman'
  );

  const isJustFriendsArchetype = $derived(
    $user?.archetype === 'just_friends_man' ||
    $user?.archetype === 'just_friends_woman'
  );

  const steps = $derived([
    { number: 1, name: 'Identity Check', description: "Prove you're actually you.", icon: '🪪', stepType: 'id'            as VerificationStepType, time: '~90 sec', points: 65 },
    { number: 2, name: 'Drawn To',       description: "What you're drawn to.",      icon: '✨', stepType: 'spending_or_qa' as VerificationStepType, time: '~2 min',  points: 80 },
    { number: 3, name: 'How You Live',   description: 'Your lifestyle & standards.', icon: '💼', stepType: 'spending_or_qa' as VerificationStepType, time: '~2 min',  points: 80 },
    { number: 4, name: 'Photos & Place', description: 'Almost there.',              icon: '📸', stepType: 'photos'         as VerificationStepType, time: '~60 sec', points: 55 },
  ]);

  const totalSteps = $derived(steps.length);

  // When editing from profile: redirect back instead of entering the Profile step
  $effect(() => {
    if (returnTo && currentStep === totalSteps) {
      goto(returnTo);
    }
  });

  onMount(() => {
    // Initialize from store
    verificationStep.subscribe(step => {
      currentStep = step;
    });

    verificationProgress.subscribe(progress => {
      // Update completed steps based on progress
      const stepsCompleted = Math.floor((progress / 100) * totalSteps);
      for (let i = 1; i <= stepsCompleted; i++) {
        completedSteps.add(i);
      }
    });

    // Jump to a specific step when coming from a boost CTA or profile edit
    const urlStep = get(page).url.searchParams.get('step');
    if (urlStep) {
      const STEP_MAP: Record<string, number> = { id: 1, archetype_qa: 3 };
      const target = STEP_MAP[urlStep];
      if (target) {
        currentStep = target;
        verificationStep.set(target);
      }
    }

    // Restore idPhotoBase64 from sessionStorage in case user refreshed on step 2
    const cachedIdPhoto = sessionStorage.getItem('vv_id_photo_b64');
    if (cachedIdPhoto) idPhotoBase64 = cachedIdPhoto;

    // Store returnTo so we can navigate back after archetype steps complete
    const returnToParam = get(page).url.searchParams.get('returnTo');
    if (returnToParam) returnTo = returnToParam;

    // If the user store has no archetype (e.g. direct navigation or hydration
    // race), recover from localStorage so the correct archetype-specific steps
    // and components render immediately.
    if (!$user?.archetype) {
      const storedUser = localStorage.getItem('vv_user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed?.archetype) user.set(parsed);
        } catch {}
      }
    }

    // Retry flushing pending gender/archetype in case the auth-page upsert
    // lost the session-propagation race on first sign-up.
    const pendingGender    = localStorage.getItem('verified_vibe_pending_gender');
    const pendingArchetype = localStorage.getItem('verified_vibe_pending_archetype');
    if (pendingGender || pendingArchetype) {
      upsertProfile({
        ...(pendingGender    ? { gender:    pendingGender    as any } : {}),
        ...(pendingArchetype ? { archetype: pendingArchetype as any } : {})
      }).then(() => {
        localStorage.removeItem('verified_vibe_pending_gender');
        localStorage.removeItem('verified_vibe_pending_archetype');
      }).catch(e => console.error('[verify] pending profile flush failed:', e));
    }
  });

  async function handleIDStepDone(data: { idImage: string; mimeType: string }) {
    error = null;
    clearError();
    loading = true;
    idPhotoBase64 = data.idImage;
    sessionStorage.setItem('vv_id_photo_b64', data.idImage);
    try {
      const response = await fetch('/api/verified-vibe/verify-step', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ step: 'id', data: { image: data.idImage, mimeType: data.mimeType } })
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'ID verification failed');
      }
      const result = await response.json();

      // Quality gate: if key fields couldn't be extracted the photo is unclear
      const hasValidExtraction = !!(result.data?.idName?.trim() && result.data?.idNumber?.trim());
      if (!hasValidExtraction) {
        error = 'ID photo is unclear — please retake with better lighting and hold the card flat.';
        setError(error);
        return;
      }

      if (result.data?.idName) {
        extractedName = result.data.idName.split(' ')[0];
        // Persist first name to profile draft so profile page shows it immediately
        try {
          const existingDraft = localStorage.getItem('vv_profile_draft');
          const profileDraft = existingDraft ? JSON.parse(existingDraft) : {};
          if (!profileDraft.firstName) {
            profileDraft.firstName = extractedName;
            localStorage.setItem('vv_profile_draft', JSON.stringify(profileDraft));
          }
        } catch {}
        // Also update user store
        if ($user) user.update(u => u ? { ...u, firstName: extractedName } : u);
      }
      if (result.data) {
        extractedIDFields = {
          name: result.data.idName ?? '',
          dob: result.data.idDOB ?? '',
          gender: result.data.idGender ?? undefined,
          idNumber: result.data.idNumber ?? ''
        };
      }
      addVerificationRecord({
        id: `${$user?.id}-id`, userId: $user?.id || '', step: 'id',
        status: 'completed', data: result.data, completedAt: new Date(), createdAt: new Date()
      });
      updateTrustScoreAfterVerification();
      identityIdDone = true;
      identitySubView = 'overview';
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleSelfieCapture(data: { selfieImage: string; mimeType: string }) {
    error = null;
    clearError();
    loading = true;
    try {
      const response = await fetch('/api/verified-vibe/verify-step', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          step: 'liveness',
          data: { selfieImage: data.selfieImage, idPhotoBase64: idPhotoBase64, mimeType: data.mimeType }
        })
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Face match failed — please retake your selfie');
      }
      const result = await response.json();
      addVerificationRecord({
        id: `${$user?.id}-liveness`, userId: $user?.id || '', step: 'liveness',
        status: 'completed', data: result.data, completedAt: new Date(), createdAt: new Date()
      });
      updateTrustScoreAfterVerification();
      identitySelfieDone = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleLivenessStepDone(data: LivenessCheckResult) {
    error = null;
    clearError();
    loading = true;
    try {
      const response = await fetch('/api/verified-vibe/verify-step', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ step: 'liveness', data })
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Liveness verification failed');
      }
      addVerificationRecord({
        id: `${$user?.id}-liveness`, userId: $user?.id || '', step: 'liveness',
        status: 'completed', data, completedAt: new Date(), createdAt: new Date()
      });
      updateTrustScoreAfterVerification();
      identitySelfieDone = true;
      identitySubView = 'overview';
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  function handleIdentityComplete() {
    completedSteps.add(currentStep);
    const progress = (completedSteps.size / totalSteps) * 100;
    verificationProgress.set(progress);
    updateTrustScoreAfterVerification();
    if (currentStep < totalSteps) {
      currentStep++;
      verificationStep.set(currentStep);
    } else {
      setPhase('app');
      goto('/verified-vibe/discover');
    }
  }

  async function handleIDSubmit(data: { idImage: string; mimeType: string }) {
    error = null;
    clearError();
    loading = true;
    // Store base64 ID photo for use in liveness step (also persist so step 2 survives a refresh)
    idPhotoBase64 = data.idImage;
    sessionStorage.setItem('vv_id_photo_b64', data.idImage);

    try {
      // Submit to API
      const response = await fetch('/api/verified-vibe/verify-step', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          step: 'id',
          data: {
            image: data.idImage,
            mimeType: data.mimeType
          }
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'ID verification failed');
      }

      const result = await response.json();

      // Pull name/age from ID extraction to pre-fill profile intake
      if (result.data?.firstName) extractedName = result.data.firstName;
      if (result.data?.age) extractedAge = result.data.age;

      // Store verification record
      addVerificationRecord({
        id: `${$user?.id}-id`,
        userId: $user?.id || '',
        step: 'id',
        status: 'completed',
        data: result.data,
        completedAt: new Date(),
        createdAt: new Date()
      });

      // Mark step as completed
      completedSteps.add(currentStep);

      // Update progress
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);

      // Update trust score
      updateTrustScoreAfterVerification();

      // Move to next step
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        // All steps complete
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleLivenessSubmit(data: LivenessCheckResult) {
    error = null;
    clearError();
    loading = true;

    try {
      // Persist liveness step to Supabase
      const response = await fetch('/api/verified-vibe/verify-step', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ step: 'liveness', data })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Liveness verification failed');
      }

      // Store verification record in local store
      addVerificationRecord({
        id: `${$user?.id}-liveness`,
        userId: $user?.id || '',
        step: 'liveness',
        status: 'completed',
        data,
        completedAt: new Date(),
        createdAt: new Date()
      });

      // Mark step as completed
      completedSteps.add(currentStep);

      // Update progress
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);

      // Update trust score
      updateTrustScoreAfterVerification();

      // Move to next step
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        // All steps complete
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handlePhotoSubmit(data: { photos: File[]; labels: Record<string, string> }) {
    error = null;
    clearError();
    loading = true;

    try {
      // Convert photos to base64 + preserve data URLs for local profile display
      const photoResults = await Promise.all(
        data.photos.map(file => {
          return new Promise<{ base64: string; dataUrl: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              resolve({ base64: dataUrl.split(',')[1], dataUrl });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        })
      );
      const base64Images = photoResults.map(r => r.base64);

      // Persist photos to localStorage immediately so the profile page can use them
      const photoStore = photoResults.map((r, i) => ({
        dataUrl: r.dataUrl,
        label: data.labels[i] ?? 'unlabeled'
      }));
      localStorage.setItem('vv_photos', JSON.stringify(photoStore));

      // Submit to API
      const response = await fetch('/api/verified-vibe/verify-step', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          step: 'photos',
          data: {
            images: base64Images,
            mimeTypes: data.photos.map(f => f.type),
            labels: data.labels
          }
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Photo verification failed');
      }

      const result = await response.json();

      // Store verification record
      addVerificationRecord({
        id: `${$user?.id}-photos`,
        userId: $user?.id || '',
        step: 'photos',
        status: 'completed',
        data: result.data,
        completedAt: new Date(),
        createdAt: new Date()
      });

      // Mark step as completed
      completedSteps.add(currentStep);

      // Update progress
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);

      // Update trust score
      updateTrustScoreAfterVerification();

      // Move to next step
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        // All steps complete
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleSpendingSubmit(data: { spendingImage: string; mimeType: string }) {
    error = null;
    clearError();
    loading = true;

    try {
      // Submit to API
      const response = await fetch('/api/verified-vibe/verify-step', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          step: 'spending_or_qa',
          data: {
            spendingImage: data.spendingImage,
            mimeType: data.mimeType,
            gender: $user?.gender,
            archetype: $user?.archetype
          }
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Spending verification failed');
      }

      const result = await response.json();

      // Store verification record
      addVerificationRecord({
        id: `${$user?.id}-spending_or_qa`,
        userId: $user?.id || '',
        step: 'spending_or_qa',
        status: 'completed',
        data: result.data,
        completedAt: new Date(),
        createdAt: new Date()
      });

      // Mark step as completed
      completedSteps.add(currentStep);

      // Update progress
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);

      // Update trust score
      updateTrustScoreAfterVerification();

      // Move to next step or complete
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        // All steps complete
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleDrawnToSubmit(picks: Record<string, string[]>) {
    return handleQASubmit({ responses: picks as Record<string, string | string[]> });
  }

  async function handleHowYouLiveSubmit(data: Record<string, string[]>) {
    localStorage.setItem('vv_how_you_live', JSON.stringify(data));
    return handleQASubmit({ responses: data as Record<string, string | string[]> });
  }

  async function handlePhotosPlaceSubmit(data: { photos: File[]; city: string; openToTravel: boolean }) {
    error = null;
    clearError();
    loading = true;
    try {
      // Convert photos to base64 + data URLs
      const photoResults = await Promise.all(
        data.photos.map(file => new Promise<{ base64: string; dataUrl: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            resolve({ base64: dataUrl.split(',')[1], dataUrl });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }))
      );

      // Persist city to profile draft so profile page shows it
      if (data.city) {
        try {
          const existingDraft = localStorage.getItem('vv_profile_draft');
          const profileDraft = existingDraft ? JSON.parse(existingDraft) : {};
          profileDraft.city = data.city;
          localStorage.setItem('vv_profile_draft', JSON.stringify(profileDraft));
        } catch {}
        if ($user) user.update(u => u ? { ...u, city: data.city } : u);
      }

      // Persist to localStorage for profile page
      localStorage.setItem('vv_photos', JSON.stringify(
        photoResults.map((r, i) => ({ dataUrl: r.dataUrl, label: i === 0 ? 'main' : 'photo' }))
      ));
      localStorage.setItem('vv_city', data.city);
      localStorage.setItem('vv_open_to_travel', String(data.openToTravel));

      // Persist city to profile
      if ($user) {
        await upsertProfile({
          gender: $user?.gender ?? null,
          archetype: $user?.archetype ?? null,
          city: data.city
        });
      }

      // Submit photos step to API
      const response = await fetch('/api/verified-vibe/verify-step', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          step: 'photos',
          data: {
            images: photoResults.map(r => r.base64),
            mimeTypes: data.photos.map(f => f.type),
            labels: Object.fromEntries(data.photos.map((_, i) => [i, i === 0 ? 'main' : 'photo'])),
            city: data.city,
            openToTravel: data.openToTravel
          }
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Photo submission failed');
      }

      const result = await response.json();
      addVerificationRecord({
        id: `${$user?.id}-photos`,
        userId: $user?.id || '',
        step: 'photos',
        status: 'completed',
        data: result.data,
        completedAt: new Date(),
        createdAt: new Date()
      });
      completedSteps.add(currentStep);
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);
      updateTrustScoreAfterVerification();

      // Last step — go to profile
      setPhase('app');
      goto('/verified-vibe/profile');
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleQASubmit(data: { responses: Record<string, string | string[]> }) {
    error = null;
    clearError();

    // Persist locally immediately
    localStorage.setItem('vv_qa_responses', JSON.stringify(data.responses));

    // Mark step done and advance — do not gate on API success
    completedSteps.add(currentStep);
    const progress = (completedSteps.size / totalSteps) * 100;
    verificationProgress.set(progress);
    updateTrustScoreAfterVerification();

    if (currentStep < totalSteps) {
      currentStep++;
      verificationStep.set(currentStep);
    } else {
      setPhase('app');
      goto('/verified-vibe/discover');
    }

    // Fire-and-forget background sync
    getAuthHeaders().then(headers =>
      fetch('/api/verified-vibe/verify-step', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          step: 'spending_or_qa',
          data: { responses: data.responses, gender: $user?.gender, archetype: $user?.archetype }
        })
      }).then(async res => {
        if (res.ok) {
          const result = await res.json();
          addVerificationRecord({
            id: `${$user?.id}-spending_or_qa`,
            userId: $user?.id || '',
            step: 'spending_or_qa',
            status: 'completed',
            data: result.data,
            completedAt: new Date(),
            createdAt: new Date()
          });
        }
      }).catch(() => {/* silent — local data already saved */})
    );
  }

  async function handleMatrimonyProfileSubmit(data: { profile: Record<string, string | string[]> }) {
    error = null;
    clearError();
    loading = true;
    try {
      localStorage.setItem('vv_matrimony_profile', JSON.stringify(data.profile));
      completedSteps.add(currentStep);
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);
      updateTrustScoreAfterVerification();
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleMatrimonyPrefsSubmit(data: { preferences: Record<string, string | string[]> }) {
    error = null;
    clearError();
    loading = true;

    try {
      // Persist partner preferences to localStorage for use in profile/matching
      localStorage.setItem('vv_matrimony_preferences', JSON.stringify(data.preferences));

      completedSteps.add(currentStep);
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);
      updateTrustScoreAfterVerification();

      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleCasualGenerousProfileSubmit(data: { profile: Record<string, string | string[]> }) {
    error = null;
    clearError();
    loading = true;
    try {
      localStorage.setItem('vv_casual_generous_profile', JSON.stringify(data.profile));
      completedSteps.add(currentStep);
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);
      updateTrustScoreAfterVerification();
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleCasualGenerousPrefsSubmit(data: { preferences: Record<string, string | string[]> }) {
    error = null;
    clearError();
    loading = true;
    try {
      localStorage.setItem('vv_casual_generous_preferences', JSON.stringify(data.preferences));
      completedSteps.add(currentStep);
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);
      updateTrustScoreAfterVerification();
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleForeverIntentSubmit(data: { intent: Record<string, string | string[]> }) {
    error = null;
    clearError();
    loading = true;
    try {
      localStorage.setItem('vv_forever_intent', JSON.stringify(data.intent));
      completedSteps.add(currentStep);
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);
      updateTrustScoreAfterVerification();
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleForeverProfileSubmit(data: { profile: Record<string, string | string[]> }) {
    error = null;
    clearError();
    loading = true;
    try {
      localStorage.setItem('vv_forever_profile', JSON.stringify(data.profile));
      completedSteps.add(currentStep);
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);
      updateTrustScoreAfterVerification();
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleForeverPrefsSubmit(data: { preferences: Record<string, string | string[]> }) {
    error = null;
    clearError();
    loading = true;
    try {
      localStorage.setItem('vv_forever_preferences', JSON.stringify(data.preferences));
      completedSteps.add(currentStep);
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);
      updateTrustScoreAfterVerification();
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleReboundHealingSubmit(data: { responses: Record<string, string | string[]> }) {
    error = null;
    clearError();
    loading = true;
    try {
      localStorage.setItem('vv_rebound_healing', JSON.stringify(data.responses));
      completedSteps.add(currentStep);
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);
      updateTrustScoreAfterVerification();
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleRomanticIntentSubmit(data: { intent: Record<string, string | string[]> }) {
    error = null;
    clearError();
    loading = true;
    try {
      localStorage.setItem('vv_romantic_intent', JSON.stringify(data.intent));
      completedSteps.add(currentStep);
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);
      updateTrustScoreAfterVerification();
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleRomanticProfileSubmit(data: { profile: Record<string, string | string[]> }) {
    error = null;
    clearError();
    loading = true;
    try {
      localStorage.setItem('vv_romantic_profile', JSON.stringify(data.profile));
      completedSteps.add(currentStep);
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);
      updateTrustScoreAfterVerification();
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleRomanticPrefsSubmit(data: { preferences: Record<string, string | string[]> }) {
    error = null;
    clearError();
    loading = true;
    try {
      localStorage.setItem('vv_romantic_preferences', JSON.stringify(data.preferences));
      completedSteps.add(currentStep);
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);
      updateTrustScoreAfterVerification();
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleSecondChapterIntentSubmit(data: { intent: Record<string, string | string[]> }) {
    error = null;
    clearError();
    loading = true;
    try {
      localStorage.setItem('vv_second_chapter_intent', JSON.stringify(data.intent));
      completedSteps.add(currentStep);
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);
      updateTrustScoreAfterVerification();
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleSecondChapterProfileSubmit(data: { profile: Record<string, string | string[]> }) {
    error = null;
    clearError();
    loading = true;
    try {
      localStorage.setItem('vv_second_chapter_profile', JSON.stringify(data.profile));
      completedSteps.add(currentStep);
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);
      updateTrustScoreAfterVerification();
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleSecondChapterPrefsSubmit(data: { preferences: Record<string, string | string[]> }) {
    error = null;
    clearError();
    loading = true;
    try {
      localStorage.setItem('vv_second_chapter_preferences', JSON.stringify(data.preferences));
      completedSteps.add(currentStep);
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);
      updateTrustScoreAfterVerification();
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleJustFriendsIntentSubmit(data: { intent: Record<string, string | string[]> }) {
    error = null;
    clearError();
    loading = true;
    try {
      localStorage.setItem('vv_just_friends_intent', JSON.stringify(data.intent));
      completedSteps.add(currentStep);
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);
      updateTrustScoreAfterVerification();
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleJustFriendsProfileSubmit(data: { profile: Record<string, string | string[]> }) {
    error = null;
    clearError();
    loading = true;
    try {
      localStorage.setItem('vv_just_friends_profile', JSON.stringify(data.profile));
      completedSteps.add(currentStep);
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);
      updateTrustScoreAfterVerification();
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleJustFriendsPrefsSubmit(data: { preferences: Record<string, string | string[]> }) {
    error = null;
    clearError();
    loading = true;
    try {
      localStorage.setItem('vv_just_friends_preferences', JSON.stringify(data.preferences));
      completedSteps.add(currentStep);
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);
      updateTrustScoreAfterVerification();
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleUntouchedHeartIntentSubmit(data: { intent: Record<string, string | string[]> }) {
    error = null;
    clearError();
    loading = true;
    try {
      localStorage.setItem('vv_untouched_heart_intent', JSON.stringify(data.intent));
      completedSteps.add(currentStep);
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);
      updateTrustScoreAfterVerification();
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleUntouchedHeartProfileSubmit(data: { profile: Record<string, string | string[]> }) {
    error = null;
    clearError();
    loading = true;
    try {
      localStorage.setItem('vv_untouched_heart_profile', JSON.stringify(data.profile));
      completedSteps.add(currentStep);
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);
      updateTrustScoreAfterVerification();
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleUntouchedHeartPrefsSubmit(data: { preferences: Record<string, string | string[]> }) {
    error = null;
    clearError();
    loading = true;
    try {
      localStorage.setItem('vv_untouched_heart_preferences', JSON.stringify(data.preferences));
      completedSteps.add(currentStep);
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);
      updateTrustScoreAfterVerification();
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  async function handleProfileIntakeSubmit(data: ProfileIntakeData) {
    loading = true;
    error = null;

    // Save draft immediately
    localStorage.setItem('vv_profile_draft', JSON.stringify(data));

    // Update the user store with basic identity fields
    if ($user) {
      user.update(u => u ? {
        ...u,
        firstName: data.firstName,
        age: data.age,
        city: data.city,
        about: data.about,
        looking: data.lookingFor,
        updatedAt: new Date()
      } : u);
    }

    try {
      // Persist profile to Supabase
      await upsertProfile({
        gender: $user?.gender ?? null,
        archetype: $user?.archetype ?? null,
        first_name: data.firstName,
        age: data.age,
        city: data.city
      });

      const photos = JSON.parse(localStorage.getItem('vv_photos') ?? '[]') as { dataUrl: string; label: string }[];
      const photoLabels = photos.map(p => p.label);

      const response = await fetch('/api/verified-vibe/generate-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intake: data,
          photoLabels,
          archetype: $user?.archetype,
          trustScore: $user?.trustScore ?? 0
        })
      });

      if (response.ok) {
        const generated = await response.json();
        localStorage.setItem('vv_profile', JSON.stringify(generated));
      }
      // If API fails, profile page falls back to raw draft — not a blocker
    } catch (err) {
      console.error('Profile intake error:', err);
      // Non-fatal — profile page reads draft directly even if Supabase upsert fails
    } finally {
      loading = false;
    }

    setPhase('app');
    goto('/verified-vibe/profile');
  }

  async function handleNext() {
    error = null;
    clearError();

    // Validate current step data
    if (!validateStepData(currentStep)) {
      error = 'Please complete this step before continuing';
      return;
    }

    loading = true;

    try {
      // Submit current step to API
      const stepType = steps[currentStep - 1].stepType;
      const response = await fetch('/api/verified-vibe/verify-step', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          step: stepType,
          data: stepData[currentStep] || {}
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Verification failed');
      }

      const result = await response.json();

      // Store verification record
      addVerificationRecord({
        id: `${$user?.id}-${stepType}`,
        userId: $user?.id || '',
        step: stepType,
        status: 'completed',
        data: result.data,
        completedAt: new Date(),
        createdAt: new Date()
      });

      // Mark step as completed
      completedSteps.add(currentStep);

      // Update progress
      const progress = (completedSteps.size / totalSteps) * 100;
      verificationProgress.set(progress);

      // Update trust score
      updateTrustScoreAfterVerification();

      // Move to next step or complete
      if (currentStep < totalSteps) {
        currentStep++;
        verificationStep.set(currentStep);
      } else {
        // All steps complete
        setPhase('app');
        goto('/verified-vibe/discover');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
    } finally {
      loading = false;
    }
  }

  function handleBack() {
    error = null;
    clearError();
    showSkipWarning = false;

    if (currentStep > 1) {
      currentStep--;
      verificationStep.set(currentStep);
    } else {
      goto('/verified-vibe/verify');
    }
  }

  function handleSkipClick() {
    showSkipWarning = true;
  }

  function confirmSkip() {
    error = null;
    clearError();
    showSkipWarning = false;
    skippedSteps.add(currentStep);

    if (currentStep < totalSteps) {
      currentStep++;
      verificationStep.set(currentStep);
    } else {
      // All steps processed (some skipped)
      setPhase('app');
      goto('/verified-vibe/discover');
    }
  }

  function cancelSkip() {
    showSkipWarning = false;
  }

  function validateStepData(step: number): boolean {
    // Basic validation - in real app, would validate file uploads, etc.
    return true;
  }

  function updateStepData(step: number, data: any) {
    stepData[step] = data;
  }

  function getProgressPercentage(): number {
    return (currentStep / totalSteps) * 100;
  }

  function isStepCompleted(step: number): boolean {
    return completedSteps.has(step);
  }

  function isStepSkipped(step: number): boolean {
    return skippedSteps.has(step);
  }

  /**
   * Update trust score after verification step is completed
   */
  function updateTrustScoreAfterVerification() {
    let records: any[] = [];
    userVerification.subscribe((r) => {
      records = r;
    })();
    
    const trustScore = calculateTrustScore(records);
    updateTrustScore(trustScore);
  }
</script>

<div class="verification-screen">
  <!-- Header -->
  <div class="verification-header" transition:slide={{ duration: 400, delay: 0, axis: 'y' }}>
    <button class="back-btn" onclick={handleBack} disabled={loading} aria-label="Go back">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>
    <div class="header-title">Verification</div>
    <div class="header-spacer"></div>
  </div>

  <!-- Step indicators -->
  <div class="step-navigation">
    <div class="step-indicators">
      {#each steps as step (step.number)}
        {@const completed = isStepCompleted(step.number)}
        {@const skipped = isStepSkipped(step.number)}
        {@const active = currentStep === step.number}
        <div class="step-indicator {active ? 'active' : ''} {completed ? 'completed' : ''} {skipped ? 'skipped' : ''}">
          <div class="step-number">
            {#if completed || skipped}
              <span class="checkmark">✓</span>
            {:else}
              {step.number}
            {/if}
          </div>
        </div>
        {#if step.number < steps.length}
          <div class="step-connector {completed ? 'step-connector--done' : ''}"></div>
        {/if}
      {/each}
    </div>
  </div>

  <!-- Progress bar -->
  <div class="progress-container" transition:slide={{ duration: 400, delay: 100, axis: 'y' }}>
    <div class="progress-bar">
      <div class="progress-fill" style="width: {getProgressPercentage()}%"></div>
    </div>
  </div>

  <!-- Error message -->
  {#if error}
    <div class="error-banner" transition:slide={{ duration: 300, axis: 'y' }}>
      <div class="error-icon">⚠️</div>
      <div class="error-message">{error}</div>
      <button class="error-close" onclick={() => { error = null; clearError(); }}>×</button>
    </div>
  {/if}

  <!-- Step content -->
  {#key currentStep}
  <div class="verification-content">
    <!-- Step-specific content -->
    <div class="step-body" transition:slide={{ duration: 300, axis: 'y' }}>
      {#if currentStep === 1 && identitySubView === 'overview'}
        <IdentityCheckStep
          idDone={identityIdDone}
          selfieDone={identitySelfieDone}
          idFields={extractedIDFields}
          {loading}
          onIDFileSelected={handleIDStepDone}
          onSelfieFileSelected={handleSelfieCapture}
          onStartSelfie={() => { identitySubView = 'liveness'; }}
          onComplete={handleIdentityComplete}
          onSkip={handleSkipClick}
        />
      {:else if currentStep === 1 && identitySubView === 'liveness'}
        <LivenessStep
          {idPhotoBase64}
          onSubmit={handleLivenessStepDone}
          onCancel={() => { identitySubView = 'overview'; }}
        />
      {:else if currentStep === 2}
        <DrawnToStep
          onSubmit={handleDrawnToSubmit}
          onCancel={handleBack}
          onSkip={handleSkipClick}
        />
      {:else if currentStep === 3}
        <HowYouLiveStep
          onSubmit={handleHowYouLiveSubmit}
          onCancel={handleBack}
          onSkip={handleSkipClick}
        />
      {:else if currentStep === 4}
        <PhotosPlaceStep
          onSubmit={handlePhotosPlaceSubmit}
          onCancel={handleBack}
          onSkip={handleSkipClick}
        />
      {/if}
    </div>
  </div>
  {/key}

  <!-- Skip Warning Modal -->
  {#if showSkipWarning}
    <div class="skip-warning-overlay" transition:fade={{ duration: 200 }}>
      <div class="skip-warning-modal" transition:slide={{ duration: 300, axis: 'y' }}>
        <div class="warning-icon">⚠️</div>
        <h3 class="warning-title">Skip this step?</h3>
        <p class="warning-text">
          Skipping verification steps may reduce your trust score and limit your matches.
        </p>
        <div class="warning-actions">
          <button class="btn btn-secondary" onclick={cancelSkip} disabled={loading}>
            Cancel
          </button>
          <button class="btn btn-warning" onclick={confirmSkip} disabled={loading}>
            Skip Anyway
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Each step component handles its own CTA and skip button -->

  {#if currentStep === 1 && motivationCard}
  <button
    class="motivation-card"
    onclick={() => { openedMotivationProfile = motivationCard.profile; }}
    aria-label="View {motivationCard.profile.name}'s profile"
    transition:fade={{ duration: 300, delay: 200 }}
  >
    <div class="motivation-avatar-wrap">
      <img
        class="motivation-avatar"
        src={motivationCard.profile.photoUrl}
        alt={motivationCard.profile.name}
      />
      <span class="motivation-verified-badge">✓</span>
    </div>
    <div class="motivation-body">
      <p class="motivation-quote">
        {motivationCard.quoteBefore}<em class="motivation-highlight">{motivationCard.highlight}</em>{motivationCard.quoteAfter}
      </p>
      <p class="motivation-meta">
        {motivationCard.profile.name}, {motivationCard.profile.age} · {motivationCard.profession}
      </p>
    </div>
    <span class="motivation-chevron">›</span>
  </button>
  {/if}

  {#if currentStep === 2 && archetypeCards.step3}
    {@const card = archetypeCards.step3}
    <button class="motivation-card motivation-card--tall" onclick={() => { openedMotivationProfile = card.profile; }} aria-label="View {card.profile.name}'s profile" transition:fade={{ duration: 300, delay: 200 }}>
      <div class="motivation-avatar-wrap"><img class="motivation-avatar" src={card.profile.photoUrl} alt={card.profile.name} /><span class="motivation-verified-badge">✓</span></div>
      <div class="motivation-body"><p class="motivation-quote">{card.quoteBefore}<em class="motivation-highlight">{card.highlight}</em>{card.quoteAfter}</p><p class="motivation-meta">{card.profile.name}, {card.profile.age} · {card.profession}</p></div>
      <span class="motivation-chevron">›</span>
    </button>
  {/if}

  {#if currentStep === 3 && archetypeCards.step4}
    {@const card = archetypeCards.step4}
    <button class="motivation-card motivation-card--tall" onclick={() => { openedMotivationProfile = card.profile; }} aria-label="View {card.profile.name}'s profile" transition:fade={{ duration: 300, delay: 200 }}>
      <div class="motivation-avatar-wrap"><img class="motivation-avatar" src={card.profile.photoUrl} alt={card.profile.name} /><span class="motivation-verified-badge">✓</span></div>
      <div class="motivation-body"><p class="motivation-quote">{card.quoteBefore}<em class="motivation-highlight">{card.highlight}</em>{card.quoteAfter}</p><p class="motivation-meta">{card.profile.name}, {card.profile.age} · {card.profession}</p></div>
      <span class="motivation-chevron">›</span>
    </button>
  {/if}

  {#if currentStep === 4 && archetypeCards.step5}
    {@const card = archetypeCards.step5}
    <button class="motivation-card motivation-card--tall" onclick={() => { openedMotivationProfile = card.profile; }} aria-label="View {card.profile.name}'s profile" transition:fade={{ duration: 300, delay: 200 }}>
      <div class="motivation-avatar-wrap"><img class="motivation-avatar" src={card.profile.photoUrl} alt={card.profile.name} /><span class="motivation-verified-badge">✓</span></div>
      <div class="motivation-body"><p class="motivation-quote">{card.quoteBefore}<em class="motivation-highlight">{card.highlight}</em>{card.quoteAfter}</p><p class="motivation-meta">{card.profile.name}, {card.profile.age} · {card.profession}</p></div>
      <span class="motivation-chevron">›</span>
    </button>
  {/if}

  {#if currentStep === 5 && archetypeCards.step6}
    {@const card = archetypeCards.step6}
    <button class="motivation-card motivation-card--tall" onclick={() => { openedMotivationProfile = card.profile; }} aria-label="View {card.profile.name}'s profile" transition:fade={{ duration: 300, delay: 200 }}>
      <div class="motivation-avatar-wrap"><img class="motivation-avatar" src={card.profile.photoUrl} alt={card.profile.name} /><span class="motivation-verified-badge">✓</span></div>
      <div class="motivation-body"><p class="motivation-quote">{card.quoteBefore}<em class="motivation-highlight">{card.highlight}</em>{card.quoteAfter}</p><p class="motivation-meta">{card.profile.name}, {card.profile.age} · {card.profession}</p></div>
      <span class="motivation-chevron">›</span>
    </button>
  {/if}
</div>

<ProfilePreviewSheet
  profile={openedMotivationProfile}
  onClose={() => { openedMotivationProfile = null; }}
  redirectTo="/verified-vibe/verification"
/>

<style>
  .verification-screen {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    padding: 0;
    background: var(--bg-1);
  }

  /* Header */
  .verification-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-1);
    background: var(--bg-1);
    gap: 8px;
  }

  .back-btn {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-1);
    transition: all 200ms ease;
    flex-shrink: 0;
  }

  .back-btn:active:not(:disabled) {
    background: var(--bg-3);
    border-color: var(--border-2);
  }

  .back-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .header-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
    flex: 1;
    text-align: center;
  }

  .header-spacer {
    width: 32px;
    flex-shrink: 0;
  }

  /* Step Navigation */
  .step-navigation {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-1);
    background: var(--bg-1);
  }

  .step-indicators {
    display: flex;
    justify-content: space-between;
    gap: 6px;
  }

  .step-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    flex: 1;
    cursor: pointer;
    transition: all 200ms ease;
  }

  .step-number {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--bg-2);
    border: 2px solid var(--border-1);
    display: grid;
    place-items: center;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-2);
    transition: all 200ms ease;
  }

  .step-indicator.active .step-number {
    background: var(--accent-bright);
    border-color: var(--accent-bright);
    color: var(--bg-1);
    box-shadow: 0 0 0 2px var(--accent-tint);
  }

  .step-indicator.completed .step-number {
    background: var(--accent-bright);
    border-color: var(--accent-bright);
    color: var(--bg-1);
  }

  .step-indicator.skipped .step-number {
    background: var(--bg-3);
    border-color: var(--border-2);
    color: var(--text-3);
  }

  .checkmark {
    font-size: 14px;
  }

  .skip-mark {
    font-size: 13px;
  }

  .step-label {
    font-size: 8px;
    font-weight: 600;
    color: var(--text-3);
    text-align: center;
  }

  @media (min-width: 768px) {
    .verification-header {
      padding: 16px 20px;
      gap: 12px;
    }

    .back-btn {
      width: 40px;
      height: 40px;
      border-radius: 8px;
    }

    .back-btn:hover:not(:disabled) {
      background: var(--bg-3);
      border-color: var(--border-2);
    }

    .back-btn:active:not(:disabled) {
      background: var(--bg-3);
      border-color: var(--border-2);
    }

    .header-title {
      font-size: 16px;
    }

    .header-spacer {
      width: 40px;
    }

    .step-navigation {
      padding: 12px 20px;
    }

    .step-indicators {
      gap: 8px;
    }

    .step-indicator {
      gap: 4px;
    }

    .step-number {
      width: 36px;
      height: 36px;
      border: 2px solid var(--border-1);
      font-size: 14px;
    }

    .step-indicator.active .step-number {
      box-shadow: 0 0 0 3px var(--accent-tint);
    }

    .checkmark {
      font-size: 18px;
    }

    .skip-mark {
      font-size: 16px;
    }

    .step-label {
      font-size: 10px;
    }
  }

  /* Progress Container */
  .progress-container {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-1);
    background: var(--bg-1);
  }

  .progress-bar {
    width: 100%;
    height: 3px;
    background: var(--bg-3);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 6px;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent-bright), var(--accent-bright));
    transition: width 300ms ease;
    border-radius: 2px;
  }

  .progress-text {
    font-size: 11px;
    color: var(--text-3);
    text-align: center;
    font-weight: 500;
  }

  /* Content */
  .verification-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 14px;
    display: flex;
    flex-direction: column;
  }

  .step-header {
    text-align: center;
    margin-bottom: 12px;
  }

  .step-header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    gap: 8px;
  }

  .step-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 700;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .step-label {
    color: var(--text-3);
  }

  .step-label-divider {
    color: var(--text-4);
  }

  .step-name {
    color: var(--text-2);
  }

  .step-title {
    font-family: var(--font-serif, 'Georgia', serif);
    font-size: 24px;
    font-style: italic;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--text-1);
    line-height: 1.2;
  }

  .step-title::first-line {
    color: var(--accent-bright);
  }

  .step-time {
    font-size: 11px;
    color: var(--text-3);
    margin: 0;
  }

  .step-body {
    margin-bottom: 16px;
  }

  @media (min-width: 768px) {
    .progress-container {
      padding: 12px 20px;
    }

    .progress-bar {
      height: 4px;
      margin-bottom: 8px;
    }

    .progress-text {
      font-size: 12px;
    }

    .verification-content {
      padding: 24px 20px;
    }

    .step-header {
      margin-bottom: 32px;
    }

    .step-header-top {
      margin-bottom: 16px;
      gap: 12px;
    }

    .step-meta {
      gap: 6px;
      font-size: 11px;
    }

    .step-title {
      font-size: 32px;
      margin: 0 0 12px;
    }

    .step-time {
      font-size: 12px;
    }

    .step-body {
      margin-bottom: 24px;
    }
  }

  /* Skip Warning Modal */
  .skip-warning-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: grid;
    place-items: center;
    z-index: 100;
    padding: 20px;
  }

  .skip-warning-modal {
    background: var(--bg-1);
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    width: 100%;
    text-align: center;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  }

  .warning-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .warning-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 12px;
    color: var(--text-1);
  }

  .warning-text {
    font-size: 14px;
    color: var(--text-2);
    margin: 0 0 20px;
    line-height: 1.5;
  }

  .warning-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  /* Actions */
  .verification-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    padding: 16px 20px calc(16px + env(safe-area-inset-bottom, 0));
    border-top: 1px solid var(--border-1);
    background: var(--bg-1);
  }

  .verification-actions.single {
    grid-template-columns: 1fr;
  }

  /* Button Styles */
  .btn {
    padding: 12px 16px;
    border-radius: 8px;
    border: none;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 200ms ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
  }

  .btn-primary {
    background: var(--accent-bright);
    color: var(--bg-1);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent-bright);
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }

  .btn-secondary {
    background: var(--bg-2);
    color: var(--text-1);
    border: 1px solid var(--border-1);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-3);
    border-color: var(--border-2);
  }

  .btn-warning {
    background: #f59e0b;
    color: white;
  }

  .btn-warning:hover:not(:disabled) {
    background: #d97706;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .loading-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Mobile Responsive */
  @media (max-width: 767px) {
    .verification-header {
      padding: 12px 16px;
      gap: 8px;
    }

    .back-btn {
      width: 40px;
      height: 40px;
      min-width: 40px;
      min-height: 40px;
    }

    .header-title {
      font-size: 15px;
    }

    .header-spacer {
      width: 40px;
    }

    .step-navigation {
      padding: 10px 16px;
    }

    .step-indicators {
      gap: 6px;
    }

    .step-number {
      width: 32px;
      height: 32px;
      font-size: 12px;
    }

    .step-label {
      font-size: 9px;
    }

    .progress-container {
      padding: 10px 16px;
    }

    .progress-bar {
      height: 3px;
      margin-bottom: 6px;
    }

    .progress-text {
      font-size: 11px;
    }

    .error-banner {
      margin: 10px 12px 0;
      padding: 10px 12px;
      font-size: 12px;
    }

    .verification-content {
      padding: 18px 16px;
    }

    .step-header {
      margin-bottom: 24px;
    }

    .step-icon {
      font-size: 40px;
      margin-bottom: 12px;
    }

    .step-title {
      font-size: 20px;
      margin: 0 0 6px;
    }

    .step-description {
      font-size: 13px;
      margin: 0 0 6px;
    }

    .step-time {
      font-size: 11px;
    }

    .step-body {
      margin-bottom: 16px;
    }

    .skip-warning-modal {
      padding: 20px;
      border-radius: 12px;
    }

    .warning-icon {
      font-size: 40px;
      margin-bottom: 12px;
    }

    .warning-title {
      font-size: 16px;
      margin: 0 0 10px;
    }

    .warning-text {
      font-size: 13px;
      margin: 0 0 16px;
    }

    .warning-actions {
      gap: 10px;
    }

    .verification-actions {
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0));
    }

    .btn {
      min-height: 44px;
      padding: 12px 14px;
      font-size: 13px;
      border-radius: 8px;
    }
  }

  /* Tablet Responsive */
  @media (min-width: 768px) and (max-width: 1023px) {
    .verification-content {
      padding: 28px 24px;
    }

    .step-header {
      margin-bottom: 36px;
    }

    .step-icon {
      font-size: 44px;
    }

    .step-title {
      font-size: 22px;
    }

    .verification-actions {
      gap: 14px;
      padding: 18px 24px calc(18px + env(safe-area-inset-bottom, 0));
    }
  }

  /* Desktop */
  @media (min-width: 1024px) {
    .verification-screen {
      max-width: 600px;
      margin: 0 auto;
    }

    .verification-content {
      padding: 32px 28px;
    }

    .step-header {
      margin-bottom: 40px;
    }

    .step-icon {
      font-size: 52px;
    }

    .step-title {
      font-size: 26px;
    }

    .verification-actions {
      gap: 16px;
      padding: 20px 28px;
    }
  }

  /* ── Motivation card ──────────────────────────────────────────────────────── */

  .motivation-card--tall {
    align-items: flex-start;
  }

  .motivation-card {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 0 16px 24px;
    padding: 14px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 14px;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    width: calc(100% - 32px);
    transition: background 160ms, border-color 160ms;
    -webkit-tap-highlight-color: transparent;
  }

  .motivation-card:active {
    background: var(--bg-3);
    border-color: var(--accent-bright);
  }

  @media (hover: hover) {
    .motivation-card:hover {
      background: var(--bg-3);
      border-color: color-mix(in srgb, var(--accent-bright) 40%, transparent);
    }
  }

  .motivation-avatar-wrap {
    position: relative;
    flex-shrink: 0;
    width: 72px;
    height: 72px;
  }

  .motivation-avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    object-position: top center;
    border: 2px solid var(--border-2);
    display: block;
  }

  .motivation-verified-badge {
    position: absolute;
    bottom: 1px;
    right: 1px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--accent-bright);
    color: #06281e;
    font-size: 11px;
    font-weight: 700;
    display: grid;
    place-items: center;
    border: 2px solid var(--bg-2);
    line-height: 1;
  }

  .motivation-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    flex: 1;
  }

  .motivation-quote {
    font-size: 13px;
    color: var(--text-1);
    line-height: 1.55;
    margin: 0;
    font-style: italic;
  }

  .motivation-highlight {
    color: var(--accent-bright);
    font-style: italic;
    font-weight: 600;
  }

  .motivation-meta {
    font-size: 11px;
    color: var(--text-3);
    margin: 0;
  }

  .meta-verified {
    color: var(--accent-bright);
    font-weight: 600;
  }

  .motivation-chevron {
    font-size: 20px;
    color: var(--text-4);
    flex-shrink: 0;
    line-height: 1;
    margin-left: 4px;
  }
</style>
