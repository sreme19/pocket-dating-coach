<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { fly, fade } from 'svelte/transition';
  import { user } from '$lib/verified-vibe/stores';
  import BestieAvatar from '$lib/components/BestieAvatar.svelte';

  // ── Types ──────────────────────────────────────────────────────────────────
  interface Persona {
    name: string;
    age: number;
    gender: 'woman' | 'non-binary' | 'man';
  }

  interface ProbeTopic {
    category: string;
    emoji: string;
    heading: string;
    color: 'green' | 'red' | 'amber' | 'purple' | 'blue';
    items: string[];
  }

  const PERSONA_KEY = 'ai_bestie_persona';

  const BESTIE_NAMES = [
    'Priya', 'Aisha', 'Maya', 'Zara', 'Nadia', 'Sofia', 'Leila', 'Aria',
    'Piya', 'Riya', 'Tara', 'Diya', 'Mia', 'Isha', 'Noor', 'Ananya',
  ];

  function randomBestieName(): string {
    return BESTIE_NAMES[Math.floor(Math.random() * BESTIE_NAMES.length)];
  }

  const DEFAULTS: Persona = { name: randomBestieName(), age: 25, gender: 'woman' };

  // ── State ──────────────────────────────────────────────────────────────────
  let interviewTopics = $state<string[]>([]);
  let probeTopics = $state<ProbeTopic[]>([]);

  let topicsLoading = $state(true);
  let customPrompt = $state('');
  let submitting = $state(false);
  let submitError = $state<string | null>(null);
  let newProbeAdded = $state<string | null>(null);   // shown as new bullet
  let insightsAdded = $state<string[]>([]);
  let deletingKey = $state<string | null>(null); // "category::item" being deleted

  // Persona
  let persona = $state<Persona>({ ...DEFAULTS });
  let personaSaving = $state(false);
  let personaSaved = $state(false);
  let ageError = $state<string | null>(null);

  // ── Auth ───────────────────────────────────────────────────────────────────
  onMount(async () => {
    user.hydrate();

    // Load saved persona — or seed a random name on first visit and persist it
    const raw = localStorage.getItem(PERSONA_KEY);
    if (raw) {
      try { persona = { ...DEFAULTS, ...JSON.parse(raw) }; } catch { /* keep defaults */ }
    } else {
      // First visit: DEFAULTS already has a random name — save it so it stays stable
      localStorage.setItem(PERSONA_KEY, JSON.stringify(persona));
    }

    await loadTopics();
  });

  // ── Data ───────────────────────────────────────────────────────────────────
  async function loadTopics() {
    topicsLoading = true;
    const uid = $user?.id ?? '';
    if (!uid) { topicsLoading = false; return; }

    try {
      const res = await fetch(`/api/ai-bestie/configure?userId=${encodeURIComponent(uid)}`);
      if (res.ok) {
        const data = await res.json();
        interviewTopics = data.interviewTopics ?? [];
        probeTopics = data.probeTopics ?? [];
      }
    } catch {
      // non-fatal
    } finally {
      topicsLoading = false;
    }
  }

  // ── Submit new instructions ────────────────────────────────────────────────
  async function handleSubmit() {
    if (!customPrompt.trim() || submitting) return;
    const uid = $user?.id ?? '';
    if (!uid) { submitError = 'Not logged in. Please reload.'; return; }

    submitting = true;
    submitError = null;
    newProbeAdded = null;
    insightsAdded = [];

    try {
      const res = await fetch('/api/ai-bestie/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, customPrompt: customPrompt.trim() })
      });

      if (!res.ok) throw new Error('Request failed');

      const data = await res.json();
      interviewTopics = data.interviewTopics ?? interviewTopics;
      probeTopics = data.probeTopics ?? probeTopics;
      insightsAdded = data.insightsAdded ?? [];
      newProbeAdded = data.newProbe ?? customPrompt.trim().slice(0, 60);
      customPrompt = '';

      // Refresh the full preferences pills silently
      loadTopics();
    } catch {
      submitError = 'Something went wrong. Please try again.';
    } finally {
      submitting = false;
    }
  }

  // ── Persona ────────────────────────────────────────────────────────────────
  function validateAge(val: number): string | null {
    if (!val || isNaN(val)) return 'Age is required';
    if (val < 18) return 'Must be 18 or older';
    if (val > 99) return 'Enter a valid age';
    return null;
  }

  function savePersona() {
    ageError = validateAge(persona.age);
    if (ageError) return;

    personaSaving = true;
    localStorage.setItem(PERSONA_KEY, JSON.stringify(persona));
    setTimeout(() => {
      personaSaving = false;
      personaSaved = true;
      setTimeout(() => { personaSaved = false; }, 2500);
    }, 300);
  }

  // ── Delete probe item ──────────────────────────────────────────────────────
  async function deleteProbeItem(category: string, item: string) {
    const uid = $user?.id ?? '';
    if (!uid || deletingKey) return;
    const key = `${category}::${item}`;
    deletingKey = key;

    try {
      const res = await fetch('/api/ai-bestie/configure', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, category, item })
      });
      if (!res.ok) throw new Error('Delete failed');
      const data = await res.json();
      probeTopics = data.probeTopics ?? probeTopics;
      interviewTopics = data.interviewTopics ?? interviewTopics;
      // Refresh preferences pills too
      loadTopics();
    } catch {
      // non-fatal — item will reappear on next load
    } finally {
      deletingKey = null;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
  }

