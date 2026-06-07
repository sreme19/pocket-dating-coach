<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Capacitor } from '@capacitor/core';
  import { getSupabaseClient } from '$lib/client/supabase';
  import '$lib/marketing/vv-landing.css';

  // App entry points the CTAs link to
  const GET_VERIFIED = '/verified-vibe/gate';
  const SIGN_IN = '/verified-vibe/auth?mode=signin';
  const PRIVACY = '/verified-vibe/privacy';

  onMount(() => {
    // This is the public marketing page — web browsers only. Inside the native
    // Capacitor app it must never be shown, so route straight into the app:
    // signed-in users land on Discover (the layout's auth guard validates the
    // session/verification state), everyone else hits the onboarding gate.
    if (Capacitor.isNativePlatform()) {
      getSupabaseClient()
        .auth.getSession()
        .then(({ data: { session } }) => {
          goto(session ? '/verified-vibe/discover' : '/verified-vibe/gate', { replaceState: true });
        })
        .catch(() => goto('/verified-vibe/gate', { replaceState: true }));
      return;
    }

    const root = document.getElementById('vv-page');
    const nav = document.getElementById('nav');
    if (!root) return;

    // ---- Nav elevation on scroll ----
    const onScroll = () => nav?.classList.toggle('scrolled', window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---- Reveal-on-scroll ----
    const reveals = Array.from(root.querySelectorAll<HTMLElement>('.reveal'));
    // Anything already in (or near) the viewport reveals immediately and
    // synchronously, so above-the-fold content never flashes blank while we
    // wait on the (async) IntersectionObserver callback.
    const revealInView = () => {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      for (const el of reveals) {
        if (el.classList.contains('in')) continue;
        if (el.getBoundingClientRect().top < vh * 0.92) el.classList.add('in');
      }
    };
    revealInView();

    const revealIO =
      'IntersectionObserver' in window
        ? new IntersectionObserver(
            (entries) => {
              for (const e of entries) {
                if (e.isIntersecting) {
                  e.target.classList.add('in');
                  revealIO!.unobserve(e.target);
                }
              }
            },
            { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
          )
        : null;
    if (revealIO) reveals.forEach((el) => revealIO.observe(el));
    else reveals.forEach((el) => el.classList.add('in')); // no-IO fallback
    window.addEventListener('scroll', revealInView, { passive: true });

    // ---- Stepped demo sequences ----
    const timers: ReturnType<typeof setTimeout>[] = [];
    function runSteps(container: Element | null, gap: number, base = 250) {
      if (!container) return;
      container.querySelectorAll<HTMLElement>('[data-step]').forEach((el) => {
        const step = parseInt(el.getAttribute('data-step') || '1', 10) || 1;
        if (reduceMotion) {
          el.classList.add('show');
        } else {
          timers.push(setTimeout(() => el.classList.add('show'), base + step * gap));
        }
      });
    }

    // ---- One-shot trigger when an element scrolls into view ----
    function once(el: Element | null, cb: () => void, threshold = 0.4) {
      if (!el) return;
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              cb();
              io.disconnect();
            }
          }
        },
        { threshold }
      );
      io.observe(el);
    }

    // Trust meter: fill segments + count up to 94
    const meter = document.getElementById('trust-meter');
    const meterNum = document.getElementById('meter-num');
    once(meter, () => {
      meter?.classList.add('run');
      if (!meterNum) return;
      if (reduceMotion) {
        meterNum.textContent = '94';
        return;
      }
      const target = 94;
      const steps = 36;
      let i = 0;
      const iv = setInterval(() => {
        i++;
        const p = i / steps;
        const eased = 1 - Math.pow(1 - p, 3);
        meterNum.textContent = String(Math.round(eased * target));
        if (i >= steps) {
          meterNum.textContent = String(target);
          clearInterval(iv);
        }
      }, 34);
    });

    once(document.getElementById('bestie-phone'), () =>
      runSteps(document.getElementById('bestie-chat'), 750)
    );
    once(document.getElementById('wingman-build'), () =>
      runSteps(document.getElementById('wingman-build'), 480)
    );

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', revealInView);
      revealIO?.disconnect();
      timers.forEach(clearTimeout);
    };
  });
