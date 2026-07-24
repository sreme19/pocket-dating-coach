<script lang="ts">
  /**
   * Refer & Earn — one entry, two flows (toggle):
   *
   *  - Invite women (Flow 2, Model B): CASH ambassador referral. She earns ₹100
   *    for each verified woman she brings (#1-25), then ₹150 (#26-100), cap 100.
   *    A "mood" (networking / casual / serious) sets the share message + the
   *    landing the invitee sees (via ?m=). Money is paid MANUALLY by an admin.
   *  - Invite men (Flow 1, Model A): no money — her AI Bestie screens the men in
   *    her DMs and hands her the gems.
   *
   * Data comes from GET /api/verified-vibe/referral-link (client-side; the token
   * lives in the client Supabase session, there is no cookie session).
   */
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getSupabaseClient } from '$lib/client/supabase';
  import { fade } from 'svelte/transition';

  type State = 'loading' | 'ready' | 'denied' | 'error';
  type Mood = 'networking' | 'casual' | 'serious';
  type Cash = {
    verifiedCount: number;
    earnedInr: number;
    paidInr: number;
    pendingInr: number;
    currentTier: number;
    cap: number;
  };

  let view = $state<State>('loading');
  let tab = $state<'women' | 'men'>('women');
  let shareUrl = $state('');
  let invited = $state(0);
  let signedUp = $state(0);
  let cash = $state<Cash | null>(null);
  let gender = $state<string | null>(null);
  let copiedLink = $state(false);
  let copiedMsg = $state(false);

  // ── Invite men (Flow 1) ─────────────────────────────────────────────────────
  let message = $state('');
  const messageFor = (url: string) =>
    `hey! sorry, I've got hundreds of messages here and don't have time to reply to them all. ` +
    `but I'd genuinely love to talk if you're my type. I'm moving my convos over to the Riteangle app, ` +
    `so if you actually wanna get to know me, start here 👉 ${url}`;

  // ── Invite women (Flow 2) ───────────────────────────────────────────────────
  // Kept in lockstep with the Flutter refer screen and the /beta landing moods.
  let mood = $state<Mood>('networking');
  let womenMsg = $state('');
  const womenLink = (m: Mood) => `${shareUrl}?m=${m}`;
  const WOMEN_MSG: Record<Mood, (url: string) => string> = {
    networking: (url) =>
      `hey! got an invite to this, it's an invite-only network of properly high-functioning people ` +
      `(tech, finance, founders, creatives, sport). the circle is genuinely impressive and it's first ` +
      `come first serve. (some people use it to meet someone too, no pressure) 👉 ${url}`,
    casual: (url) =>
      `ok this one's actually not like the other dating apps, everyone's identity-verified, skews ` +
      `high-earning tech/finance, and an AI weeds out the creeps before they reach you. come make ` +
      `trouble with me 👉 ${url}`,
    serious: (url) =>
      `found a dating app that's actually for people who want something real, verified, serious, ` +
      `a lot of tech/finance types. thought of you, here's an invite 👉 ${url}`,
  };

  // A man inviting women speaks in his own voice (and never mentions the
  // auto-match — that's his private upside, not surfaced to her).
  const MEN_MSG: Record<Mood, (url: string) => string> = {
    networking: (url) =>
      `hey! got an invite to this, it's an invite-only network of high-functioning people ` +
      `(tech, finance, founders, creatives, sport). genuinely impressive crowd and it's first ` +
      `come first serve. thought you'd fit right in 👉 ${url}`,
    casual: (url) =>
      `found this app, everyone's identity-verified and the crowd is way better than the usual ` +
      `ones. you should check it out 👉 ${url}`,
    serious: (url) =>
      `found a dating app that's actually for people who want something real, everyone verified, ` +
      `no time-wasters. thought of you, here's an invite 👉 ${url}`,
  };

  const msgSet = () => (gender === 'man' ? MEN_MSG : WOMEN_MSG);

  function selectMood(m: Mood) {
    mood = m;
    womenMsg = msgSet()[m](womenLink(m));
  }

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
      cash = data.cash ?? null;
      gender = data.gender ?? null;
      message = messageFor(shareUrl);
      womenMsg = msgSet()[mood](womenLink(mood));
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

  function shareWhatsApp(text: string) {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  const prettyUrl = $derived(shareUrl.replace(/^https?:\/\//, ''));
  const capPct = $derived(cash ? Math.min(100, (cash.verifiedCount / cash.cap) * 100) : 0);
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
      <p>Refer &amp; Earn is for women inviting friends. It isn't available on your account.</p>
    </div>
  {:else if view === 'error'}
    <div class="pad center muted" in:fade>
      <p>Couldn't load your link. Check your connection and try again.</p>
      <button class="btn ghost" onclick={() => location.reload()}>Retry</button>
    </div>
  {:else}
    <div class="body" in:fade={{ duration: 200 }}>
      {#if gender === 'woman'}
        <div class="toggle">
          <button class:on={tab === 'women'} onclick={() => (tab = 'women')}>Invite women</button>
          <button class:on={tab === 'men'} onclick={() => (tab = 'men')}>Invite men</button>
        </div>
      {/if}

      {#if tab === 'men'}
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
          <button class="btn wa" onclick={() => shareWhatsApp(message)}>
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
      {:else}
        <!-- Invite women — cash -->
        <h1 class="hero">{gender === 'man' ? 'Invite women. Earn real cash.' : 'Invite your girls. Earn real cash.'}</h1>
        <p class="hero-sub">₹{cash?.currentTier ?? 100} for every friend who joins.</p>
        {#if gender === 'man'}
          <p class="pitch">
            Invite women you'd genuinely vouch for. You earn for each one who joins and gets verified,
            and she gets into a curated, safe circle.
          </p>
          <div class="upside">✨ When someone you invite joins and gets verified, she's matched with you.</div>
        {:else}
          <p class="pitch">
            Bring the women you'd want in a genuinely good room. You earn for each one who joins and
            gets verified. She gets into a curated, safe circle. Everybody wins.
          </p>
        {/if}

        <!-- Earnings -->
        <div class="earn">
          <div class="earn-top">
            <span class="amt">₹{cash?.earnedInr ?? 0}</span>
            <span class="amtlbl">earned so far</span>
          </div>
          <span class="earn-tier">🎉 ₹{cash?.currentTier ?? 100} per friend{#if (cash?.verifiedCount ?? 0) < 25} · first 25{/if}</span>
          <div class="earn-pend">₹{cash?.pendingInr ?? 0} pending · ₹{cash?.paidInr ?? 0} paid · sent to your UPI once she's verified</div>
        </div>

        <!-- Cap progress -->
        <div class="capwrap">
          <div class="cap-lbl"><span>Rewarded invites</span><span>{cash?.verifiedCount ?? 0} / {cash?.cap ?? 100}</span></div>
          <div class="capbar"><i style="width:{capPct}%"></i></div>
        </div>

        <!-- Mood -->
        <div class="lbl-h">How do you want to word it?</div>
        <div class="moods">
          <button class="mood" class:on={mood === 'networking'} onclick={() => selectMood('networking')}>
            <span class="mic">🤝</span><span class="mn">Networking</span>
          </button>
          <button class="mood" class:on={mood === 'casual'} onclick={() => selectMood('casual')}>
            <span class="mic">✨</span><span class="mn">Casual</span>
          </button>
          <button class="mood" class:on={mood === 'serious'} onclick={() => selectMood('serious')}>
            <span class="mic">💍</span><span class="mn">Serious</span>
          </button>
        </div>

        <!-- Share -->
        <div class="share">
          <button class="btn wa" onclick={() => shareWhatsApp(womenMsg)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></svg>
            Share on WhatsApp
          </button>
          <button class="btn ghost" onclick={() => copy(womenLink(mood), 'link')}>
            {copiedLink ? 'Copied ✓' : 'Copy link'}
          </button>
        </div>

        <!-- Editable pre-filled message -->
        <div class="msg">
          <div class="msg-head">
            <span class="lbl">What she'll see</span>
            <button class="mini" onclick={() => copy(womenMsg, 'msg')}>{copiedMsg ? 'Copied ✓' : 'Copy message'}</button>
          </div>
          <textarea bind:value={womenMsg} rows="6" aria-label="Message to send"></textarea>
          <p class="hint">Each mood also sends her to a matching page. Edit before you send.</p>
        </div>
      {/if}
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

  /* Tab toggle */
  .toggle {
    display: flex;
    gap: 4px;
    background: var(--bg-3);
    border: 1px solid var(--border-1);
    border-radius: 999px;
    padding: 4px;
    margin-bottom: 20px;
  }
  .toggle button {
    flex: 1;
    border: none;
    background: none;
    font-family: inherit;
    font-weight: 700;
    font-size: 13px;
    padding: 9px 6px;
    border-radius: 999px;
    color: var(--text-2);
    cursor: pointer;
  }
  .toggle button.on { background: var(--accent); color: #fff; }

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
  .upside {
    background: var(--accent-tint);
    border: 1px solid var(--accent-dim);
    border-radius: var(--r-md);
    padding: 12px 14px;
    font-size: 13.5px;
    font-weight: 650;
    color: var(--accent-bright);
    line-height: 1.4;
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

  /* Women — earnings */
  .earn {
    border-radius: var(--r-md);
    padding: 16px;
    margin-bottom: 12px;
    background: linear-gradient(135deg, #FFF6E8, var(--accent-dim));
    border: 1px solid var(--accent-dim);
  }
  .earn-top { display: flex; align-items: baseline; gap: 8px; }
  .earn-top .amt { font-size: 30px; font-weight: 800; letter-spacing: -0.02em; color: var(--text-1); font-variant-numeric: tabular-nums; }
  .earn-top .amtlbl { font-size: 13px; color: var(--text-2); font-weight: 600; }
  .earn-tier {
    margin-top: 8px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-2);
    color: var(--accent-bright);
    font-size: 12px;
    font-weight: 700;
    padding: 5px 10px;
    border-radius: 999px;
  }
  .earn-pend { margin-top: 8px; font-size: 12px; color: var(--text-2); }

  .capwrap { margin-bottom: 20px; }
  .cap-lbl { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-2); margin-bottom: 6px; font-weight: 600; }
  .capbar { height: 8px; border-radius: 999px; background: var(--bg-3); overflow: hidden; }
  .capbar i { display: block; height: 100%; background: var(--accent); border-radius: 999px; }

  /* Women — mood */
  .lbl-h { font-size: 11px; font-weight: 750; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); margin-bottom: 8px; }
  .moods { display: flex; gap: 8px; margin-bottom: 18px; }
  .mood {
    flex: 1;
    border: 1px solid var(--border-2);
    background: var(--bg-2);
    border-radius: var(--r-md);
    padding: 11px 6px;
    text-align: center;
    cursor: pointer;
    font-family: inherit;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .mood.on { border-color: var(--accent); background: var(--accent-tint); }
  .mood .mic { font-size: 18px; }
  .mood .mn { font-size: 11.5px; font-weight: 700; color: var(--text-2); }
  .mood.on .mn { color: var(--accent-bright); }

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
