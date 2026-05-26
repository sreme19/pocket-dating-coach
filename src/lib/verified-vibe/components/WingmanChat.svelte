<script lang="ts">
  import { goto } from '$app/navigation';

  interface Props {
    profileSnapshot: Record<string, unknown>;
    onAction: (action: WingmanAction) => void;
  }

  export interface WingmanAction {
    action: string;
    field?: string;
    value?: unknown;
    category?: string;
    insight_label?: string;
    country?: string;
    tag?: string;
    uploadUrl?: string;
    confirmation?: string;
    redirectMessage?: string;
  }

  let { profileSnapshot, onAction }: Props = $props();

  let open = $state(false);
  let input = $state('');
  let loading = $state(false);
  let messages = $state<Array<{ role: 'user' | 'wingman' | 'redirect'; text: string; url?: string }>>([]);
  let inputEl = $state<HTMLInputElement | null>(null);

  const SUGGESTIONS = [
    'Remove my LinkedIn',
    'Update my bio',
    'Clear my hard nos',
    'Change my archetype',
  ];

  function toggleOpen() {
    open = !open;
    if (open) {
      setTimeout(() => inputEl?.focus(), 120);
    }
  }

  async function send() {
    const msg = input.trim();
    if (!msg || loading) return;

    input = '';
    messages = [...messages, { role: 'user', text: msg }];
    loading = true;

    try {
      // Get auth token
      const { getSupabaseClient } = await import('$lib/client/supabase');
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      const token = session?.access_token ?? '';

      const res = await fetch('/api/verified-vibe/wingman', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: msg, profileSnapshot }),
      });

      const action: WingmanAction = await res.json();

      if (action.action === 'redirect_upload') {
        messages = [...messages, {
          role: 'redirect',
          text: action.redirectMessage ?? 'That needs proof — tap to upload.',
          url: action.uploadUrl,
        }];
      } else if (action.action === 'clarify') {
        messages = [...messages, {
          role: 'wingman',
          text: action.confirmation ?? "I'm not sure what you'd like to change. Try being more specific.",
        }];
      } else {
        // Execute the action and notify parent
        onAction(action);
        messages = [...messages, {
          role: 'wingman',
          text: action.confirmation ?? 'Done ✓',
        }];
      }
    } catch {
      messages = [...messages, { role: 'wingman', text: 'Something went wrong. Try again.' }];
    } finally {
      loading = false;
      setTimeout(() => inputEl?.focus(), 80);
    }
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    if (e.key === 'Escape') open = false;
  }

  function useSuggestion(s: string) {
    input = s;
    inputEl?.focus();
  }
</script>

<!-- ── Floating bubble ─────────────────────────────────────────────────────── -->
<button
  class="wingman-fab {open ? 'wingman-fab--open' : ''}"
  onclick={toggleOpen}
  aria-label="AI Wingman"
  type="button"
