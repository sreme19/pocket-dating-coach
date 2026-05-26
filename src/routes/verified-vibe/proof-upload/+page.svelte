<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getSupabaseClient } from '$lib/client/supabase';

  type Category = 'lifestyle' | 'hosting' | 'discipline' | 'social_proof' | 'linkedin' | 'instagram' | 'twitter' | 'habit_tracker' | 'intro' | 'spending' | 'assets' | 'wealth';
  type Step = 'upload' | 'analyzing' | 'success' | 'failed';

  interface CategoryConfig {
    icon: string;
    title: string;
    subtitle: string;
    examples: string[];
    maxFiles: number;
    hintLine: string;
    accept: string;
    hasUrlInput?: boolean;
    urlLabel?: string;
    urlPlaceholder?: string;
    hasOAuthConnect?: boolean;
    connectLabel?: string;
    connectUrl?: string;
    connectColor?: string;
  }

  const PRIVACY_COPY: Record<string, string> = {
    lifestyle:    '🔒 Your uploads stay private. They help confirm your profile is authentic and improve match quality.',
    hosting:      '🔒 Nothing here is public. These signals confirm your lifestyle and improve compatibility.',
    discipline:   '🔒 Private by default. Your proofs strengthen trust, verify authenticity, and help you get better matches.',
    social_proof: '🔒 Nothing here is public. These signals confirm your lifestyle and improve compatibility.',
    linkedin:     '🔒 Your uploads are never shared publicly. Used only to verify authenticity and improve your Trust Score.',
    instagram:    '🔒 Your profile stays private. This only confirms you are an active, genuine person online.',
    twitter:      '🔒 Your profile stays private. This only confirms your real interests and online presence.',
    habit_tracker:'🔒 Show, don\'t fake. Everything stays private while we verify your vibe. Boosts your Trust Score.',
    intro:        '🔒 Your voice and video stay completely private. Never shown publicly. They make women feel safe messaging you first.',
    spending:     '🔒 Your receipts stay completely private. We only check that your generosity signals are genuine.',
    assets:       '🔒 Your documents stay completely private. We only verify ownership. The name on the document must match your verified government ID. No need to match with your profile name.',
  };

  const CONFIGS: Record<Category, CategoryConfig> = {
    lifestyle: {
      icon: '🌍',
      title: 'Lifestyle Proof',
      subtitle: 'Show your real world: travel, dining, experiences',
      examples: [
        'Hotel or flight booking screenshots',
        'Restaurant or bar photos with context',
        'Event or concert tickets',
        'Travel photos with locations and moments visible',
      ],
      maxFiles: 20,
      hintLine: 'Mix photos and booking screenshots for the strongest signal. Up to 20 photos.',
      accept: 'image/*',
    },
    hosting: {
      icon: '🍽️',
      title: 'Hosting Proof',
      subtitle: 'Show you host dinners, celebrations, gatherings',
      examples: [
        'Photos of dinners or parties you\'ve hosted',
        'Table setups or event setups',
        'Group celebration photos at your place',
        'Restaurant reservation or catering receipt',
      ],
      maxFiles: 20,
      hintLine: 'Real moments at home work better than restaurant photos alone. Up to 20 photos.',
      accept: 'image/*',
    },
    discipline: {
      icon: '💪',
      title: 'Discipline Proof',
      subtitle: 'Show your consistent routines',
      examples: [
        'Gym check-in or workout selfie',
        'Fitness app streak screenshot',
        'Reading app or book log',
        'Sleep tracker weekly summary',
      ],
      maxFiles: 20,
      hintLine: 'Streak screens from apps are the most convincing. Up to 20 photos.',
      accept: 'image/*',
    },
    social_proof: {
      icon: '🤝',
      title: 'Social Proof',
      subtitle: 'Show your real social connections',
      examples: [
        'Group photos with friends',
        'Community or club events you attend',
        'Sports team or group activity photos',
        'Social gathering moments',
      ],
      maxFiles: 20,
      hintLine: 'Natural group moments beat posed shots. Up to 20 photos.',
      accept: 'image/*',
    },
    linkedin: {
      icon: '💼',
      title: 'LinkedIn / CV',
      subtitle: 'Connect your LinkedIn or upload your CV',
      examples: [
        'Paste your LinkedIn URL below for instant one-click verification',
        'Or screenshot your profile with name, title and company visible',
        'Or upload your CV or resume as a PDF',
        'We only check your role and company — nothing else is read',
      ],
      maxFiles: 2,
      hintLine: 'URL connection is fastest. Screenshot or CV also accepted.',
      accept: 'image/*,.pdf',
      hasUrlInput: true,
      urlLabel: 'LinkedIn URL',
      urlPlaceholder: 'linkedin.com/in/yourname',
    },
    instagram: {
      icon: '📸',
      title: 'Instagram',
      subtitle: 'Connect your Instagram to verify social presence',
      examples: [
        'Tap "Connect Instagram" — it opens Instagram login in a new tab',
        'Sign in to your Instagram account',
        'Copy your profile URL from the browser address bar',
        'Come back and paste it below — we only check username, posts, and followers',
      ],
      maxFiles: 1,
      hintLine: 'Takes under 60 seconds. Your posts and DMs stay private.',
      accept: 'image/*',
      hasOAuthConnect: true,
      connectLabel: 'Connect Instagram',
      connectUrl: 'https://www.instagram.com/accounts/login/',
      connectColor: '#E1306C',
      hasUrlInput: true,
      urlLabel: 'Your Instagram profile URL',
      urlPlaceholder: 'instagram.com/yourhandle',
    },
    twitter: {
      icon: '🐦',
      title: 'Twitter / X',
      subtitle: 'Connect your Twitter / X to show real interests',
      examples: [
        'Tap "Connect X" — it opens X / Twitter login in a new tab',
        'Sign in to your X account',
        'Copy your profile URL from the browser address bar',
        'Come back and paste it below — your DMs and private posts stay private',
      ],
      maxFiles: 1,
      hintLine: 'Takes under 60 seconds. Your private posts are never accessed.',
      accept: 'image/*',
      hasOAuthConnect: true,
      connectLabel: 'Connect X (Twitter)',
      connectUrl: 'https://x.com/i/flow/login',
      connectColor: '#000000',
      hasUrlInput: true,
      urlLabel: 'Your X / Twitter profile URL',
      urlPlaceholder: 'x.com/yourhandle',
    },
    habit_tracker: {
      icon: '📱',
      title: 'Habit Tracker',
      subtitle: 'Screenshot your habit app and show real streaks',
      examples: [
        'Streak screen from Habitica, Streaks, or similar',
        'Sleep data from Oura or Apple Health',
        'Workout log from Fitbit, Garmin, or Nike Run',
        'Reading progress from Goodreads or Kindle',
      ],
      maxFiles: 2,
      hintLine: 'Any habit app works. Consistency is what matters.',
      accept: 'image/*',
    },
    intro: {
      icon: '🎙️',
      title: 'Voice & Video Intro',
      subtitle: 'A short intro makes women feel safe messaging you first',
      examples: [
        '30 to 60 second voice memo, introduce yourself naturally',
        'Short video clip (face visible, no filters needed)',
        'Talk about what you\'re looking for, your vibe',
        'Natural beats scripted. Just be yourself.',
      ],
      maxFiles: 2,
      hintLine: 'One voice and one video is the ideal combo.',
      accept: 'audio/*,video/*',
    },
    spending: {
      icon: '💳',
      title: 'Generosity Proof',
      subtitle: 'Show genuine generosity through dining, travel, experiences',
      examples: [
        'Restaurant bill or booking confirmation for a nice dinner',
        'Travel or hotel receipt for a trip you planned',
        'Premium experience tickets (concerts, events, activities)',
        'Any receipt that shows you invest in good experiences',
      ],
      maxFiles: 5,
      hintLine: 'Blur any sensitive account or card numbers before uploading.',
      accept: 'image/*',
    },
    assets: {
      icon: '🏠',
      title: 'Assets',
      subtitle: 'Verify car, property or company ownership',
      examples: [
        'Car registration document — your name must be visible',
        'Property deed or mortgage statement — name match required',
        'Company registration or ownership certificate',
        'Screenshot of ownership portal or app — name clearly shown',
      ],
      maxFiles: 5,
      hintLine: '⚠️ Name on document must match your government ID, not your display name. Screenshots are accepted.',
      accept: 'image/*,.pdf',
    },
    wealth: {
      icon: '💰',
      title: 'Wealth Proof',
      subtitle: 'Verify income, savings and investments privately',
      examples: [
        'Bank statement (PDF or screenshot) — name + balance visible',
        'Salary slip or payslip — name, employer, net pay shown',
        'Investment portfolio screenshot (Zerodha, Groww, etc.)',
        'Tax return (ITR) or Form 16 — income section visible',
      ],
      maxFiles: 5,
      hintLine: '🔒 Fully private — never shared publicly. Blur account numbers before uploading. PDFs accepted.',
      accept: 'image/*,.pdf',
    },
  };

  interface AssetDetail {
    type: 'car' | 'property' | 'company';
    // car fields
    make?: string;
    model?: string;
    year?: string;
    color?: string;
    vehicleType?: string;
    // property fields
    city?: string;
    detail?: string;
    // company fields
    name?: string;
  }

  interface StoredInsight {
    id: string;
    category: string;
    insight_label: string;   // primary label (backward compat)
    insight_emoji: string;   // primary emoji (backward compat)
    insights?: Array<{ label: string; emoji: string }>; // all insights
    aggregated?: string;     // one-line AI summary of all insights
    photo_count?: number;
    pts_awarded: number;
    verified_at: string;
    thumbnails?: string[];
    showcased?: boolean;     // whether shown on public profile
    locations?: string[];    // countries/cities detected from this proof
    assets?: AssetDetail[];  // structured asset details (cars, property, company)
    spendingBreakdown?: Array<{
      category: string;
      emoji: string;
      amountLabel: string;
      estimatedMonthly?: number;
    }>;
  }

  let category        = $state<Category>('lifestyle');
  let config          = $state<CategoryConfig>(CONFIGS.lifestyle);
  let privacyCopy     = $state('');
  let profileUrl      = $state('');
  let files           = $state<File[]>([]);
  let previews        = $state<string[]>([]);
  let step            = $state<Step>('upload');
  let result          = $state<{ insights: Array<{ label: string; emoji: string }>; pts_awarded: number; reason: string; locations?: string[]; aggregated?: string } | null>(null);
  let failReason      = $state('');
  let dragOver        = $state(false);
  let existingInsight = $state<StoredInsight | null>(null);

  // ── Live recording (intro category only) ─────────────────────────────────
  let recordMode    = $state<'audio' | 'video' | null>(null);
  let recordState   = $state<'idle' | 'recording' | 'stopping'>('idle');
  let recordTimer   = $state(0);
  let liveStream    = $state<MediaStream | null>(null);
  let mediaRecorder: MediaRecorder | null = null;
  let recordedChunks: BlobPart[] = [];
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  function attachLiveStream(node: HTMLVideoElement, stream: MediaStream | null) {
    if (stream) node.srcObject = stream;
    return {
      update(s: MediaStream | null) { node.srcObject = s; },
      destroy() { node.srcObject = null; }
    };
  }

  async function startRecording(mode: 'audio' | 'video') {
    recordState = 'recording';
    recordMode  = mode;
    recordTimer = 0;
    recordedChunks = [];
    try {
      const constraints = mode === 'audio'
        ? { audio: true }
        : { audio: true, video: { facingMode: 'user' as const, width: { ideal: 720 } } };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      liveStream = stream;

      const audioMime = ['audio/webm;codecs=opus','audio/webm','audio/ogg','audio/mp4']
        .find(t => MediaRecorder.isTypeSupported(t)) ?? '';
      const videoMime = ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4']
        .find(t => MediaRecorder.isTypeSupported(t)) ?? '';
      const mimeType  = mode === 'audio' ? audioMime : videoMime;

      mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
      mediaRecorder.onstop = () => {
        const type = mimeType || (mode === 'audio' ? 'audio/webm' : 'video/webm');
        const blob = new Blob(recordedChunks, { type });
        const file = new File([blob], `intro-${mode}-${Date.now()}.webm`, { type });
        files   = [...files, file];
        previews = [...previews, URL.createObjectURL(blob)];
        stream.getTracks().forEach(t => t.stop());
        liveStream  = null;
        recordMode  = null;
        recordState = 'idle';
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        recordTimer = 0;
      };
      mediaRecorder.start(100);
      timerInterval = setInterval(() => { recordTimer++; }, 1000);
    } catch (err) {
      console.error('[record]', err);
      liveStream  = null;
      recordMode  = null;
      recordState = 'idle';
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    }
  }

  function stopRecording() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    recordState = 'stopping';
    mediaRecorder?.stop();
  }

  function fmtTime(s: number) {
    return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  }
  let confirmDelete   = $state(false);
  let connectOpened   = $state(false); // tracks if user has clicked the OAuth connect button

  onMount(() => {
    const cat = (new URLSearchParams(window.location.search).get('category') ?? 'lifestyle') as Category;
    category    = CONFIGS[cat] ? cat : 'lifestyle';
    config      = CONFIGS[category];
    privacyCopy = PRIVACY_COPY[category] ?? PRIVACY_COPY.lifestyle;

    try {
      const all: StoredInsight[] = JSON.parse(localStorage.getItem('vv_proof_insights') ?? '[]');
      existingInsight = all.find(p => p.category === category) ?? null;
    } catch { existingInsight = null; }
  });

  async function makeThumbnail(file: File): Promise<string> {
    return new Promise(resolve => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const SIZE = 160;
        const canvas = document.createElement('canvas');
        canvas.width  = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d')!;
        const ratio = Math.max(SIZE / img.width, SIZE / img.height);
        const w = img.width  * ratio;
        const h = img.height * ratio;
        ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.55));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
      img.src = url;
    });
  }

  function deleteProof() {
    try {
      const all: StoredInsight[] = JSON.parse(localStorage.getItem('vv_proof_insights') ?? '[]');
      localStorage.setItem('vv_proof_insights', JSON.stringify(all.filter(p => p.category !== category)));
    } catch {}
    existingInsight = null;
    confirmDelete   = false;
  }

  function showcaseProof() {
    if (!existingInsight) return;
    existingInsight = { ...existingInsight, showcased: true };
    try {
      const all: StoredInsight[] = JSON.parse(localStorage.getItem('vv_proof_insights') ?? '[]');
      const idx = all.findIndex(p => p.category === category);
      if (idx >= 0) { all[idx] = existingInsight; localStorage.setItem('vv_proof_insights', JSON.stringify(all)); }
    } catch {}
  }

  function removeThumb(index: number) {
    if (!existingInsight?.thumbnails) return;
    const updated = existingInsight.thumbnails.filter((_, i) => i !== index);
    existingInsight = { ...existingInsight, thumbnails: updated };
    try {
      const all: StoredInsight[] = JSON.parse(localStorage.getItem('vv_proof_insights') ?? '[]');
      const idx = all.findIndex(p => p.category === category);
      if (idx >= 0) { all[idx] = existingInsight; localStorage.setItem('vv_proof_insights', JSON.stringify(all)); }
    } catch {}
  }

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const remaining = config.maxFiles - files.length;
    if (remaining <= 0) return;
    const toAdd = Array.from(incoming).slice(0, remaining);
    files = [...files, ...toAdd];
    toAdd.forEach(f => {
      if (f.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = e => { previews = [...previews, (e.target?.result as string) ?? '']; };
        reader.readAsDataURL(f);
      } else if (f.type.startsWith('audio/') || f.type.startsWith('video/')) {
        previews = [...previews, URL.createObjectURL(f)];
      } else {
        previews = [...previews, ''];
      }
    });
  }

  function removeFile(i: number) {
    files    = files.filter((_, idx) => idx !== i);
    previews = previews.filter((_, idx) => idx !== i);
  }

  function onDragOver(e: DragEvent) { e.preventDefault(); dragOver = true; }
  function onDragLeave() { dragOver = false; }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    addFiles(e.dataTransfer?.files ?? null);
  }

  const canSubmit = $derived(files.length > 0 || (!!config.hasUrlInput && profileUrl.trim().length > 0));

  async function analyze() {
    if (!canSubmit) return;
    step = 'analyzing';

    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      const fd = new FormData();
      fd.append('category', category);
      if (profileUrl.trim()) fd.append('profile_url', profileUrl.trim());
      files.forEach(f => fd.append('files', f));

      const resp = await fetch('/api/verified-vibe/proof-upload', {
        method: 'POST',
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: fd,
      });

      const data = await resp.json();

      if (!resp.ok || data.error) { failReason = data.error ?? 'Analysis failed'; step = 'failed'; return; }
      if (!data.verified) { failReason = data.reason ?? 'We couldn\'t verify this as genuine proof. Try uploading clearer evidence.'; step = 'failed'; return; }

      // Normalise insights — handle both old single and new array format
      const insightsArr: Array<{ label: string; emoji: string }> = Array.isArray(data.insights) && data.insights.length > 0
        ? data.insights
        : (data.insight_label ? [{ label: data.insight_label, emoji: data.insight_emoji ?? '✅' }] : [{ label: 'Proof verified', emoji: '✅' }]);

      // Generate thumbnails for image files (compressed, ~15 KB each)
      const thumbnails: string[] = [];
      for (const f of files.slice(0, 20)) {
        if (f.type.startsWith('image/')) {
          const thumb = await makeThumbnail(f);
          if (thumb) thumbnails.push(thumb);
        }
      }

      // Persist to localStorage
      const existing: StoredInsight[] = JSON.parse(localStorage.getItem('vv_proof_insights') ?? '[]');
      const filtered = existing.filter(p => p.category !== category);
      const locationsArr: string[] = Array.isArray(data.locations) ? data.locations.filter((l): l is string => typeof l === 'string' && l.trim().length > 0) : [];

      const newInsight: StoredInsight = {
        id:            crypto.randomUUID(),
        category,
        insight_label: insightsArr[0]?.label ?? 'Proof verified',
        insight_emoji: insightsArr[0]?.emoji ?? '✅',
        insights:      insightsArr,
        aggregated:    data.aggregated ?? '',
        photo_count:   data.photo_count ?? files.length,
        pts_awarded:   data.pts_awarded,
        verified_at:   new Date().toISOString(),
        thumbnails:    thumbnails.length > 0 ? thumbnails : undefined,
        locations:     locationsArr.length > 0 ? locationsArr : undefined,
        assets:            Array.isArray(data.assets)            && data.assets.length > 0            ? data.assets            : undefined,
        spendingBreakdown: Array.isArray(data.spendingBreakdown) && data.spendingBreakdown.length > 0 ? data.spendingBreakdown : undefined,
      };
      filtered.push(newInsight);
      localStorage.setItem('vv_proof_insights', JSON.stringify(filtered));
      existingInsight = newInsight;

      // Persist locations (countries traveled) to localStorage — rebuild from ALL stored insights so it stays in sync
      let mergedCountries: string[] = [];
      if (locationsArr.length > 0) {
        try {
          const existingCountries: string[] = JSON.parse(localStorage.getItem('vv_countries_traveled') ?? '[]');
          mergedCountries = Array.from(new Set([...existingCountries, ...locationsArr]));
          localStorage.setItem('vv_countries_traveled', JSON.stringify(mergedCountries));
        } catch { /* ignore */ }
      }

      // Push updated countries (and proof insights metadata) to universal master profile
      if (session?.access_token && mergedCountries.length > 0) {
        fetch('/api/verified-vibe/master-profile', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ countriesTraveled: mergedCountries }),
        }).catch(() => { /* non-critical */ });
      }

      result = { insights: insightsArr, pts_awarded: data.pts_awarded, reason: data.reason ?? '', locations: locationsArr, aggregated: data.aggregated ?? '' };
      step   = 'success';
    } catch (e) {
      console.error('proof upload failed:', e);
      failReason = 'Something went wrong. Please try again.';
      step = 'failed';
    }
  }

  function retry() {
    files      = [];
    previews   = [];
    profileUrl = '';
    step       = 'upload';
    failReason = '';
    result     = null;
  }

  function goBack() {
    goto('/verified-vibe/profile?tab=boost');
  }

  function resetForMore() {
    files    = [];
    previews = [];
    result   = null;
    step     = 'upload';
  }