</script>

<svelte:head>
  <title>Verified Vibe — Verified, not vibes.</title>
  <meta
    name="description"
    content="The dating app where every match is identity-verified — and a personal AI coach reads every message, so you skip the games and the guessing."
  />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<!-- ===== ICON SPRITE ===== -->
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="ic-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></symbol>
  <symbol id="ic-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></symbol>
  <symbol id="ic-heart" viewBox="0 0 24 24" fill="currentColor"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.49 4.04 3 5.5l7 7Z"/></symbol>
  <symbol id="ic-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></symbol>
  <symbol id="ic-zap" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4.1 12.9c-.6.7-.1 1.6.8 1.6H11l-1 7.5 8.9-10.9c.6-.7.1-1.6-.8-1.6H12z"/></symbol>
  <symbol id="ic-id" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M5.5 16.3c.5-1.4 1.4-2.1 2.5-2.1s2 .7 2.5 2.1"/><line x1="14" y1="10" x2="18" y2="10"/><line x1="14" y1="14" x2="18" y2="14"/></symbol>
  <symbol id="ic-scan" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="10.5" r="2.3"/><path d="M8.4 16c.6-1.4 2-2.3 3.6-2.3s3 .9 3.6 2.3"/></symbol>
  <symbol id="ic-image" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-4.5-4.5L5 21"/></symbol>
  <symbol id="ic-target" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></symbol>
  <symbol id="ic-sparkles" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5 13.7 8 19 9.7 13.7 11.4 12 17 10.3 11.4 5 9.7 10.3 8z"/><path d="M19 13.5 19.9 16 22.5 17 19.9 18 19 20.5 18.1 18 15.5 17 18.1 16z"/></symbol>
  <symbol id="ic-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></symbol>
  <symbol id="ic-msg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></symbol>
  <symbol id="ic-link" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></symbol>
  <symbol id="ic-wallet" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/><path d="M21 12a2 2 0 0 0-2-2h-3a2 2 0 0 0 0 4h3a2 2 0 0 0 2-2z"/></symbol>
  <symbol id="ic-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></symbol>
  <symbol id="ic-users" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13A4 4 0 0 1 16 11"/></symbol>
  <symbol id="ic-flag" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4s1-1 4-1 5 2 8 2 4-1 4-1v11s-1 1-4 1-5-2-8-2-4 1-4 1"/></symbol>
  <symbol id="ic-alert" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></symbol>
  <symbol id="ic-apple" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 2c.1 1-.3 2-1 2.7-.7.8-1.8 1.4-2.8 1.3-.1-1 .4-2 1-2.6.7-.8 1.9-1.4 2.8-1.4zM19 17.5c-.5 1.2-.8 1.7-1.4 2.7-.9 1.4-2.2 3.1-3.8 3.1-1.4 0-1.8-.9-3.7-.9s-2.3.9-3.7.9c-1.6 0-2.8-1.6-3.7-3C.8 17.8.5 13.3 2.3 11c1-1.3 2.4-2 3.7-2 1.5 0 2.4.9 3.7.9 1.2 0 2-.9 3.7-.9 1.2 0 2.5.6 3.4 1.7-3 1.7-2.5 6 .2 7.3z"/></symbol>
  <symbol id="ic-play" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3.5c-.3.2-.5.5-.5 1v15c0 .5.2.8.5 1L13 12 5 3.5z"/><path d="M15.5 9.3 6.6 3.1 14.1 10.5zM6.6 20.9l8.9-6.2-1.4-1.2zM18.7 10.2l-2.6-1.5L13.4 11l2.7 2.3 2.6-1.5c.7-.4.7-1.2 0-1.6z"/></symbol>
  <symbol id="ic-x" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h4.5l4 5.6L16 3h4l-6.4 7.9L21 21h-4.5l-4.4-6.1L7 21H3l6.8-8.4z"/></symbol>
  <symbol id="ic-ig" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1.1" fill="currentColor" stroke="none"/></symbol>
  <symbol id="ic-tiktok" viewBox="0 0 24 24" fill="currentColor"><path d="M16 3c.3 2 1.6 3.6 3.6 3.9V9c-1.4 0-2.7-.4-3.6-1.1V14a5 5 0 1 1-5-5c.3 0 .7 0 1 .1v2.3a2.8 2.8 0 1 0 2 2.6V3z"/></symbol>
