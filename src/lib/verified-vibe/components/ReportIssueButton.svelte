<script lang="ts">
  /**
   * "Report issue" — the human backstop behind the automated photo content
   * screen. Mount it wherever a member can see content we published: a profile
   * card, a photo gallery, a chat thread.
   *
   * Deliberately quiet by default (a small text affordance, not a red button):
   * it has to be findable the moment someone needs it, without implying that
   * what they are looking at is suspect. It opens a small sheet rather than
   * firing immediately, because a one-tap report with no category is the least
   * actionable thing the team can receive.
   *
   * The Supabase client is imported lazily inside submit() rather than at module
   * scope: $lib/client/supabase reads $env/dynamic/public on load, which is absent
   * under jsdom, so a static import here breaks the tests of every component that
   * mounts this one. Same pattern the profile page already uses.
   */

  interface Props {
    /** Where the user is, recorded verbatim on the report (e.g. 'discover'). */
    surface: string;
    /** The profile being viewed, when there is one. */
    subjectUserId?: string | null;
    /** The specific image on screen, when there is one. */
    subjectUrl?: string | null;
    /** Small bag of extra client detail for triage. */
    context?: Record<string, unknown>;
    /** 'text' is the inline affordance; 'icon' fits a photo corner or a toolbar. */
    variant?: 'text' | 'icon';
  }

  let {
    surface,
    subjectUserId = null,
    subjectUrl = null,
    context = {},
    variant = 'text',
  }: Props = $props();

  const CATEGORIES = [
    { value: 'nudity', label: 'Nudity or sexual content' },
    { value: 'disturbing', label: 'Disturbing or graphic content' },
    { value: 'wrong_person', label: "The photos aren't this person" },
    { value: 'bug', label: 'Something is broken' },
    { value: 'other', label: 'Something else' },
  ] as const;

  let open = $state(false);
  let category = $state<string | null>(null);
  let description = $state('');
  let sending = $state(false);
  let done = $state(false);
  let error = $state<string | null>(null);

  function reset() {
    category = null;
    description = '';
    error = null;
    done = false;
  }

  async function submit() {
    if (!category || sending) return;
    sending = true;
    error = null;
    try {
      // Auth is optional server-side, so a missing session must not stop the
      // report — send it without a token rather than failing.
      let token = '';
      try {
        const { getSupabaseClient } = await import('$lib/client/supabase');
        const { data } = await getSupabaseClient().auth.getSession();
        token = data.session?.access_token ?? '';
      } catch { /* signed out — report anonymously */ }

      const res = await fetch('/api/verified-vibe/report-issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ category, description, surface, subjectUserId, subjectUrl, context }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "We couldn't submit that report.");
      }
      done = true;
    } catch (e) {
      error = e instanceof Error ? e.message : "We couldn't submit that report.";
    } finally {
      sending = false;
    }
  }
</script>

{#if variant === 'icon'}
  <button class="trigger-icon" onclick={() => { reset(); open = true; }} aria-label="Report an issue">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  </button>
{:else}
  <button class="trigger-text" onclick={() => { reset(); open = true; }}>Report issue</button>
{/if}

{#if open}
  <!-- Click-outside on the backdrop only; the sheet itself stops propagation. -->
  <div
    class="backdrop"
    role="button"
    tabindex="-1"
    aria-label="Close"
    onclick={() => (open = false)}
    onkeydown={(e) => { if (e.key === 'Escape') open = false; }}
  >
    <div
      class="sheet"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-label="Report an issue"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      {#if done}
        <h3>Thanks — we got it</h3>
        <p class="body">
          Someone on our team reviews every report, and we act on anything that breaks
          our rules. You don't need to do anything else.
        </p>
        <button class="primary" onclick={() => (open = false)}>Done</button>
      {:else}
        <h3>Report an issue</h3>
        <p class="body">What's wrong here?</p>
        <div class="options">
          {#each CATEGORIES as c (c.value)}
            <button
              class="option"
              class:selected={category === c.value}
              onclick={() => (category = c.value)}
            >
              {c.label}
            </button>
          {/each}
        </div>
        <textarea
          bind:value={description}
          maxlength="2000"
          rows="3"
          placeholder="Anything else we should know? (optional)"
        ></textarea>
        {#if error}<p class="error">{error}</p>{/if}
        <div class="actions">
          <button class="secondary" onclick={() => (open = false)} disabled={sending}>Cancel</button>
          <button class="primary" onclick={submit} disabled={!category || sending}>
            {sending ? 'Sending…' : 'Send report'}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .trigger-text {
    background: none;
    border: 0;
    padding: 4px 2px;
    font-size: 12px;
    font-weight: 500;
    color: currentColor;
    opacity: 0.55;
    text-decoration: underline;
    cursor: pointer;
  }
  .trigger-text:hover { opacity: 0.9; }

  .trigger-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.42);
    color: #fff;
    cursor: pointer;
  }

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 900;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    padding: 16px;
  }
  @media (min-width: 640px) {
    .backdrop { align-items: center; }
  }

  .sheet {
    width: 100%;
    max-width: 420px;
    background: var(--surface, #fff);
    color: var(--text, #1f2937);
    border-radius: 18px;
    padding: 20px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
  }
  .sheet h3 { margin: 0 0 6px; font-size: 17px; font-weight: 700; }
  .body { margin: 0 0 14px; font-size: 13px; line-height: 1.5; opacity: 0.75; }

  .options { display: flex; flex-direction: column; gap: 7px; margin-bottom: 12px; }
  .option {
    text-align: left;
    padding: 11px 13px;
    font-size: 13.5px;
    font-weight: 500;
    color: inherit;
    background: rgba(127, 127, 127, 0.09);
    border: 1px solid transparent;
    border-radius: 11px;
    cursor: pointer;
  }
  .option.selected {
    background: rgba(255, 59, 107, 0.12);
    border-color: rgba(255, 59, 107, 0.5);
  }

  textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 12px;
    font: inherit;
    font-size: 13px;
    color: inherit;
    background: rgba(127, 127, 127, 0.09);
    border: 1px solid rgba(127, 127, 127, 0.2);
    border-radius: 11px;
    resize: vertical;
  }

  .error { margin: 10px 0 0; font-size: 12.5px; color: #dc2626; }

  .actions { display: flex; gap: 8px; margin-top: 14px; }
  .primary, .secondary {
    flex: 1;
    padding: 12px;
    font-size: 14px;
    font-weight: 600;
    border-radius: 11px;
    border: 0;
    cursor: pointer;
  }
  .primary { background: #ec4899; color: #fff; }
  .primary:disabled { opacity: 0.5; cursor: default; }
  .secondary { background: rgba(127, 127, 127, 0.14); color: inherit; }
</style>