</script>

<div class="configure-screen">
  <!-- Header -->
  <div class="cfg-header">
    <button class="back-btn" onclick={() => goto('/verified-vibe/chat/ai-bestie')} aria-label="Back">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>
    <div class="cfg-title-area">
      <BestieAvatar size={36} />
      <div>
        <div class="cfg-title">Configure AI Bestie</div>
        <div class="cfg-subtitle">Tell her exactly what to screen for</div>
      </div>
    </div>
  </div>

  <div class="cfg-body">

    <!-- ── Persona section ─────────────────────────────────────────────── -->
    <section class="cfg-section persona-section">
      <div class="cfg-section-label">AI Bestie's identity</div>
      <p class="cfg-hint">Personalise how Bestie introduces herself to your matches.</p>

      <div class="persona-fields">
        <!-- Name -->
        <div class="persona-field">
          <label class="field-label" for="bestie-name">Name</label>
          <input
            id="bestie-name"
            class="field-input"
            type="text"
            maxlength="20"
            placeholder="Bestie"
            bind:value={persona.name}
          />
        </div>

        <!-- Age -->
        <div class="persona-field">
          <label class="field-label" for="bestie-age">Age <span class="field-note">(18+)</span></label>
          <input
            id="bestie-age"
            class="field-input {ageError ? 'field-error' : ''}"
            type="number"
            min="18"
            max="99"
            placeholder="25"
            bind:value={persona.age}
            oninput={() => { ageError = null; }}
          />
          {#if ageError}
            <span class="age-error">{ageError}</span>
          {/if}
        </div>

        <!-- Gender / voice -->
        <div class="persona-field persona-field-wide">
          <label class="field-label" for="bestie-gender">Voice / persona</label>
          <select id="bestie-gender" class="field-select" bind:value={persona.gender}>
            <option value="woman">Female bestie (default)</option>
            <option value="non-binary">Neutral advisor</option>
            <option value="man">Male wingman tone</option>
          </select>
        </div>
      </div>

      <button
        class="persona-save-btn"
        onclick={savePersona}
        disabled={personaSaving}
      >
        {#if personaSaving}
          <span class="btn-spinner-sm"></span>
          Saving…
        {:else if personaSaved}
          ✓ Saved
        {:else}
          Save identity
        {/if}
      </button>
    </section>

    <!-- ── What Bestie currently probes ───────────────────────────────── -->
    <section class="cfg-section">
      <div class="cfg-section-label">What AI Bestie currently probes</div>

      {#if topicsLoading}
        <div class="loading-row">
          <span class="dot-pulse"></span>
          Loading focus areas…
        </div>
      {:else if probeTopics.length === 0 && !newProbeAdded}
        <p class="empty-hint">No focus areas set yet. Use the box below to tell Bestie what to look for.</p>
      {:else}
        <div class="probe-groups">
          {#each probeTopics as group (group.category)}
            <div class="probe-group probe-group-{group.color}" transition:fade={{ duration: 150 }}>
              <div class="probe-group-header">
                <span class="probe-emoji">{group.emoji}</span>
                <span class="probe-heading probe-heading-{group.color}">{group.heading}</span>
              </div>
              <ul class="probe-items">
                {#each group.items as item (item)}
                  {@const deleteKey = `${group.category}::${item}`}
                  <li class="probe-item" transition:fade={{ duration: 120 }}>
                    <span class="probe-bullet probe-bullet-{group.color}"></span>
                    <span class="probe-item-text">{item}</span>
                    <button
                      class="probe-delete-btn"
                      onclick={() => deleteProbeItem(group.category, item)}
                      disabled={deletingKey === deleteKey}
                      aria-label="Remove this item"
                      title="Remove"
                    >
                      {#if deletingKey === deleteKey}
                        <span class="delete-spinner"></span>
                      {:else}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      {/if}
                    </button>
                  </li>
                {/each}
              </ul>
            </div>
          {/each}

          <!-- Newly added probe label — shown immediately after submit -->
          {#if newProbeAdded}
            <div class="probe-new-badge" transition:fly={{ y: 6, duration: 250 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              Added: {newProbeAdded}
            </div>
          {/if}
        </div>

        {#if insightsAdded.length > 0}
          <div class="insights-saved" transition:fade={{ duration: 200 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            {insightsAdded.length} preference{insightsAdded.length > 1 ? 's' : ''} saved to your profile
          </div>
        {/if}
      {/if}
    </section>


    <!-- ── Add new instructions ───────────────────────────────────────── -->
    <section class="cfg-section">
      <div class="cfg-section-label">Add new instructions</div>
      <p class="cfg-hint">
        Describe what else you want Bestie to dig into — she'll extract focus areas and save anything structured back to your profile.
      </p>

      <textarea
        class="cfg-textarea"
        rows="5"
        placeholder="e.g. I want to know if he's figured out where he wants to live in 5 years. Also check if his family has a say in his relationships — that's a dealbreaker for me..."
        bind:value={customPrompt}
        onkeydown={handleKeydown}
        disabled={submitting}
      ></textarea>

      <p class="textarea-hint">Tip: Cmd/Ctrl + Enter to submit</p>

      {#if submitError}
        <div class="feedback-row error" transition:fly={{ y: 4, duration: 200 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
          </svg>
          {submitError}
        </div>
      {/if}

      <button
        class="submit-btn"
        onclick={handleSubmit}
        disabled={!customPrompt.trim() || submitting}
      >
        {#if submitting}
          <span class="btn-spinner"></span>
          Updating AI Bestie…
        {:else}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
          </svg>
          Update AI Bestie
        {/if}
      </button>
    </section>

    <!-- ── How it works ───────────────────────────────────────────────── -->
    <section class="cfg-section how-it-works">
      <div class="cfg-section-label">How this works</div>
      <ol class="how-list">
        <li>You tell Bestie what matters to you in plain language</li>
        <li>She extracts structured preferences and adds them to your profile</li>
        <li>When she chats with a match, she probes those exact areas</li>
        <li>You get a signal report — 🚩 red, ⚠️ amber, ✅ green</li>
      </ol>
    </section>

  </div>
</div>

<style>
  /* ── Layout ── */
  .configure-screen {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-1);
    overflow: hidden;
  }

  /* ── Header ── */
  .cfg-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-1);
    flex-shrink: 0;
    background: var(--bg-1);
  }

  .back-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-1);
    flex-shrink: 0;
    transition: background 150ms;
  }
  .back-btn:hover { background: var(--bg-3); }

  .cfg-title-area {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  /* .cfg-avatar replaced by <BestieAvatar size={36} /> */

  .cfg-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-1);
  }

  .cfg-subtitle {
    font-size: 12px;
    color: var(--text-3);
  }

  /* ── Body ── */
  .cfg-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* ── Section ── */
  .cfg-section {
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: 14px;
    padding: 16px;
    margin-bottom: 12px;
  }

  .cfg-section-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
    margin-bottom: 12px;
  }

  .cfg-hint {
    font-size: 13px;
    color: var(--text-3);
    margin: 0 0 12px;
    line-height: 1.5;
  }

  /* ── Persona section ── */
  .persona-section {
    border-color: rgba(236, 72, 153, 0.2);
    background: linear-gradient(135deg, rgba(236,72,153,0.05) 0%, rgba(168,85,247,0.05) 100%);
  }

  .persona-fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 14px;
  }

  .persona-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .persona-field-wide {
    grid-column: 1 / -1;
  }

  .field-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-2);
  }

  .field-note {
    font-weight: 400;
    color: var(--text-3);
    font-size: 11px;
  }

  .field-input,
  .field-select {
    background: var(--bg-3);
    border: 1px solid var(--border-1);
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 14px;
    color: var(--text-1);
    outline: none;
    transition: border-color 150ms;
    width: 100%;
    box-sizing: border-box;
  }

  .field-input:focus,
  .field-select:focus {
    border-color: rgba(236, 72, 153, 0.5);
  }

  .field-input.field-error {
    border-color: rgba(239, 68, 68, 0.6);
  }

  .field-select {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    padding-right: 28px;
    cursor: pointer;
  }

  .age-error {
    font-size: 11px;
    color: #f87171;
  }

  .persona-save-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 16px;
    border-radius: 18px;
    background: linear-gradient(135deg, #ec4899, #a855f7);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: opacity 150ms;
  }
  .persona-save-btn:disabled { opacity: 0.5; cursor: default; }

  .btn-spinner-sm {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  /* ── Probes loading / empty ── */
  .loading-row {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-3);
    font-size: 13px;
  }

  .dot-pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-3);
    animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }

  .empty-hint {
    font-size: 13px;
    color: var(--text-3);
    font-style: italic;
    margin: 0;
  }

  /* ── Probe groups ── */
  .probe-groups {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .probe-group {
    border-radius: 10px;
    padding: 10px 12px;
    border: 1px solid;
  }

  .probe-group-green  { background: rgba(52,211,153,0.06);  border-color: rgba(52,211,153,0.2);  }
  .probe-group-red    { background: rgba(248,113,113,0.06); border-color: rgba(248,113,113,0.2); }
  .probe-group-amber  { background: rgba(251,191,36,0.06);  border-color: rgba(251,191,36,0.2);  }
  .probe-group-purple { background: rgba(167,139,250,0.06); border-color: rgba(167,139,250,0.2); }
  .probe-group-blue   { background: rgba(96,165,250,0.06);  border-color: rgba(96,165,250,0.2);  }

  .probe-group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .probe-emoji {
    font-size: 14px;
    flex-shrink: 0;
  }

  .probe-heading {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }
  .probe-heading-green  { color: #34d399; }
  .probe-heading-red    { color: #f87171; }
  .probe-heading-amber  { color: #fbbf24; }
  .probe-heading-purple { color: #a78bfa; }
  .probe-heading-blue   { color: #60a5fa; }

  /* Per-item rows */
  .probe-items {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .probe-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 2px;
    border-radius: 6px;
    transition: background 120ms;
  }
  .probe-item:hover { background: rgba(255,255,255,0.03); }
  .probe-item:hover .probe-delete-btn { opacity: 1; }

  .probe-bullet {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .probe-bullet-green  { background: #34d399; }
  .probe-bullet-red    { background: #f87171; }
  .probe-bullet-amber  { background: #fbbf24; }
  .probe-bullet-purple { background: #a78bfa; }
  .probe-bullet-blue   { background: #60a5fa; }

  .probe-item-text {
    flex: 1;
    font-size: 13px;
    color: var(--text-2);
    line-height: 1.45;
  }

  .probe-delete-btn {
    opacity: 0;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: none;
    background: rgba(239,68,68,0.1);
    color: #f87171;
    display: grid;
    place-items: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: opacity 120ms, background 120ms;
  }
  .probe-delete-btn:hover { background: rgba(239,68,68,0.22); }
  .probe-delete-btn:disabled { cursor: default; }

  .delete-spinner {
    width: 10px;
    height: 10px;
    border: 1.5px solid rgba(248,113,113,0.35);
    border-top-color: #f87171;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  .probe-new-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #34d399;
    padding: 6px 8px;
    border-radius: 8px;
    background: rgba(52,211,153,0.08);
    border: 1px solid rgba(52,211,153,0.2);
  }

  .insights-saved {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #34d399;
    margin-top: 10px;
  }

  /* ── Input area ── */
  .cfg-textarea {
    width: 100%;
    background: var(--bg-3);
    border: 1px solid var(--border-1);
    border-radius: 10px;
    padding: 12px 14px;
    font-size: 14px;
    color: var(--text-1);
    line-height: 1.5;
    resize: none;
    outline: none;
    box-sizing: border-box;
    transition: border-color 150ms;
  }
  .cfg-textarea:focus { border-color: rgba(236,72,153,0.5); }
  .cfg-textarea::placeholder { color: var(--text-3); }
  .cfg-textarea:disabled { opacity: 0.5; }

  .textarea-hint {
    font-size: 11px;
    color: var(--text-3);
    margin: 4px 0 12px;
    text-align: right;
  }

  /* ── Feedback ── */
  .feedback-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    padding: 10px 12px;
    border-radius: 8px;
    margin-bottom: 10px;
    line-height: 1.5;
  }
  .feedback-row.error { background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
  .feedback-row svg { flex-shrink: 0; margin-top: 1px; }

  /* ── Submit button ── */
  .submit-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 10px 20px;
    border-radius: 22px;
    background: linear-gradient(135deg, #ec4899, #a855f7);
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: opacity 150ms;
    width: 100%;
    justify-content: center;
  }
  .submit-btn:disabled { opacity: 0.38; cursor: default; }

  .btn-spinner {
    width: 15px;
    height: 15px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── How it works ── */
  .how-it-works {
    background: transparent;
    border-color: rgba(236,72,153,0.15);
  }

  .how-list {
    padding: 0 0 0 18px;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .how-list li {
    font-size: 13px;
    color: var(--text-3);
    line-height: 1.5;
  }

  /* ── Mobile ── */
  @media (max-width: 767px) {
    .cfg-header { padding: 10px 12px; }
    .cfg-body   { padding: 12px; }
    .cfg-section { padding: 14px; }
    .persona-fields { grid-template-columns: 1fr; }
    .persona-field-wide { grid-column: 1; }
  }
</style>
