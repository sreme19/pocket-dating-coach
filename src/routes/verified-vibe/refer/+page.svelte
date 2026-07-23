<script lang="ts">
  /**
   * Refer & Earn — women invite men (Model A: "come talk to me").
   *
   * She shares her /beta link with the men already sliding into her DMs on other
   * apps. They land on her card, sign up, and her AI Bestie talks to every one of
   * them and hands her the gems. No money changes hands — the vetted men are the
   * reward. This screen is the share surface + a plain funnel status line.
   *
   * Data is fetched client-side from GET /api/verified-vibe/referral-link (there
   * is no cookie session; the token lives in the client Supabase session).
   */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getSupabaseClient } from '$lib/client/supabase';
  import { fade } from 'svelte/transition';

  type State = 'loading' | 'ready' | 'denied' | 'error';
  let view = $state<State>('loading');
  let shareUrl = $state('');
  let invited = $state(0);
  let signedUp = $state(0);
  let copiedLink = $state(false);
  let copiedMsg = $state(false);

  // The pre-filled DM she drops to the men in her inbox. Editable before sharing.
  let message = $state('');
  const messageFor = (url: string) =>
    `hey! sorry, I've got hundreds of messages here and don't have time to reply to them all. ` +
    `but I'd genuinely love to talk if you're my type. I'm moving my convos over to the Riteangle app, ` +
    `so if you actually wanna get to know me, start here 👉 ${url}`;

  onMount(async () => {
    try {
      const { data: { session } } = await getSupabaseClient().auth.getSession();
      const token = session?.access_token ?? '';
      if (!token) { goto('/verified-vibe/auth'); return; }

      const res = await fetch('/api/verified-vibe/referral-link', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) { view = 'denied'; return; }
      if (!res.ok) { view = 'error'; return; }

      const data = await res.json();
      shareUrl = `${window.location.origin}${data.path}`;
      invited = data.invited ?? 0;
      signedUp = data.signedUp ?? 0;
      message = messageFor(shareUrl);
      view = 'ready';
    } catch {
      view = 'error';
    }
  });

  async function copy(text: string, which: 'link' | 'msg') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API can be blocked (insecure context / WebView) — fall back.
      window.prompt('Copy this:', text);
    }
    if (which === 'link') { copiedLink = true; setTimeout(() => (copiedLink = false), 1600); }
    else { copiedMsg = true; setTimeout(() => (copiedMsg = false), 1600); }
  }

  function shareWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  }

  const prettyUrl = $derived(shareUrl.replace(/^https?:\/\//, ''));
</script>

<div class="refer">
  <header class="bar">
    <button class="back" onclick={() => goto('/verified-vibe/profile')} aria-label="Back to profile">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    </button>
    <span class="title">Refer &amp; Earn</span>
    <span class="spacer"></span>
  </header>

  {#if view === 'loading'}
    <div class="pad center muted">Loading your link…</div>
  {:else if view === 'denied'}
    <div class="pad center muted" in:fade>
      <p>Refer &amp; Earn is for women inviting the men in their DMs. It isn't available on your account.</p>
    </div>
  {:else if view === 'error'}
    <div class="pad center muted" in:fade>
      <p>Couldn't load your link. Check your connection and try again.</p>
      <button class="btn ghost" onclick={() => location.reload()}>Retry</button>
    </div>
  {:else}
    <div class="body" in:fade={{ duration: 200 }}>
      <!-- Hero -->
      <h1 class="hero">Turn your DMs into dates.</h1>
      <p class="hero-sub">Your AI Bestie speaks to them. Not you.</p>

      <p class="pitch">
        Hundreds of guys sliding into your DMs on Instagram, WhatsApp and Tinder?
        Most are creeps 🙄 but a few are genuine, successful, even high-earning.
        You don't have the time to text them all. So send them your link: your Bestie
        talks to every one of them, ranks them, and brings you only the ones worth your time.
      </p>

      <!-- How it works -->
      <ol class="steps">
        <li><span class="n">1</span><span>Share your link with the guys already chasing you.</span></li>
        <li><span class="n">2</span><span>Your Bestie gets to know and ranks each of them, so you don't have to.</span></li>
        <li><span class="n">3</span><span>The best ones get handed straight to you. You only meet the gems.</span></li>
      </ol>

      <!-- Link -->
      <div class="linkcard">
        <span class="lbl">Your link</span>
        <span class="url">{prettyUrl}</span>
      </div>

      <!-- Share -->
      <div class="share">
        <button class="btn wa" onclick={shareWhatsApp}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></svg>
          Share on WhatsApp
        </button>
        <button class="btn ghost" onclick={() => copy(shareUrl, 'link')}>
          {copiedLink ? 'Copied ✓' : 'Copy link'}
        </button>
      </div>

      <!-- Editable pre-filled message -->
      <div class="msg">
        <div class="msg-head">
          <span class="lbl">What lands in his DM</span>
          <button class="mini" onclick={() => copy(message, 'msg')}>{copiedMsg ? 'Copied ✓' : 'Copy message'}</button>
        </div>
        <textarea bind:value={message} rows="5" aria-label="Message to send"></textarea>
        <p class="hint">Edit it to sound like you before you send.</p>
      </div>

      <!-- Status line -->
      <div class="status">
        <span class="stat"><span class="k">{invited}</span> invited</span>
        <span class="dot"></span>
        <span class="stat"><span class="k up">{signedUp}</span> signed up</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .refer {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-1);
    color: var(--text-1);
    font-family: var(--font-serif);
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-1);
    background: var(--bg-1);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .back {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--text-2);
    flex-shrink: 0;
  }
  .title { flex: 1; text-align: center; font-size: 15px; font-weight: 700; }
  .spacer { width: 32px; flex-shrink: 0; }

  .body { overflow-y: auto; padding: 20px 16px 40px; }
  .pad { padding: 40px 24px; }
  .center { text-align: center; }
  .muted { color: var(--text-2); }

  .hero {
    font-size: 27px;
    line-height: 1.08;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin: 4px 0 6px;
  }
  .hero-sub {
    font-size: 16px;
    font-weight: 600;
    color: var(--accent-bright);
    margin: 0 0 16px;
  }
  .pitch {
    font-size: 14.5px;
    line-height: 1.55;
    color: var(--text-2);
    margin: 0 0 20px;
  }

  .steps {
    list-style: none;
    margin: 0 0 22px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .steps li {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: var(--r-md);
    padding: 13px 14px;
    font-size: 14px;
    line-height: 1.4;
  }
  .steps .n {
    flex: 0 0 auto;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: var(--accent);
    color: #fff;
    font-weight: 800;
    font-size: 13px;
    display: grid;
    place-items: center;
  }

  .linkcard {
    display: flex;
    flex-direction: column;
    gap: 3px;
    background: var(--accent-tint);
    border: 1px dashed var(--accent);
    border-radius: var(--r-md);
    padding: 12px 14px;
    margin-bottom: 12px;
  }
  .linkcard .lbl {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent-bright);
  }
  .linkcard .url { font-size: 14px; font-weight: 700; word-break: break-all; }

  .share { display: flex; gap: 8px; margin-bottom: 20px; }
  .btn {
    flex: 1;
    border: none;
    border-radius: var(--r-md);
    padding: 13px 10px;
    font-family: inherit;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .btn.wa { background: var(--accent); color: #fff; }
  .btn.ghost { background: var(--bg-2); color: var(--text-1); border: 1px solid var(--border-2); flex: 0 0 auto; padding-inline: 16px; }

  .msg { margin-bottom: 22px; }
  .msg-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }
  .msg-head .lbl {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .mini {
    background: none;
    border: none;
    color: var(--accent-bright);
    font-family: inherit;
    font-weight: 700;
    font-size: 12.5px;
    cursor: pointer;
    padding: 0;
  }
  .msg textarea {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    background: var(--bg-2);
    border: 1px solid var(--border-2);
    border-radius: var(--r-md);
    padding: 12px 13px;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-1);
  }
  .msg textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
  .msg .hint { font-size: 12px; color: var(--text-3); margin: 6px 2px 0; }

  .status {
    display: flex;
    align-items: center;
    gap: 12px;
    justify-content: center;
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    border-radius: var(--r-md);
    padding: 16px;
  }
  .status .stat { font-size: 14px; color: var(--text-2); }
  .status .k { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: var(--text-1); font-variant-numeric: tabular-nums; }
  .status .k.up { color: var(--accent-bright); }
  .status .dot { width: 4px; height: 4px; border-radius: 999px; background: var(--text-4); }

  /* Retry button in the error state (share-row ghost stays inline). */
  .pad .btn { margin-top: 12px; }
</style>
