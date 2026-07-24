<script lang="ts">
  import { onMount } from 'svelte';
  import '$lib/marketing/vv-landing.css';
  import { OPEN_ROLES } from '$lib/marketing/careers';

  const GET_VERIFIED = '/verified-vibe/gate';

  const SITE = 'https://www.riteangle.dating';
  const ogImage = `${SITE}/og/riteangle-careers.png`;

  onMount(() => {
    const nav = document.getElementById('nav');
    const onScroll = () => nav?.classList.toggle('scrolled', window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  });

  // Group roles by team for the listing.
  const teams = Array.from(new Set(OPEN_ROLES.map((r) => r.team)));
</script>

<svelte:head>
  <title>Careers — riteangle</title>
  <meta
    name="description"
    content="Help us build dating that runs on proof, not vibes. See open roles at riteangle across product, growth and trust & safety."
  />
  <meta name="theme-color" content="#FF3B6B" />

  <!-- Open Graph / link preview (WhatsApp, iMessage, Slack, LinkedIn) -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="riteangle" />
  <meta property="og:title" content="Careers at riteangle" />
  <meta
    property="og:description"
    content="Help us build dating that runs on proof, not vibes. See open roles at riteangle."
  />
  <meta property="og:url" content={`${SITE}/careers`} />
  <meta property="og:image" content={ogImage} />
  <meta property="og:image:secure_url" content={ogImage} />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="riteangle — we're hiring" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Careers at riteangle" />
  <meta
    name="twitter:description"
    content="Help us build dating that runs on proof, not vibes. See open roles at riteangle."
  />
  <meta name="twitter:image" content={ogImage} />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Gabarito:wght@400;500;600;700;800;900&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="ra-mark" viewBox="0 0 100 100">
    <g transform="rotate(-10 50 52)" fill="none" stroke-linecap="round">
      <path d="M37,26 L37,72" stroke="#FF7A4D" stroke-width="13" />
      <path d="M37,72 L80,72" stroke="#FF3B6B" stroke-width="13" />
    </g>
    <path d="M12,21 C12,21 3,14.6 3,8.6 C3,5.4 5.3,3.4 7.9,3.4 C9.8,3.4 11.3,4.6 12,5.9 C12.7,4.6 14.2,3.4 16.1,3.4 C18.7,3.4 21,5.4 21,8.6 C21,14.6 12,21 12,21 Z" fill="#E11D54" transform="translate(39.67,22.22) scale(1.778)" />
  </symbol>
  <symbol id="ra-mark-inv" viewBox="0 0 100 100">
    <g transform="rotate(-10 50 52)" fill="none" stroke-linecap="round">
      <path d="M37,26 L37,72" stroke="#fff" stroke-width="13" />
      <path d="M37,72 L80,72" stroke="#fff" stroke-width="13" />
    </g>
    <path d="M12,21 C12,21 3,14.6 3,8.6 C3,5.4 5.3,3.4 7.9,3.4 C9.8,3.4 11.3,4.6 12,5.9 C12.7,4.6 14.2,3.4 16.1,3.4 C18.7,3.4 21,5.4 21,8.6 C21,14.6 12,21 12,21 Z" fill="#fff" transform="translate(39.67,22.22) scale(1.778)" />
  </symbol>
  <symbol id="ic-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></symbol>
  <symbol id="ic-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></symbol>
  <symbol id="ic-heart" viewBox="0 0 24 24" fill="currentColor"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.49 4.04 3 5.5l7 7Z" /></symbol>
  <symbol id="ic-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></symbol>
  <symbol id="ic-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></symbol>
</svg>

<div class="vv-page" id="careers-page">
  <!-- ===== NAV ===== -->
  <nav class="nav" id="nav">
    <a class="logo" href="/">
      <span class="logo__mark"><svg><use href="#ra-mark" /></svg></span>
      <span class="logo__text">rite<b>angle</b></span>
    </a>
    <div class="nav__links">
      <a href="/#how">How it works</a>
      <a href="/#matching">Matching</a>
      <a href="/#trust">Verified</a>
      <a href="/#faq">FAQ</a>
      <a href="/careers" aria-current="page">Careers</a>
    </div>
    <div class="nav__right">
      <a class="btn btn--primary" href={GET_VERIFIED}><svg><use href="#ra-mark-inv" /></svg>Get verified</a>
    </div>
  </nav>

  <!-- ===== HERO ===== -->
  <header class="c-hero">
    <div class="wrap">
      <span class="eyebrow reveal">Careers</span>
      <h1 class="reveal d1">Build dating that runs on <span class="accent">proof</span>, not vibes.</h1>
      <p class="c-hero__sub reveal d2">
        We're a small, senior team making dating safer and more honest — every member identity-verified,
        every match earned. If you want your work to change how millions of people meet, you'll fit right in.
      </p>
      <div class="c-values reveal d3">
        <div class="c-value"><span class="c-value__ic"><svg><use href="#ic-shield" /></svg></span><b>Trust is the product</b><span>Safety and honesty aren't features — they're the whole point.</span></div>
        <div class="c-value"><span class="c-value__ic"><svg><use href="#ic-heart" /></svg></span><b>Real outcomes</b><span>We measure ourselves on real connections, not vanity swipes.</span></div>
        <div class="c-value"><span class="c-value__ic"><svg><use href="#ic-globe" /></svg></span><b>Global, remote-first</b><span>Hire the best people wherever they are. Async by default.</span></div>
      </div>
    </div>
  </header>

  <!-- ===== OPEN ROLES ===== -->
  <section class="c-roles">
    <div class="wrap">
      <div class="c-roles__head reveal">
        <h2 class="h-sec">Open roles</h2>
        <span class="c-roles__count">{OPEN_ROLES.length} open</span>
      </div>

      {#each teams as team}
        <div class="c-team reveal">
          <h3 class="c-team__name">{team}</h3>
          <ul class="c-list">
            {#each OPEN_ROLES.filter((r) => r.team === team) as role}
              <li class="c-list__item">
                <a class="c-role" href={`/careers/${role.slug}`}>
                  <div class="c-role__main">
                    <span class="c-role__title">{role.title}</span>
                    <div class="c-role__meta">
                      <span><svg><use href="#ic-pin" /></svg>{role.location}</span>
                      <span class="c-dot">·</span>
                      <span>{role.type}</span>
                    </div>
                  </div>
                  <span class="c-role__cta">View role <svg><use href="#ic-arrow" /></svg></span>
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/each}

      <div class="c-nofit reveal">
        <div>
          <b>Don't see your role?</b>
          <span>We're always glad to meet exceptional people. Tell us how you'd help.</span>
        </div>
        <a class="btn btn--ghost" href="mailto:chris@wardrobeofamonk.com?subject=General%20application">Reach out</a>
      </div>
    </div>
  </section>

  <!-- ===== FOOTER ===== -->
  <footer class="footer">
    <div class="wrap">
      <div class="footer__bottom" style="border-top:none;padding-top:0">
        <a class="logo" href="/">
          <span class="logo__mark"><svg><use href="#ra-mark-inv" /></svg></span>
          <span class="logo__text">rite<b>angle</b></span>
        </a>
        <p class="footer__legal">© 2026 riteangle, Inc. · Must be 18+ to join. We're an equal-opportunity employer.</p>
      </div>
    </div>
  </footer>
</div>

<style>
  .c-hero {
    padding: 148px 0 56px;
    background:
      radial-gradient(1100px 480px at 80% -10%, rgba(255, 122, 77, 0.14), transparent 60%),
      radial-gradient(900px 420px at 5% 0%, rgba(255, 59, 107, 0.12), transparent 55%);
  }
  .c-hero h1 {
    font-size: clamp(38px, 6vw, 62px);
    font-weight: 800;
    line-height: 1.03;
    max-width: 15ch;
  }
  .c-hero h1 .accent {
    color: var(--vv-pink-deep);
  }
  .c-hero__sub {
    font-size: 20px;
    line-height: 1.55;
    color: var(--vv-ink-2);
    max-width: 640px;
    margin: 22px 0 0;
  }
  .c-values {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 18px;
    margin-top: 44px;
  }
  .c-value {
    background: var(--vv-white);
    border: 1px solid var(--vv-line);
    border-radius: var(--r-4);
    padding: 22px;
    box-shadow: var(--sh-sm);
  }
  .c-value__ic {
    display: inline-grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: linear-gradient(150deg, #ffe3d6, #ffd0dd);
    color: var(--vv-pink-deep);
    margin-bottom: 12px;
  }
  .c-value__ic svg {
    width: 21px;
    height: 21px;
  }
  .c-value b {
    display: block;
    color: var(--vv-ink);
    font-size: 17px;
    margin-bottom: 4px;
  }
  .c-value span {
    font-size: 14.5px;
    line-height: 1.5;
    color: var(--vv-ink-3);
  }

  .c-roles {
    padding: 40px 0 90px;
  }
  .c-roles__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;
  }
  .c-roles__head .h-sec {
    font-size: clamp(30px, 4vw, 44px);
  }
  .c-roles__count {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--vv-pink-deep);
    background: rgba(255, 59, 107, 0.1);
    padding: 6px 13px;
    border-radius: var(--r-pill);
    white-space: nowrap;
  }
  .c-team {
    margin-top: 36px;
  }
  .c-team__name {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--vv-ink-4);
    margin: 0 0 12px;
  }
  .c-list {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 1px solid var(--vv-line);
  }
  .c-role {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 22px 22px 22px 8px;
    border-bottom: 1px solid var(--vv-line);
    text-decoration: none;
    transition: background 0.18s ease, padding 0.18s ease;
    border-radius: var(--r-3);
  }
  .c-role:hover {
    background: var(--vv-white);
    padding-left: 22px;
    box-shadow: var(--sh-sm);
  }
  .c-role__title {
    display: block;
    font-size: 20px;
    font-weight: 700;
    color: var(--vv-ink);
    letter-spacing: -0.01em;
  }
  .c-role__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    font-size: 14.5px;
    color: var(--vv-ink-3);
  }
  .c-role__meta span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .c-role__meta svg {
    width: 15px;
    height: 15px;
    color: var(--vv-pink);
  }
  .c-dot {
    color: var(--vv-ink-4);
  }
  .c-role__cta {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-weight: 700;
    font-size: 15px;
    color: var(--vv-pink-deep);
    white-space: nowrap;
  }
  .c-role__cta svg {
    width: 17px;
    height: 17px;
    transition: transform 0.18s ease;
  }
  .c-role:hover .c-role__cta svg {
    transform: translateX(3px);
  }

  .c-nofit {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
    margin-top: 48px;
    padding: 26px 28px;
    background: var(--vv-surface);
    border: 1px dashed var(--vv-line);
    border-radius: var(--r-5);
  }
  .c-nofit b {
    display: block;
    color: var(--vv-ink);
    font-size: 18px;
  }
  .c-nofit span {
    color: var(--vv-ink-3);
    font-size: 15px;
  }

  /* vv-landing.css hides `.reveal` (opacity:0) until a `.in` class is added by
     scroll JS. On a content page we want everything visible immediately and
     reliably, so force it and layer a gentle one-shot fade on top. */
  :global(#careers-page .reveal) {
    opacity: 1 !important;
    transform: none !important;
    animation: c-fade 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  :global(#careers-page .reveal.d1) {
    animation-delay: 0.06s;
  }
  :global(#careers-page .reveal.d2) {
    animation-delay: 0.12s;
  }
  :global(#careers-page .reveal.d3) {
    animation-delay: 0.18s;
  }
  @keyframes c-fade {
    from {
      opacity: 0;
      transform: translateY(14px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @media (max-width: 820px) {
    .c-values {
      grid-template-columns: 1fr;
    }
    .c-hero {
      padding-top: 120px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .reveal {
      opacity: 1;
      transform: none;
      transition: none;
    }
  }
</style>