</script>

<div class="page">
  <!-- Header -->
  <div class="header">
    <button class="back-btn" onclick={goBack} aria-label="Back">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>
    <div class="header-icon">{config.icon}</div>
    <div class="header-text">
      <div class="header-title">{config.title}</div>
      <div class="header-sub">{config.subtitle}</div>
    </div>
  </div>

  <!-- Privacy banner -->
  {#if privacyCopy}
    <div class="privacy-banner">
      <span class="privacy-text">{privacyCopy}</span>
    </div>
  {/if}

  <!-- ── Already uploaded ──────────────────────────────────────────────── -->
  {#if existingInsight && step === 'upload'}
    <div class="uploaded-card">
      <div class="uploaded-header">
        <span class="uploaded-emoji">
          {existingInsight.insights?.[0]?.emoji ?? existingInsight.insight_emoji}
        </span>
        <div class="uploaded-meta">
          <span class="uploaded-label">
            {existingInsight.insights && existingInsight.insights.length > 1
              ? `${existingInsight.insights.length} verified insights`
              : (existingInsight.insights?.[0]?.label ?? existingInsight.insight_label)}
          </span>
          <span class="uploaded-date">Verified {new Date(existingInsight.verified_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
        <span class="uploaded-badge">✓</span>
      </div>

      <!-- Multi-insight chips -->
      {#if existingInsight.insights && existingInsight.insights.length > 0}
        <div class="uploaded-insights">
          {#each existingInsight.insights as ins}
            <div class="uploaded-insight-chip">
              <span class="uploaded-insight-emoji">{ins.emoji}</span>
              <span class="uploaded-insight-label">{ins.label}</span>
            </div>
          {/each}
        </div>
      {/if}

      {#if existingInsight.thumbnails && existingInsight.thumbnails.length > 0}
        <div class="uploaded-thumbs">
          {#each existingInsight.thumbnails as thumb, ti}
            <div class="uploaded-thumb-wrap">
              <img class="uploaded-thumb" src={thumb} alt="Uploaded proof {ti+1}" />
              <button
                class="uploaded-thumb-remove"
                onclick={() => removeThumb(ti)}
                aria-label="Remove photo"
              >✕</button>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Aggregated AI insight -->
      {#if existingInsight.aggregated}
        <div class="aggregated-block">
          <span class="aggregated-icon">✨</span>
          <span class="aggregated-text">"{existingInsight.aggregated}"</span>
        </div>
      {/if}

      <!-- Show off / delete actions -->
      {#if confirmDelete}
        <div class="delete-confirm">
          <span class="delete-confirm-text">Remove this proof? Your score will drop.</span>
          <div class="delete-confirm-actions">
            <button class="delete-confirm-yes" onclick={deleteProof}>Yes, remove</button>
            <button class="delete-confirm-no" onclick={() => confirmDelete = false}>Keep it</button>
          </div>
        </div>
      {:else}
        {#if existingInsight.showcased}
          <div class="showcased-badge">⭐ Showing on your public profile</div>
        {:else}
          <button class="showoff-public-btn" onclick={showcaseProof}>
            🌟 Show off in public profile
          </button>
        {/if}
        <div class="uploaded-actions">
          <button class="reupload-btn" onclick={() => { existingInsight = null; }}>Upload more</button>
          <button class="delete-btn" onclick={() => confirmDelete = true}>Remove proof</button>
        </div>
      {/if}
    </div>
  {/if}

  {#if step === 'upload' && !existingInsight}
    <!-- What to upload -->
    <div class="examples-card">
      <div class="examples-label">What works</div>
      <ul class="examples-list">
        {#each config.examples as ex}
          <li class="examples-item">
            <span class="check-dot">✓</span>
            {ex}
          </li>
        {/each}
      </ul>
      <div class="hint-line">{config.hintLine}</div>
    </div>

    <!-- OAuth connect UI for LinkedIn / Instagram / Twitter -->
    {#if config.hasOAuthConnect}
      <div class="connect-card">
        <button
          class="connect-platform-btn"
          style="background:{config.connectColor ?? '#000'}"
          onclick={() => { connectOpened = true; window.open(config.connectUrl, '_blank'); }}
          type="button"
        >
          {#if category === 'linkedin'}
            <!-- LinkedIn official logo -->
            <svg class="connect-platform-svg" viewBox="0 0 24 24" fill="#ffffff" xmlns="http://www.w3.org/2000/svg">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          {:else}
            <span class="connect-platform-icon">{config.icon}</span>
          {/if}
          {config.connectLabel}
        </button>

        {#if connectOpened}
          <div class="connect-paste-area">
            <div class="connect-paste-label">
              {category === 'linkedin' ? 'Paste your LinkedIn profile URL after signing in:' : 'Paste your profile URL after signing in:'}
            </div>
            <div class="url-input-row">
              <input
                class="url-input"
                type="url"
                placeholder={config.urlPlaceholder}
                bind:value={profileUrl}
              />
              {#if profileUrl.trim()}
                <button class="url-clear" onclick={() => profileUrl = ''} aria-label="Clear URL">✕</button>
              {/if}
            </div>
            {#if profileUrl.trim()}
              <span class="connect-url-confirmed">✓ URL captured</span>
            {/if}
          </div>
        {:else}
          <p class="connect-hint">
            {category === 'linkedin'
              ? 'Tap above → sign in → copy your LinkedIn profile URL → paste it below'
              : 'Tap Connect → sign in → copy your profile URL → come back and paste it'}
          </p>
        {/if}

      </div>

    <!-- URL input only (no branded connect) -->
    {:else if config.hasUrlInput}
      <div class="url-input-card">
        <div class="url-input-label">{config.urlLabel}</div>
        <div class="url-input-row">
          <input
            class="url-input"
            type="url"
            placeholder={config.urlPlaceholder}
            bind:value={profileUrl}
          />
          {#if profileUrl.trim()}
            <button class="url-clear" onclick={() => profileUrl = ''} aria-label="Clear URL">✕</button>
          {/if}
        </div>
        <p class="url-or-divider">or upload a screenshot below</p>
      </div>
    {/if}

    <!-- Live recording UI — intro category only -->
    {#if category === 'intro'}
      <div class="intro-recorder">

        <!-- Recorded clips preview -->
        {#if files.length > 0}
          <div class="media-previews">
            {#each files as f, i}
              <div class="media-item">
                <div class="media-item-header">
                  <span class="media-type-icon">{f.type.startsWith('audio/') ? '🎙️' : '🎥'}</span>
                  <span class="media-filename">{f.type.startsWith('audio/') ? 'Voice Memo' : 'Video Clip'}</span>
                  <button class="media-remove" onclick={() => removeFile(i)} aria-label="Remove">✕</button>
                </div>
                {#if f.type.startsWith('audio/')}
                  <!-- svelte-ignore a11y_media_has_caption -->
                  <audio class="media-audio" src={previews[i]} controls></audio>
                {:else}
                  <!-- svelte-ignore a11y_media_has_caption -->
                  <video class="media-video" src={previews[i]} controls muted playsinline></video>
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        <!-- Active recording UI -->
        {#if recordState === 'recording' || recordState === 'stopping'}
          <div class="live-recording">
            {#if recordMode === 'video' && liveStream}
              <!-- svelte-ignore a11y_media_has_caption -->
              <video class="live-video-preview" use:attachLiveStream={liveStream} autoplay muted playsinline></video>
            {:else}
              <div class="live-audio-viz">
                {#each Array(12) as _, wi}
                  <div class="wave-bar" style="animation-delay:{wi*0.08}s"></div>
                {/each}
              </div>
            {/if}
            <div class="recording-bar">
              <span class="rec-pill">
                <span class="rec-dot"></span>
                REC {fmtTime(recordTimer)}
              </span>
              <button class="stop-btn" onclick={stopRecording} disabled={recordState === 'stopping'}>
                {recordState === 'stopping' ? 'Processing…' : '⏹ Stop'}
              </button>
            </div>
          </div>

        <!-- Record buttons (idle, room for more) -->
        {:else if files.length < config.maxFiles}
          <div class="record-buttons">
            <button class="record-btn" onclick={() => startRecording('audio')} type="button">
              <span class="record-btn-icon">🎙️</span>
              <span class="record-btn-label">Record Voice</span>
              <span class="record-btn-sub">30–60 sec</span>
            </button>
            <button class="record-btn" onclick={() => startRecording('video')} type="button">
              <span class="record-btn-icon">🎥</span>
              <span class="record-btn-label">Record Video</span>
              <span class="record-btn-sub">30–60 sec</span>
            </button>
          </div>
        {/if}

      </div>

    <!-- Upload area — all other categories except OAuth-connect ones -->
    {:else if !config.hasOAuthConnect}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="drop-zone"
      class:drop-zone--over={dragOver}
      class:drop-zone--has-files={files.length > 0}
      ondragover={onDragOver}
      ondragleave={onDragLeave}
      ondrop={onDrop}
    >
      {#if files.length === 0}
        <div class="drop-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M8 12h8M12 8v8"/>
            </svg>
            <p class="drop-hint">{config.hasUrlInput ? 'Or upload a screenshot' : 'Tap to select photos'}</p>
            <p class="drop-hint-sub">Up to {config.maxFiles} {config.maxFiles === 1 ? 'file' : 'files'} · JPEG / PNG{(category === 'linkedin' || category === 'assets' || category === 'wealth') ? ' / PDF' : ''}</p>
            <label class="pick-btn">
              Choose Photos
              <input type="file" accept={config.accept} multiple={config.maxFiles > 1} onchange={e => addFiles(e.currentTarget.files)} hidden />
            </label>
        </div>
      {:else}
        <div class="preview-grid">
            {#each previews as src, i}
              <div class="preview-item">
                {#if src}
                  <img class="preview-img" {src} alt="Proof {i+1}" />
                {:else}
                  <div class="preview-doc">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span class="preview-fname">{files[i]?.name?.slice(0,14) ?? 'File'}</span>
                  </div>
                {/if}
                <button class="preview-remove" onclick={() => removeFile(i)} aria-label="Remove">✕</button>
              </div>
            {/each}
            {#if files.length < config.maxFiles}
              <label class="preview-add">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M8 12h8M12 8v8"/>
                </svg>
                <input type="file" accept={config.accept} multiple={config.maxFiles > 1} onchange={e => addFiles(e.currentTarget.files)} hidden />
              </label>
            {/if}
          </div>
      {/if}
    </div>
    {/if}<!-- end intro/else -->

    <button
      class="analyze-btn"
      class:analyze-btn--disabled={!canSubmit}
      disabled={!canSubmit}
      onclick={analyze}
    >
      {#if category === 'intro'}
        Submit Intro
      {:else if config.hasUrlInput && profileUrl.trim() && files.length === 0}
        Connect & Verify
      {:else}
        Analyse & Verify
      {/if}
    </button>

  {:else if step === 'analyzing'}
    <div class="state-card state-card--analyzing">
      <div class="spinner"></div>
      <div class="state-title">{category === 'intro' ? 'Submitting your intro…' : 'Reviewing your proof…'}</div>
      <div class="state-sub">{category === 'intro' ? 'Confirming your upload. Just a moment.' : 'Claude is analysing your files. Usually 5–10 seconds.'}</div>
    </div>

  {:else if step === 'success' && result}
    <div class="state-card state-card--success">
      <div class="success-emoji">{result.insights[0]?.emoji ?? '✅'}</div>
      <div class="success-badge">Verified ✓</div>
      <div class="success-pts">+{result.pts_awarded} pts added to your profile</div>
    </div>

    <!-- Uploaded images kept for review -->
    {#if previews.some(p => p)}
      <div class="success-review">
        <div class="success-review-label">Your uploaded proof</div>
        <div class="success-review-grid">
          {#each previews as src, i}
            {#if src && files[i]?.type?.startsWith('image/')}
              <img class="success-review-img" {src} alt="Proof {i+1}" />
            {:else if src}
              <div class="success-review-media">
                <span>{files[i]?.type?.startsWith('audio/') ? '🎙️' : '🎥'}</span>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}

    <div class="wingman-block">
      <div class="wingman-header">
        <span class="wingman-icon">🤖</span>
        <span class="wingman-title">AI Wingman has detected this…</span>
      </div>
      {#if result.reason}
        <p class="wingman-reason">{result.reason}</p>
      {/if}
      <div class="wingman-chips">
        {#each result.insights as ins}
          <div class="wingman-chip">
            <span class="wingman-chip-emoji">{ins.emoji}</span>
            <span class="wingman-chip-text">{ins.label}</span>
          </div>
        {/each}
      </div>
    </div>

    {#if result.locations && result.locations.length > 0}
      <div class="locations-block">
        <div class="locations-header">
          <span class="locations-icon">📍</span>
          <span class="locations-title">Added to Countries Traveled</span>
        </div>
        <div class="locations-chips">
          {#each result.locations as loc}
            <span class="location-chip">{loc}</span>
          {/each}
        </div>
      </div>
    {/if}

    <div class="insight-preview">
      <div class="insight-preview-label">These will show on your Trust & Boost tab:</div>
      <div class="insight-chips">
        {#each result.insights as ins}
          <div class="insight-chip">
            <span class="insight-chip-emoji">{ins.emoji}</span>
            <span class="insight-chip-text">{ins.label}</span>
            <span class="insight-chip-verified">✓ Verified</span>
          </div>
        {/each}
      </div>
    </div>

    <div class="success-actions">
      <button class="upload-more-btn" onclick={resetForMore}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14M5 12l7-7 7 7"/>
        </svg>
        Upload More
      </button>
      <button class="done-btn" onclick={goBack}>
        Back to profile
      </button>
    </div>

  {:else if step === 'failed'}
    <div class="state-card state-card--failed">
      <div class="failed-icon">⚠️</div>
      <div class="state-title">Couldn't verify</div>
      <div class="state-sub">{failReason}</div>
    </div>

    <div class="examples-card examples-card--retry">
      <div class="examples-label">Tips for better proof</div>
      <ul class="examples-list">
        {#each config.examples as ex}
          <li class="examples-item">
            <span class="check-dot">✓</span>
            {ex}
          </li>
        {/each}
      </ul>
    </div>

    <button class="analyze-btn" onclick={retry}>
      Try Again
    </button>
  {/if}
</div>

<style>
  .page {
    padding: 16px 16px 48px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 100%;
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 4px;
  }

  .back-btn {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 50%;
    cursor: pointer;
    color: var(--text-1);
    flex-shrink: 0;
  }

  .header-icon {
    font-size: 28px;
    flex-shrink: 0;
  }

  .header-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .header-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.01em;
  }

  .header-sub {
    font-size: 12px;
    color: var(--text-3);
  }

  /* ── Privacy banner ── */
  .privacy-banner {
    padding: 10px 13px;
    background: rgba(99, 102, 241, 0.09);
    border: 1px solid rgba(99, 102, 241, 0.22);
    border-radius: 12px;
  }

  .privacy-text {
    font-size: 12px;
    color: #a5b4fc;
    line-height: 1.5;
    font-weight: 500;
  }

  /* ── URL input card ── */
  .url-input-card {
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 16px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .url-input-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-3);
  }

  .url-input-row {
    display: flex;
    align-items: center;
    background: var(--bg-3);
    border: 1px solid var(--border-1);
    border-radius: 10px;
    padding: 0 12px;
    transition: border-color 150ms;
  }

  .url-input-row:focus-within {
    border-color: var(--accent);
  }

  .url-input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-1);
    font-family: inherit;
    font-size: 14px;
    padding: 11px 0;
    outline: none;
  }

  .url-input::placeholder { color: var(--text-4); }

  .url-clear {
    background: none;
    border: none;
    color: var(--text-3);
    font-size: 14px;
    cursor: pointer;
    padding: 4px;
    flex-shrink: 0;
    line-height: 1;
  }

  .url-or-divider {
    font-size: 11px;
    color: var(--text-4);
    text-align: center;
    margin: 2px 0 0;
  }

  /* ── OAuth connect card ── */
  .connect-card {
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 16px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .connect-platform-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 14px;
    border: none;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 700;
    color: #fff;
    cursor: pointer;
    font-family: inherit;
    letter-spacing: -0.01em;
    transition: opacity 150ms;
  }

  .connect-platform-btn:hover { opacity: 0.88; }
  .connect-platform-btn:active { opacity: 0.75; }

  .connect-platform-icon { font-size: 20px; }
  .connect-platform-svg  { width: 20px; height: 20px; flex-shrink: 0; }

  .connect-hint {
    font-size: 12px;
    color: var(--text-3);
    text-align: center;
    line-height: 1.5;
    margin: 0;
  }

  .connect-paste-area {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .connect-paste-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-2);
  }

  .connect-url-confirmed {
    font-size: 12px;
    font-weight: 700;
    color: var(--accent);
  }

  .connect-divider {
    font-size: 11px;
    color: var(--text-4);
    text-align: center;
    padding-top: 4px;
    border-top: 1px solid var(--border-1);
  }

  /* ── Already uploaded card ── */
  .uploaded-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    background: var(--bg-2);
    border: 1px solid var(--accent);
    border-radius: 16px;
  }

  .uploaded-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .uploaded-emoji {
    font-size: 24px;
    flex-shrink: 0;
  }

  .uploaded-meta {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .uploaded-label {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.01em;
  }

  .uploaded-date {
    font-size: 11px;
    color: var(--text-4);
  }

  .uploaded-badge {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--accent);
    color: #000;
    font-size: 12px;
    font-weight: 700;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  /* Multi-insight chips in uploaded card */
  .uploaded-insights {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .uploaded-insight-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    background: var(--accent-tint);
    border: 1px solid rgba(52, 211, 153, 0.18);
    border-radius: 8px;
  }

  .uploaded-insight-emoji { font-size: 16px; flex-shrink: 0; }
  .uploaded-insight-label { font-size: 13px; font-weight: 600; color: var(--text-1); }

  .uploaded-thumbs {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .uploaded-thumb-wrap {
    position: relative;
    width: 72px;
    height: 72px;
    flex-shrink: 0;
  }

  .uploaded-thumb {
    width: 72px;
    height: 72px;
    object-fit: cover;
    border-radius: 9px;
    border: 1px solid var(--border-1);
    display: block;
  }

  .uploaded-thumb-remove {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #ef4444;
    color: #fff;
    border: none;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    display: grid;
    place-items: center;
    line-height: 1;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  }

  .uploaded-actions {
    display: flex;
    gap: 8px;
  }

  /* ── Aggregated AI insight ── */
  .aggregated-block {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 12px 14px;
    background: rgba(99, 102, 241, 0.08);
    border: 1px solid rgba(99, 102, 241, 0.22);
    border-radius: 12px;
  }

  .aggregated-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }

  .aggregated-text {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
    line-height: 1.5;
    font-style: italic;
  }

  /* ── Show off public button ── */
  .showoff-public-btn {
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
    border: none;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 700;
    color: #fff;
    cursor: pointer;
    font-family: inherit;
    letter-spacing: -0.01em;
    transition: opacity 150ms;
  }

  .showoff-public-btn:hover { opacity: 0.88; }
  .showoff-public-btn:active { opacity: 0.75; }

  .showcased-badge {
    width: 100%;
    padding: 12px 14px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 12px;
    font-size: 13px;
    font-weight: 700;
    color: #fcd34d;
    text-align: center;
  }

  .reupload-btn {
    flex: 1;
    padding: 9px;
    background: var(--bg-3);
    border: 1px solid var(--border-1);
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-2);
    cursor: pointer;
    font-family: inherit;
    transition: background 150ms;
  }

  .delete-btn {
    flex: 1;
    padding: 9px;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    color: #f87171;
    cursor: pointer;
    font-family: inherit;
    transition: background 150ms;
  }

  .delete-confirm {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 10px;
  }

  .delete-confirm-text {
    font-size: 12px;
    color: #fca5a5;
    text-align: center;
  }

  .delete-confirm-actions {
    display: flex;
    gap: 8px;
  }

  .delete-confirm-yes {
    flex: 1;
    padding: 8px;
    background: #ef4444;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    cursor: pointer;
    font-family: inherit;
  }

  .delete-confirm-no {
    flex: 1;
    padding: 8px;
    background: var(--bg-3);
    border: 1px solid var(--border-1);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-2);
    cursor: pointer;
    font-family: inherit;
  }

  /* ── Auth note ── */
  .auth-note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 9px 11px;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.22);
    border-radius: 9px;
    font-size: 12px;
    color: #fcd34d;
    line-height: 1.5;
  }

  .auth-note-icon {
    flex-shrink: 0;
    font-size: 13px;
    margin-top: 1px;
  }

  /* ── Examples card ── */
  .examples-card {
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 16px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .examples-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .examples-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .examples-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    color: var(--text-2);
    line-height: 1.4;
  }

  .check-dot {
    color: var(--accent);
    font-weight: 700;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .hint-line {
    font-size: 12px;
    color: var(--accent);
    font-style: italic;
  }

  /* ── Drop zone ── */
  .drop-zone {
    background: var(--bg-2);
    border: 2px dashed var(--border-1);
    border-radius: 20px;
    transition: border-color 180ms, background 180ms;
    overflow: hidden;
  }

  .drop-zone--over {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 6%, var(--bg-2));
  }

  .drop-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 32px 20px;
  }

  .drop-hint {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-2);
    margin: 0;
  }

  .drop-hint-sub {
    font-size: 12px;
    color: var(--text-4);
    margin: 0;
  }

  .pick-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 8px;
    padding: 10px 24px;
    background: var(--accent-tint);
    border: 1px solid rgba(52, 211, 153, 0.3);
    border-radius: 100px;
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
    cursor: pointer;
    font-family: inherit;
  }

  /* ── Preview grid ── */
  .preview-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    padding: 12px;
  }

  .preview-item {
    position: relative;
    aspect-ratio: 1;
    border-radius: 10px;
    overflow: hidden;
    background: var(--bg-3);
  }

  .preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .preview-doc {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: var(--text-3);
  }

  .preview-fname {
    font-size: 10px;
    color: var(--text-3);
    text-align: center;
    word-break: break-all;
  }

  .preview-remove {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(0,0,0,0.6);
    color: #fff;
    border: none;
    font-size: 10px;
    cursor: pointer;
    display: grid;
    place-items: center;
    line-height: 1;
  }

  .preview-add {
    aspect-ratio: 1;
    border-radius: 10px;
    border: 2px dashed var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-3);
    transition: border-color 150ms, color 150ms;
  }

  .preview-add:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* ── Buttons ── */
  .analyze-btn {
    width: 100%;
    padding: 16px;
    background: var(--accent);
    border: none;
    border-radius: 16px;
    font-size: 15px;
    font-weight: 700;
    color: #000;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 150ms;
  }

  .analyze-btn--disabled {
    opacity: 0.35;
    cursor: default;
  }

  .success-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  .upload-more-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 14px;
    background: rgba(99, 232, 175, 0.1);
    border: 1.5px solid rgba(99, 232, 175, 0.35);
    border-radius: 16px;
    font-size: 15px;
    font-weight: 600;
    color: #63e8af;
    cursor: pointer;
    font-family: inherit;
    transition: background 150ms, border-color 150ms;
  }
  .upload-more-btn:hover { background: rgba(99, 232, 175, 0.18); border-color: rgba(99, 232, 175, 0.55); }

  .done-btn {
    width: 100%;
    padding: 16px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 16px;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-1);
    cursor: pointer;
    font-family: inherit;
  }

  /* ── States ── */
  .state-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 36px 20px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 20px;
    text-align: center;
  }

  .state-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--text-1);
  }

  .state-sub {
    font-size: 13px;
    color: var(--text-3);
    line-height: 1.5;
    max-width: 280px;
  }

  /* Analyzing */
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--bg-3);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* Success */
  .state-card--success {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 6%, var(--bg-2));
  }

  .success-emoji {
    font-size: 48px;
    line-height: 1;
  }

  .success-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px;
    background: var(--accent);
    border-radius: 100px;
    font-size: 12px;
    font-weight: 700;
    color: #000;
  }

  .success-pts {
    font-size: 14px;
    font-weight: 600;
    color: var(--accent);
  }

  .success-reason {
    font-size: 12px;
    color: var(--text-3);
    font-style: italic;
    max-width: 260px;
    line-height: 1.4;
  }

  /* Failed */
  .state-card--failed {
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.06);
  }

  .failed-icon { font-size: 40px; }

  .examples-card--retry {
    border-color: rgba(245, 158, 11, 0.3);
    background: rgba(245, 158, 11, 0.05);
  }

  /* ── Success uploaded proof review ── */
  .success-review {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .success-review-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-3);
  }

  .success-review-grid {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .success-review-img {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border-radius: 10px;
    border: 1px solid var(--border-1);
  }

  .success-review-media {
    width: 80px;
    height: 80px;
    border-radius: 10px;
    border: 1px solid var(--border-1);
    background: var(--bg-3);
    display: grid;
    place-items: center;
    font-size: 28px;
  }

  /* ── Locations extracted block ── */
  .locations-block {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px;
    background: rgba(16, 185, 129, 0.06);
    border: 1px solid rgba(16, 185, 129, 0.22);
    border-radius: 14px;
  }

  .locations-header {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .locations-icon { font-size: 16px; }

  .locations-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
  }

  .locations-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .location-chip {
    padding: 5px 12px;
    background: var(--accent-tint);
    border: 1px solid rgba(52, 211, 153, 0.3);
    border-radius: 100px;
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
  }

  /* ── AI Wingman block ── */
  .wingman-block {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: rgba(99, 102, 241, 0.07);
    border: 1px solid rgba(99, 102, 241, 0.25);
    border-radius: 16px;
  }

  .wingman-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .wingman-icon { font-size: 18px; }

  .wingman-title {
    font-size: 13px;
    font-weight: 700;
    color: #a5b4fc;
    letter-spacing: -0.01em;
  }

  .wingman-reason {
    margin: 0;
    font-size: 13px;
    color: var(--text-2);
    line-height: 1.55;
    font-style: italic;
  }

  .wingman-chips {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .wingman-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 10px;
  }

  .wingman-chip-emoji { font-size: 16px; line-height: 1; }

  .wingman-chip-text {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
    flex: 1;
  }

  /* ── Insight preview chips ── */
  .insight-preview {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 16px;
  }

  .insight-preview-label {
    font-size: 11px;
    color: var(--text-3);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .insight-chips {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .insight-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    background: var(--accent-tint);
    border: 1px solid rgba(52, 211, 153, 0.25);
    border-radius: 12px;
  }

  .insight-chip-emoji { font-size: 18px; line-height: 1; }

  .insight-chip-text {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
  }

  .insight-chip-verified {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
    flex-shrink: 0;
  }

  /* ── Intro category — media previews ── */
  .media-previews {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
  }

  .media-item {
    background: var(--bg-3);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .media-item-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px 8px;
  }

  .media-type-icon { font-size: 18px; flex-shrink: 0; }

  .media-filename {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-2);
  }

  .media-remove {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(0,0,0,0.4);
    color: var(--text-3);
    border: none;
    font-size: 11px;
    cursor: pointer;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .media-audio {
    width: 100%;
    height: 40px;
    padding: 0 10px 10px;
    display: block;
    accent-color: var(--accent);
  }

  .media-video {
    width: 100%;
    max-height: 200px;
    object-fit: cover;
    display: block;
    background: #000;
  }


  /* ── Live recorder ── */
  .intro-recorder {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 4px 0;
  }

  .record-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .record-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 22px 12px;
    border-radius: 14px;
    border: 1.5px solid var(--border-2);
    background: var(--bg-2);
    cursor: pointer;
    transition: border-color 150ms, background 150ms;
    font-family: inherit;
  }

  .record-btn:hover:not(:disabled) {
    border-color: var(--accent-bright);
    background: var(--accent-tint);
  }

  .record-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .record-btn-icon { font-size: 28px; line-height: 1; }

  .record-btn-label {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-1);
  }

  .record-btn-sub {
    font-size: 11px;
    color: var(--text-4);
  }

  /* Live recording state */
  .live-recording {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 16px;
    border-radius: 14px;
    border: 1.5px solid rgba(239,68,68,0.4);
    background: rgba(239,68,68,0.06);
  }

  .live-video-preview {
    width: 100%;
    max-height: 240px;
    border-radius: 10px;
    object-fit: cover;
    background: #000;
  }

  .live-audio-viz {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    height: 48px;
    padding: 4px 8px;
  }

  .wave-bar {
    width: 5px;
    border-radius: 3px;
    background: var(--accent-bright);
    animation: wavePulse 0.8s ease-in-out infinite alternate;
    min-height: 6px;
  }

  @keyframes wavePulse {
    0%   { height: 8px;  opacity: 0.5; }
    100% { height: 40px; opacity: 1; }
  }

  .recording-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 12px;
  }

  .rec-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    color: #ef4444;
    font-variant-numeric: tabular-nums;
  }

  .rec-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ef4444;
    animation: blink 1s step-start infinite;
    flex-shrink: 0;
  }

  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

  .stop-btn {
    padding: 9px 18px;
    border-radius: 999px;
    background: #ef4444;
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    border: none;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 150ms;
    white-space: nowrap;
  }

  .stop-btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