</svg>

<div class="vv-page" id="vv-page">

  <!-- ===== NAV ===== -->
  <nav class="nav" id="nav">
    <a class="logo" href="#top">
      <span class="logo__mark"><svg><use href="#ic-shield"/></svg></span>
      <span class="logo__text">Verified&nbsp;<b>Vibe</b></span>
    </a>
    <div class="nav__links">
      <a href="#how">How it works</a>
      <a href="#trust">Trust</a>
      <a href="#bestie">For Her</a>
      <a href="#wingman">For Him</a>
      <a href="#safety">Safety</a>
    </div>
    <div class="nav__right">
      <a class="nav__signin" href={SIGN_IN}>Sign in</a>
      <a class="btn btn--primary" href={GET_VERIFIED}><svg><use href="#ic-shield"/></svg>Get verified</a>
    </div>
  </nav>

  <!-- ===== HERO ===== -->
  <header class="hero" id="top">
    <div class="hero__bg"></div>
    <div class="wrap">
      <div class="hero__grid">
        <div class="hero__copy">
          <span class="hero__pill reveal"><span class="dot"></span> <b>100% identity-verified</b> members</span>
          <h1 class="reveal d1">No swipes. Ever. Just <span class="accent">matches.</span></h1>
          <p class="hero__sub reveal d2">The dating app where every match is identity-verified — and a personal AI coach reads every message, so you skip the games and the guessing.</p>
          <div class="hero__cta reveal d3">
            <a class="btn btn--primary btn--lg" href={GET_VERIFIED}><svg><use href="#ic-shield"/></svg>Get verified — it's free</a>
          </div>
          <div class="badges reveal d3">
            <a class="store store--soon" href="#"><svg><use href="#ic-apple"/></svg><span><small>Coming to</small><strong>App Store</strong></span></a>
            <a class="store" href="#"><svg><use href="#ic-play"/></svg><span><small>Get it on</small><strong>Google Play</strong></span></a>
          </div>
          <p class="hero__note reveal d4"><svg><use href="#ic-lock"/></svg> We verify ID, photos, spending &amp; intent. You see the signals — never the raw files.</p>
        </div>

        <div class="hero__stage reveal d2">
          <div class="collage">
            <div class="pcard collage__c1">
              <img class="img-slot" src="/female_profiles/priya_High_Value_Feminist_f2k7zt/photos/Priya_5.jpg" alt="Verified member Priya" loading="lazy" />
              <div class="pcard__grad"></div>
              <div class="pcard__top"><span class="arch-chip">🌱 Rebound-Healing</span><span class="trust-badge"><span class="ring"><svg><use href="#ic-check"/></svg></span><span class="score">88</span></span></div>
              <div class="pcard__bot"><div class="pcard__name">Priya, 27</div><div class="pcard__meta">Verified · 2.4 mi away</div></div>
            </div>
            <div class="pcard collage__c2">
              <img class="img-slot" src="/female_profiles/anjali_Traditional_Family_First_g3s7mn/photos/Anjali_1.jpg" alt="Verified member Maya" loading="lazy" />
              <div class="pcard__grad"></div>
              <div class="pcard__top"><span class="arch-chip">💍 Forever-Focused</span><span class="trust-badge"><span class="ring"><svg><use href="#ic-check"/></svg></span><span class="score">94</span></span></div>
              <div class="pcard__bot"><div class="pcard__name">Maya, 29</div><div class="pcard__meta">Verified · 1.1 mi away</div></div>
            </div>
            <div class="pcard collage__c3">
              <img class="img-slot" src="/male_profiles/ethan_Golden_Retriever_q7n5wc/photos/Ethan_1.jpg" alt="Verified member Jordan" loading="lazy" />
              <div class="pcard__grad"></div>
              <div class="pcard__top"><span class="arch-chip">💞 Hopeless-Romantic</span><span class="trust-badge"><span class="ring"><svg><use href="#ic-check"/></svg></span><span class="score">91</span></span></div>
              <div class="pcard__bot"><div class="pcard__name">Jordan, 31</div><div class="pcard__meta">Verified · 3.0 mi away</div></div>
            </div>
            <span class="chip float-chip fc-1"><svg style="width:16px;height:16px;color:var(--vv-emerald)"><use href="#ic-id"/></svg> ID &amp; liveness verified</span>
            <div class="signal-mini float-chip fc-2"><span class="ic sev-flag"><svg style="width:15px;height:15px"><use href="#ic-flag"/></svg></span> Bestie caught a red flag</div>
            <span class="chip float-chip fc-3"><svg style="width:16px;height:16px;color:var(--vv-emerald)"><use href="#ic-check"/></svg> Photos match the person</span>
          </div>
        </div>
      </div>
    </div>
  </header>

  <!-- ===== TRUST STRIP ===== -->
  <section class="trust" id="trust">
    <div class="wrap">
      <div class="trust__head">
        <span class="eyebrow reveal">Verified, not vibes</span>
        <h2 class="h-sec reveal d1">Four checks. One Trust Score.</h2>
        <p class="sub reveal d2" style="margin-top:16px">Everyone earns a public score from 0–100. Each verification is worth 25 points — so a glance tells you exactly how real someone is.</p>
      </div>
      <div class="trust__inner">
        <div class="steps4">
          <div class="vstep reveal"><span class="pts">+25</span><span class="ic"><svg><use href="#ic-id"/></svg></span><h4>Government ID</h4><p>Real legal identity, checked against the document.</p></div>
          <div class="vstep reveal d1"><span class="pts">+25</span><span class="ic"><svg><use href="#ic-scan"/></svg></span><h4>Liveness selfie</h4><p>A live face scan proves it's a real person, right now.</p></div>
          <div class="vstep reveal d2"><span class="pts">+25</span><span class="ic"><svg><use href="#ic-image"/></svg></span><h4>Photo match</h4><p>Profile photos are confirmed to be the same person.</p></div>
          <div class="vstep reveal d3"><span class="pts">+25</span><span class="ic"><svg><use href="#ic-target"/></svg></span><h4>Declared intent</h4><p>What they're here for, stated up front — no guessing.</p></div>
        </div>
        <div class="meter reveal d2" id="trust-meter">
          <div class="meter__row">
            <span class="meter__av"><img class="img-slot" src="/female_profiles/anjali_Traditional_Family_First_g3s7mn/photos/Anjali_2.jpg" alt="Maya" loading="lazy" /></span>
            <div class="meter__who"><b>Maya, 29</b><span>Forever-Focused · verified</span></div>
            <div class="meter__score"><b id="meter-num">0</b><span>/ 100</span></div>
          </div>
          <div class="meter__bar"><span class="meter__seg"></span><span class="meter__seg"></span><span class="meter__seg"></span><span class="meter__seg"></span></div>
          <div class="meter__legend"><span>ID</span><span>Liveness</span><span>Photos</span><span>Intent</span></div>
        </div>
      </div>
    </div>
  </section>

  <!-- ===== HOW IT WORKS ===== -->
  <section class="how" id="how">
    <div class="wrap">
      <div class="how__head">
        <div>
          <span class="eyebrow reveal">How it works</span>
          <h2 class="h-sec reveal d1">Earn your profile.<br>Prove your intent.</h2>
        </div>
        <p class="sub reveal d2">Low friction, high signal. You build a profile worth trusting before you ever swipe.</p>
      </div>
      <div class="how__steps">
        <div class="hstep reveal">
          <div class="hstep__n">STEP 01</div>
          <div class="hstep__card">
            <span class="hstep__ic"><svg><use href="#ic-id"/></svg></span>
            <h3>Verify yourself</h3>
            <p>Scan your ID, take a liveness selfie, and confirm your photos. It takes a minute and it's done once.</p>
            <div class="hstep__tags"><span>Gov ID</span><span>Liveness</span><span>Photo match</span></div>
          </div>
          <svg class="hstep__line" width="24" height="24"><use href="#ic-arrow"/></svg>
        </div>
        <div class="hstep reveal d1">
          <div class="hstep__n">STEP 02</div>
          <div class="hstep__card">
            <span class="hstep__ic"><svg><use href="#ic-target"/></svg></span>
            <h3>Pick your lane</h3>
            <p>Declare what you're actually here for. We only match you with people who want the same thing.</p>
            <div class="hstep__tags"><span>Casual</span><span>Romantic</span><span>Marriage-minded</span><span>Healing</span></div>
          </div>
          <svg class="hstep__line" width="24" height="24"><use href="#ic-arrow"/></svg>
        </div>
        <div class="hstep reveal d2">
          <div class="hstep__n">STEP 03</div>
          <div class="hstep__card">
            <span class="hstep__ic"><svg><use href="#ic-sparkles"/></svg></span>
            <h3>Match &amp; get coached</h3>
            <p>Your AI Bestie or Wingman reads the room — flagging red flags, drafting replies, and keeping it real.</p>
            <div class="hstep__tags"><span>AI Bestie</span><span>AI Wingman</span></div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ===== AI COACH ===== -->
  <section class="coach" id="coach">
    <div class="wrap">
      <div class="coach__head">
        <span class="eyebrow reveal">Meet your AI coach</span>
        <h2 class="h-sec reveal d1">The emotional heavy lifting?<br>That's handled.</h2>
        <p class="sub reveal d2" style="margin-top:16px">Two coaches, built for how people actually date. They never fake anything — they just help you see clearly.</p>
      </div>

      <!-- AI BESTIE -->
      <div class="feature bestie" id="bestie">
        <div class="feature__copy reveal">
          <span class="feature__eyebrow"><span class="av"><svg style="width:16px;height:16px"><use href="#ic-heart"/></svg></span>AI Bestie · for her</span>
          <h3>Your AI Bestie knows the red flags you'd miss.</h3>
          <p class="lead">She reads every incoming message, calls out the vibe, and drafts a reply in your voice — so you stay in control without the mental load.</p>
          <ul class="flist">
            <li><span class="tick"><svg><use href="#ic-check"/></svg></span><span>Flags every message as <b>✅ genuine</b>, <b>⚠️ vague</b>, or <b>🚩 red flag</b></span></li>
            <li><span class="tick"><svg><use href="#ic-check"/></svg></span>Drafts replies that sound like you, not a bot</li>
            <li><span class="tick"><svg><use href="#ic-check"/></svg></span>Summarizes a match before you waste a week on them</li>
          </ul>
        </div>
        <div class="feature__media reveal d1">
          <div class="phone" id="bestie-phone">
            <div class="phone__bar">
              <span class="av"><svg style="width:20px;height:20px"><use href="#ic-heart"/></svg></span>
              <div><b>Marcus</b><small><svg style="width:13px;height:13px"><use href="#ic-check"/></svg> Verified · Trust 86</small></div>
            </div>
            <div class="phone__body" id="bestie-chat">
              <div class="bubble them" data-step="1">hey gorgeous 😍 you single? was thinking we skip the small talk</div>
              <div class="bubble them" data-step="1" style="margin-top:-4px">my place tonight? trust me you won't regret it</div>
              <div class="signal-card" data-step="2">
                <div class="signal-card__top"><span class="signal-card__flag sev-flag"><svg style="width:14px;height:14px"><use href="#ic-flag"/></svg></span><span class="txt-flag">Red flag · moving too fast</span></div>
                <p>Pushing to meet privately within two messages and dodging any real conversation. Classic pressure pattern.</p>
                <div class="draft"><b>Bestie drafted a reply</b>"Appreciate the confidence, but I move at my own pace. Tell me something real about you first 🙂"</div>
              </div>
              <div class="bubble me" data-step="3">Appreciate the confidence, but I move at my own pace 🙂</div>
            </div>
          </div>
        </div>
      </div>

      <!-- AI WINGMAN -->
      <div class="feature wingman feature--rev" id="wingman">
        <div class="feature__copy reveal">
          <span class="feature__eyebrow"><span class="av"><svg style="width:16px;height:16px"><use href="#ic-shield"/></svg></span>AI Wingman · for him</span>
          <h3>No faking it. Build a profile you can back up.</h3>
          <p class="lead">Your Wingman turns real proof into a profile that stands out — then coaches your conversations so you lead with substance, not lines.</p>
          <ul class="flist">
            <li><span class="tick"><svg><use href="#ic-check"/></svg></span><span>Builds a <b>proof-backed</b> profile from things you can actually verify</span></li>
            <li><span class="tick"><svg><use href="#ic-check"/></svg></span>Coaches conversations in real time — fewer dead ends</li>
            <li><span class="tick"><svg><use href="#ic-check"/></svg></span>Raises your Trust Score the honest way</li>
          </ul>
        </div>
        <div class="feature__media reveal d1">
          <div class="buildcard" id="wingman-build">
            <div class="buildcard__hd">
              <span class="buildcard__av"><img class="img-slot" src="/male_profiles/daniel_Emotionally_Available_v2r6ys/photos/Daniel_5.jpg" alt="Daniel" loading="lazy" /></span>
              <div><b>Daniel, 32</b><span class="trust-badge tb"><span class="ring"><svg><use href="#ic-check"/></svg></span><span class="score">92</span></span></div>
            </div>
            <div class="buildcard__body">
              <div class="proof" data-step="1"><span class="proof__ic"><svg><use href="#ic-link"/></svg></span><div><b>Career Highlights</b><small>Verified via LinkedIn</small></div><span class="proof__ok"><svg><use href="#ic-check"/></svg> Proven</span></div>
              <div class="proof" data-step="2"><span class="proof__ic"><svg><use href="#ic-wallet"/></svg></span><div><b>Money Matters</b><small>Confirmed from statements</small></div><span class="proof__ok"><svg><use href="#ic-check"/></svg> Proven</span></div>
              <div class="proof" data-step="3"><span class="proof__ic"><svg><use href="#ic-id"/></svg></span><div><b>Identity &amp; photos</b><small>ID + liveness + photo match</small></div><span class="proof__ok"><svg><use href="#ic-check"/></svg> Proven</span></div>
              <div class="coach-tip" data-step="4"><span class="av"><svg style="width:15px;height:15px"><use href="#ic-shield"/></svg></span><p><b>Wingman:</b> Your hiking photos are getting the most attention — lead with the trail story, not the resume.</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ===== SAFETY (dark) ===== -->
  <section class="safety" id="safety">
    <div class="wrap">
      <div class="safety__head">
        <span class="eyebrow reveal">Under the hood</span>
        <h2 class="reveal d1">Built to be trusted. Engineered to stay private.</h2>
        <p class="safety__sub reveal d2">We do the verification so you don't have to take anyone's word for it. And we share signals — never your raw documents.</p>
      </div>
      <div class="safety__grid">
        <div class="scard reveal"><span class="scard__ic"><svg><use href="#ic-shield"/></svg></span><h4>ID-verified, no exceptions</h4><p>Every single member clears government ID and a live selfie before they can match. No bots, no catfish, no exceptions.</p></div>
        <div class="scard reveal d1"><span class="scard__ic"><svg><use href="#ic-lock"/></svg></span><h4>Privacy-first by design</h4><p>Your documents are processed to produce signals, then locked away. Matches see the verdict, never the file.</p></div>
        <div class="scard reveal d2"><span class="scard__ic"><svg><use href="#ic-eye"/></svg></span><h4>You control what's shared</h4><p>Proof-gated claims only appear if you opt in. Career, finances, intent — your call, every time.</p></div>
      </div>

      <div class="flow reveal">
        <div class="flow__box">
          <b>What you submit</b>
          <span>processed privately</span>
          <div class="flow__files">
            <span class="flow__file"><svg><use href="#ic-id"/></svg> Gov ID</span>
            <span class="flow__file"><svg><use href="#ic-image"/></svg> Photos</span>
            <span class="flow__file"><svg><use href="#ic-wallet"/></svg> Statements</span>
          </div>
        </div>
        <svg class="flow__arrow" width="28" height="28"><use href="#ic-arrow"/></svg>
        <div class="flow__lock"><svg><use href="#ic-lock"/></svg></div>
        <svg class="flow__arrow" width="28" height="28"><use href="#ic-arrow"/></svg>
        <div class="flow__box">
          <b>What others see</b>
          <span>signals only</span>
          <div class="flow__sig">
            <span>✓ Verified</span><span>Trust 92</span><span>💍 Forever-Focused</span>
          </div>
        </div>
      </div>

      <div class="safety__foot">
        <div class="age-gate">
          <span class="age-gate__badge">18+</span>
          <div><b>Adults only.</b><span>Verified Vibe is strictly 18+. Age is confirmed at verification.</span></div>
        </div>
        <a class="plink" href={PRIVACY}><svg style="width:17px;height:17px"><use href="#ic-lock"/></svg> Read our Privacy Policy</a>
        <a class="btn btn--primary" href={GET_VERIFIED}><svg><use href="#ic-shield"/></svg>Get verified</a>
      </div>
    </div>
  </section>

  <!-- ===== FOOTER ===== -->
  <footer class="footer">
    <div class="wrap">
      <div class="footer__top">
        <div class="footer__brand">
          <a class="logo" href="#top">
            <span class="logo__mark"><svg><use href="#ic-shield"/></svg></span>
            <span class="logo__text">Verified&nbsp;<b>Vibe</b></span>
          </a>
          <p class="footer__blurb">Dating with the receipts. Every match identity-verified, every message coached. By Pocket Dating Coach.</p>
          <div class="badges">
            <a class="store store--soon" href="#"><svg><use href="#ic-apple"/></svg><span><small>Coming to</small><strong>App Store</strong></span></a>
            <a class="store" href="#"><svg><use href="#ic-play"/></svg><span><small>Get it on</small><strong>Google Play</strong></span></a>
          </div>
        </div>
        <div class="footer__col"><h5>Date</h5><a href="#how">How it works</a><a href="#trust">Trust Score</a><a href="#bestie">AI Bestie</a><a href="#wingman">AI Wingman</a></div>
        <div class="footer__col"><h5>Trust</h5><a href="#safety">Safety</a><a href={GET_VERIFIED}>Verification</a><a href={PRIVACY}>Privacy Policy</a><a href="#">Community guidelines</a></div>
        <div class="footer__col"><h5>Company</h5><a href="#">About</a><a href="#">Careers</a><a href="#">Support</a><a href="#">Press</a></div>
      </div>
      <div class="footer__bottom">
        <p class="footer__legal">© 2026 Pocket Dating Coach, Inc. · Verified Vibe, Trust Score, AI Bestie &amp; AI Wingman are marks of Pocket Dating Coach. Must be 18+ to join. Dating involves real-world risk; always meet safely.</p>
        <div class="footer__social">
          <a href="#" aria-label="Instagram"><svg><use href="#ic-ig"/></svg></a>
          <a href="#" aria-label="X"><svg><use href="#ic-x"/></svg></a>
          <a href="#" aria-label="TikTok"><svg><use href="#ic-tiktok"/></svg></a>
        </div>
      </div>
    </div>
  </footer>

</div>