>
  {#if open}
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  {:else}
    <span class="wingman-fab-inner">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <span class="wingman-fab-label">Wingman</span>
    </span>
  {/if}
</button>

<!-- ── Drawer ─────────────────────────────────────────────────────────────── -->
{#if open}
  <!-- Backdrop -->
  <div
    class="wingman-backdrop"
    onclick={toggleOpen}
    onkeydown={(e) => e.key === 'Escape' && (open = false)}
    role="button"
    tabindex="-1"
    aria-label="Close wingman"
  ></div>

  <div class="wingman-drawer" role="dialog" aria-label="AI Wingman chat">
    <!-- Handle -->
    <div class="wingman-handle"></div>

    <!-- Header -->
    <div class="wingman-header">
      <div class="wingman-avatar">✨</div>
      <div class="wingman-header-body">
        <p class="wingman-title">AI Wingman</p>
        <p class="wingman-subtitle">Edit your profile in plain English</p>
      </div>
    </div>

    <!-- Messages -->
    {#if messages.length === 0}
      <!-- Empty state with suggestions -->
      <div class="wingman-empty">
        <p class="wingman-empty-hint">Try something like…</p>
        <div class="wingman-suggestions">
          {#each SUGGESTIONS as s}
            <button class="wingman-suggestion" onclick={() => useSuggestion(s)} type="button">{s}</button>
          {/each}
        </div>
      </div>
    {:else}
      <div class="wingman-messages">
        {#each messages as m}
          {#if m.role === 'user'}
            <div class="wm-msg wm-msg--user">{m.text}</div>
          {:else if m.role === 'redirect'}
            <div class="wm-msg wm-msg--redirect">
              <p class="wm-redirect-text">{m.text}</p>
              {#if m.url}
                <button class="wm-redirect-btn" onclick={() => goto(m.url!)} type="button">
                  Go to upload →
                </button>
              {/if}
            </div>
          {:else}
            <div class="wm-msg wm-msg--wingman">{m.text}</div>
          {/if}
        {/each}
        {#if loading}
          <div class="wm-msg wm-msg--wingman wm-thinking">
            <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Input -->
    <div class="wingman-input-row">
      <input
        bind:this={inputEl}
        bind:value={input}
        onkeydown={handleKey}
        class="wingman-input"
        placeholder="e.g. Remove my LinkedIn, update my bio…"
        disabled={loading}
        autocomplete="off"
      />
      <button
        class="wingman-send {input.trim() ? 'wingman-send--active' : ''}"
        onclick={send}
        disabled={!input.trim() || loading}
        type="button"
        aria-label="Send"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
        </svg>
      </button>
    </div>
  </div>
{/if}

<style>
  /* ── FAB ── */
  .wingman-fab {
    position: fixed;
    bottom: 88px;
    right: 18px;
    z-index: 120;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    padding: 0 16px 0 14px;
    border-radius: 999px;
    background: linear-gradient(135deg, #7c3aed, #6366f1);
    border: none;
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(99,102,241,0.45);
    transition: transform 0.18s, box-shadow 0.18s;
  }
  .wingman-fab:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(99,102,241,0.55); }
  .wingman-fab--open {
    width: 44px;
    padding: 0;
    border-radius: 50%;
    background: var(--bg-3);
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  }
  .wingman-fab-inner {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .wingman-fab-label { letter-spacing: 0.01em; }

  /* ── Backdrop ── */
  .wingman-backdrop {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 118;
    background: rgba(0,0,0,0.45);
  }

  /* ── Drawer ── */
  .wingman-drawer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 119;
    background: var(--bg-2);
    border-radius: 20px 20px 0 0;
    border-top: 1px solid var(--border-1);
    padding: 0 0 env(safe-area-inset-bottom, 16px);
    display: flex;
    flex-direction: column;
    max-height: 72vh;
    animation: drawer-up 0.26s cubic-bezier(0.34,1.2,0.64,1);
  }

  @keyframes drawer-up {
    from { transform: translateY(100%); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  .wingman-handle {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--border-2);
    margin: 10px auto 0;
    flex-shrink: 0;
  }

  /* ── Header ── */
  .wingman-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px 12px;
    border-bottom: 1px solid var(--border-1);
    flex-shrink: 0;
  }
  .wingman-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(124,58,237,0.2), rgba(99,102,241,0.2));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
  }
  .wingman-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
    margin: 0;
  }
  .wingman-subtitle {
    font-size: 11px;
    color: var(--text-3);
    margin: 0;
  }

  /* ── Empty / suggestions ── */
  .wingman-empty {
    flex: 1;
    padding: 18px 18px 10px;
    overflow-y: auto;
  }
  .wingman-empty-hint {
    font-size: 12px;
    color: var(--text-3);
    margin: 0 0 10px;
  }
  .wingman-suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .wingman-suggestion {
    padding: 7px 13px;
    border-radius: 999px;
    background: var(--bg-3);
    border: 1px solid var(--border-2);
    color: var(--text-2);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
  }
  .wingman-suggestion:hover {
    background: rgba(99,102,241,0.12);
    border-color: rgba(99,102,241,0.35);
    color: #818cf8;
  }

  /* ── Messages ── */
  .wingman-messages {
    flex: 1;
    overflow-y: auto;
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .wm-msg {
    max-width: 85%;
    padding: 9px 13px;
    border-radius: 14px;
    font-size: 13px;
    line-height: 1.45;
  }
  .wm-msg--user {
    align-self: flex-end;
    background: linear-gradient(135deg, #7c3aed, #6366f1);
    color: #fff;
    border-bottom-right-radius: 4px;
  }
  .wm-msg--wingman {
    align-self: flex-start;
    background: var(--bg-3);
    color: var(--text-1);
    border-bottom-left-radius: 4px;
  }
  .wm-msg--redirect {
    align-self: flex-start;
    background: rgba(251,146,60,0.1);
    border: 1px solid rgba(251,146,60,0.3);
    border-radius: 14px;
    border-bottom-left-radius: 4px;
    padding: 10px 13px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .wm-redirect-text {
    font-size: 13px;
    color: var(--text-1);
    margin: 0;
  }
  .wm-redirect-btn {
    align-self: flex-start;
    padding: 5px 12px;
    border-radius: 8px;
    background: rgba(251,146,60,0.2);
    border: 1px solid rgba(251,146,60,0.4);
    color: #f97316;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  /* Thinking dots */
  .wm-thinking { display: flex; gap: 5px; align-items: center; padding: 12px 16px; }
  .dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--text-3);
    animation: dot-bounce 1.2s infinite ease-in-out;
  }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes dot-bounce {
    0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }

  /* ── Input row ── */
  .wingman-input-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px 14px;
    flex-shrink: 0;
    border-top: 1px solid var(--border-1);
  }
  .wingman-input {
    flex: 1;
    padding: 10px 14px;
    border-radius: 999px;
    background: var(--bg-3);
    border: 1px solid var(--border-2);
    color: var(--text-1);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
  }
  .wingman-input:focus { border-color: rgba(99,102,241,0.5); }
  .wingman-input::placeholder { color: var(--text-3); }

  .wingman-send {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--bg-3);
    border: 1px solid var(--border-2);
    color: var(--text-3);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .wingman-send--active {
    background: linear-gradient(135deg, #7c3aed, #6366f1);
    border-color: transparent;
    color: #fff;
  }

  /* ── Desktop: constrain everything inside the 430px centered app frame ──
     Must be LAST so it overrides base left/right/inset rules above. ── */
  @media (min-width: 768px) {
    .wingman-fab {
      right: calc((100vw - 430px) / 2 + 18px);
    }
    .wingman-backdrop {
      left: calc((100vw - 430px) / 2);
      right: calc((100vw - 430px) / 2);
      top: 0;
      bottom: 0;
    }
    .wingman-drawer {
      left: calc((100vw - 430px) / 2);
      right: calc((100vw - 430px) / 2);
    }
  }
</style>
