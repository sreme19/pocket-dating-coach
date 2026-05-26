<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getSupabaseClient } from '$lib/client/supabase';

  type Category = 'lifestyle' | 'hosting' | 'discipline' | 'social_proof' | 'linkedin' | 'instagram' | 'twitter' | 'habit_tracker' | 'intro' | 'spending';
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
        'Paste your Instagram URL below for instant verification',
        'Or screenshot your profile showing username, posts, and followers',
        'Shows you are active and genuine online',
        'Your personal posts stay private — we only check the profile page',
      ],
      maxFiles: 1,
      hintLine: 'Profile URL is the quickest way. Screenshot also works.',
      accept: 'image/*',
      hasUrlInput: true,
      urlLabel: 'Instagram URL',
      urlPlaceholder: 'instagram.com/yourhandle',
    },
    twitter: {
      icon: '🐦',
      title: 'Twitter / X',
      subtitle: 'Connect your Twitter to show real interests',
      examples: [
        'Paste your Twitter / X URL below for instant verification',
        'Or screenshot your profile showing your bio and activity',
        'Shows genuine engagement with topics you care about',
        'Your DMs and private tweets stay completely private',
      ],
      maxFiles: 1,
      hintLine: 'Profile URL is the quickest way. Screenshot also works.',
      accept: 'image/*',
      hasUrlInput: true,
      urlLabel: 'Twitter / X URL',
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
  };

  interface StoredInsight {
    id: string;
    category: string;
    insight_label: string;   // primary label (backward compat)
    insight_emoji: string;   // primary emoji (backward compat)
    insights?: Array<{ label: string; emoji: string }>; // all insights
    photo_count?: number;
    pts_awarded: number;
    verified_at: string;
    thumbnails?: string[];
  }

  let category        = $state<Category>('lifestyle');
  let config          = $state<CategoryConfig>(CONFIGS.lifestyle);
  let privacyCopy     = $state('');
  let profileUrl      = $state('');
  let files           = $state<File[]>([]);
  let previews        = $state<string[]>([]);
  let step            = $state<Step>('upload');
  let result          = $state<{ insights: Array<{ label: string; emoji: string }>; pts_awarded: number; reason: string } | null>(null);
  let failReason      = $state('');
  let dragOver        = $state(false);
  let existingInsight = $state<StoredInsight | null>(null);
  let confirmDelete   = $state(false);

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
      const newInsight: StoredInsight = {
        id:            crypto.randomUUID(),
        category,
        insight_label: insightsArr[0]?.label ?? 'Proof verified',
        insight_emoji: insightsArr[0]?.emoji ?? '✅',
        insights:      insightsArr,
        photo_count:   data.photo_count ?? files.length,
        pts_awarded:   data.pts_awarded,
        verified_at:   new Date().toISOString(),
        thumbnails:    thumbnails.length > 0 ? thumbnails : undefined,
      };
      filtered.push(newInsight);
      localStorage.setItem('vv_proof_insights', JSON.stringify(filtered));
      existingInsight = newInsight;

      result = { insights: insightsArr, pts_awarded: data.pts_awarded, reason: data.reason ?? '' };
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
    goto('/verified-vibe/profile');
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
          {#each existingInsight.thumbnails as thumb}
            <img class="uploaded-thumb" src={thumb} alt="Uploaded proof" />
          {/each}
        </div>
      {/if}

      {#if confirmDelete}
        <div class="delete-confirm">
          <span class="delete-confirm-text">Remove this proof? Your score will drop.</span>
          <div class="delete-confirm-actions">
            <button class="delete-confirm-yes" onclick={deleteProof}>Yes, remove</button>
            <button class="delete-confirm-no" onclick={() => confirmDelete = false}>Keep it</button>
          </div>
        </div>
      {:else}
        <div class="uploaded-actions">
          <button class="reupload-btn" onclick={() => { existingInsight = null; }}>Re-upload</button>
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
      {#if category !== 'intro'}
        <div class="auth-note">
          <span class="auth-note-icon">👤</span>
          <span>Your face should be clearly visible in at least one photo, or your name should appear on any document, so we can authenticate the proof.</span>
        </div>
      {/if}
    </div>

    <!-- URL input for social / professional categories -->
    {#if config.hasUrlInput}
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

    <!-- Upload area -->
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
          {#if category === 'intro'}
            <div class="intro-icons">🎙️<span class="intro-plus">+</span>🎥</div>
            <p class="drop-hint">Tap to add voice or video</p>
            <p class="drop-hint-sub">Up to {config.maxFiles} files · MP3, M4A, MP4, MOV</p>
            <label class="pick-btn">
              Choose Files
              <input type="file" accept="audio/*,video/*" multiple={config.maxFiles > 1} onchange={e => addFiles(e.currentTarget.files)} hidden />
            </label>
          {:else}
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M8 12h8M12 8v8"/>
            </svg>
            <p class="drop-hint">{config.hasUrlInput ? 'Or upload a screenshot' : 'Tap to select photos'}</p>
            <p class="drop-hint-sub">Up to {config.maxFiles} {config.maxFiles === 1 ? 'file' : 'files'} · JPEG / PNG{category === 'linkedin' ? ' / PDF' : ''}</p>
            <label class="pick-btn">
              Choose Photos
              <input type="file" accept={config.accept} multiple={config.maxFiles > 1} onchange={e => addFiles(e.currentTarget.files)} hidden />
            </label>
          {/if}
        </div>
      {:else}
        <!-- Preview grid / media player -->
        {#if category === 'intro'}
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
                {:else if f.type.startsWith('video/')}
                  <!-- svelte-ignore a11y_media_has_caption -->
                  <video class="media-video" src={previews[i]} controls muted playsinline></video>
                {/if}
              </div>
            {/each}
            {#if files.length < config.maxFiles}
              <label class="media-add-btn">
                <span>{files.some(f => f.type.startsWith('audio/')) ? '+ Add Video' : '+ Add Voice Memo'}</span>
                <input type="file" accept="audio/*,video/*" onchange={e => addFiles(e.currentTarget.files)} hidden />
              </label>
            {/if}
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
      {/if}
    </div>

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
      {#if result.reason}
        <div class="success-reason">{result.reason}</div>
      {/if}
    </div>

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

    <button class="done-btn" onclick={goBack}>
      Back to profile
    </button>

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

  .uploaded-thumb {
    width: 72px;
    height: 72px;
    object-fit: cover;
    border-radius: 9px;
    border: 1px solid var(--border-1);
  }

  .uploaded-actions {
    display: flex;
    gap: 8px;
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

  /* ── Intro category — media upload ── */
  .intro-icons {
    font-size: 36px;
    display: flex;
    align-items: center;
    gap: 4px;
    line-height: 1;
  }

  .intro-plus {
    font-size: 20px;
    color: var(--text-4);
    font-style: normal;
  }

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

  .media-add-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    border: 2px dashed var(--border-1);
    border-radius: 12px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
    transition: border-color 150ms;
  }

  .media-add-btn:hover { border-color: var(--accent); }
</style>
