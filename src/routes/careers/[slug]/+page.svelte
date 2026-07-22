<script lang="ts">
  import { onMount } from 'svelte';
  import '$lib/marketing/vv-landing.css';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const role = data.role;

  const GET_VERIFIED = '/verified-vibe/gate';

  // ---- application form state ----
  let name = $state('');
  let phone = $state('');
  let email = $state('');
  let cover = $state('');
  let resumeName = $state('');
  let resumeFile: File | null = null;
  let submitting = $state(false);
  let done = $state(false);
  let errorMsg = $state('');
  let formEl: HTMLFormElement;

  function onResumeChange(e: Event) {
    const input = e.target as HTMLInputElement;
    resumeFile = input.files?.[0] ?? null;
    resumeName = resumeFile?.name ?? '';
  }

  function scrollToApply() {
    document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth' });
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    errorMsg = '';
    if (!name.trim()) return (errorMsg = 'Please enter your name.');
    if (!phone.trim()) return (errorMsg = 'Please enter your phone number.');

    submitting = true;
    try {
      const fd = new FormData();
      fd.set('name', name.trim());
      fd.set('phone', phone.trim());
      if (email.trim()) fd.set('email', email.trim());
      if (cover.trim()) fd.set('cover', cover.trim());
      fd.set('role', role.title);
      fd.set('slug', role.slug);
      if (resumeFile) fd.set('resume', resumeFile);

      const resp = await fetch('/api/careers/apply', { method: 'POST', body: fd });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(body?.error || 'Something went wrong. Please try again.');
      done = true;
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
    } finally {
      submitting = false;
    }
  }

  onMount(() => {
    const nav = document.getElementById('nav');
    const onScroll = () => nav?.classList.toggle('scrolled', window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  });
</script>

<svelte:head>
  <title>{role.title} — Careers at riteangle</title>
  <meta name="description" content={role.tagline} />
  <meta name="theme-color" content="#FF3B6B" />
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
  <symbol id="ic-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></symbol>
  <symbol id="ic-arrow-l" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></symbol>
  <symbol id="ic-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></symbol>
  <symbol id="ic-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></symbol>
  <symbol id="ic-team" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13A4 4 0 0 1 16 11" /></symbol>
  <symbol id="ic-upload" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></symbol>
</svg>

<div class="vv-page" id="careers-detail">
  <!-- ===== NAV ===== -->
  <nav class="nav" id="nav">
    <a class="logo" href="/">
      <span class="logo__mark"><svg><use href="#ra-mark" /></svg></span>
      <span class="logo__text">rite<b>angle</b></span>
    </a>
    <div class="nav__links">
      <a href="/#how">How it works</a>
      <a href="/#matching">Matching</a>
      <a href="/careers" aria-current="page">Careers</a>
    </div>
    <div class="nav__right">
      <a class="btn btn--primary" href={GET_VERIFIED}><svg><use href="#ra-mark-inv" /></svg>Get verified</a>
    </div>
  </nav>

  <article class="jd">
    <div class="wrap">
      <a class="jd__back" href="/careers"><svg><use href="#ic-arrow-l" /></svg>All roles</a>

      <header class="jd__head">
        <h1>{role.title}</h1>
        <p class="jd__tagline">{role.tagline}</p>
        <div class="jd__meta">
          <span><svg><use href="#ic-team" /></svg>{role.team}</span>
          <span><svg><use href="#ic-pin" /></svg>{role.location}</span>
          <span><svg><use href="#ic-clock" /></svg>{role.type}</span>
        </div>
        <button class="btn btn--primary btn--lg jd__apply-top" onclick={scrollToApply}>Apply for this role</button>
      </header>

      <div class="jd__body">
        <section>
          <h2>About the role</h2>
          {#each role.about as p}<p>{p}</p>{/each}
        </section>

        <section>
          <h2>What you'll do</h2>
          <ul class="jd__list">
            {#each role.responsibilities as item}
              <li><span class="jd__tick"><svg><use href="#ic-check" /></svg></span>{item}</li>
            {/each}
          </ul>
        </section>

        <section>
          <h2>What we're looking for</h2>
          <ul class="jd__list">
            {#each role.requirements as item}
              <li><span class="jd__tick"><svg><use href="#ic-check" /></svg></span>{item}</li>
            {/each}
          </ul>
        </section>

        {#if role.niceToHave.length}
          <section>
            <h2>Nice to have</h2>
            <ul class="jd__list">
              {#each role.niceToHave as item}
                <li><span class="jd__tick"><svg><use href="#ic-check" /></svg></span>{item}</li>
              {/each}
            </ul>
          </section>
        {/if}

        <section>
          <h2>Why riteangle</h2>
          <ul class="jd__list">
            {#each role.offer as item}
              <li><span class="jd__tick"><svg><use href="#ic-check" /></svg></span>{item}</li>
            {/each}
          </ul>
        </section>
      </div>

      <!-- ===== APPLICATION FORM ===== -->
      <section class="apply" id="apply">
        {#if done}
          <div class="apply__done">
            <span class="apply__done-ic"><svg><use href="#ic-check" /></svg></span>
            <h2>Application received</h2>
            <p>Thanks, {name.split(' ')[0] || 'there'} — we've got your application for {role.title}. If it's a fit, we'll reach out{email ? ' by email' : ' by phone'}.</p>
            <a class="btn btn--ghost" href="/careers">Back to all roles</a>
          </div>
        {:else}
          <div class="apply__intro">
            <h2>Apply for this role</h2>
            <p>Takes a minute. Name and phone are all we need to start — a cover note and resume help but are optional.</p>
          </div>
          <form class="apply__form" bind:this={formEl} onsubmit={submit}>
            <div class="field">
              <label for="ap-name">Full name <span class="req">*</span></label>
              <input id="ap-name" type="text" bind:value={name} maxlength="120" autocomplete="name" required placeholder="Your name" />
            </div>
            <div class="field">
              <label for="ap-phone">Phone number <span class="req">*</span></label>
              <input id="ap-phone" type="tel" bind:value={phone} maxlength="40" autocomplete="tel" required placeholder="+62 ..." />
            </div>
            <div class="field">
              <label for="ap-email">Email <span class="opt">(optional)</span></label>
              <input id="ap-email" type="email" bind:value={email} maxlength="160" autocomplete="email" placeholder="you@email.com" />
            </div>
            <div class="field field--full">
              <label for="ap-cover">Cover note <span class="opt">(optional)</span></label>
              <textarea id="ap-cover" bind:value={cover} maxlength="4000" rows="4" placeholder="A few lines on why you'd be great at this — or a campaign you're proud of."></textarea>
            </div>
            <div class="field field--full">
              <label for="ap-resume">Resume <span class="opt">(optional — PDF or Word, max 5 MB)</span></label>
              <label class="upload" for="ap-resume">
                <span class="upload__ic"><svg><use href="#ic-upload" /></svg></span>
                <span class="upload__txt">{resumeName || 'Choose a file'}</span>
              </label>
              <input id="ap-resume" class="upload__input" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onchange={onResumeChange} />
            </div>

            {#if errorMsg}<p class="apply__error">{errorMsg}</p>{/if}

            <div class="field--full apply__submit">
              <button class="btn btn--primary btn--lg" type="submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Submit application'}
              </button>
            </div>
          </form>
        {/if}
      </section>
    </div>
  </article>

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
  .jd .wrap {
    max-width: 820px;
    padding-top: 128px;
    padding-bottom: 40px;
  }
  .jd__back {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-weight: 600;
    font-size: 14.5px;
    color: var(--vv-ink-3);
    text-decoration: none;
    margin-bottom: 26px;
  }
  .jd__back:hover {
    color: var(--vv-pink-deep);
  }
  .jd__back svg {
    width: 17px;
    height: 17px;
  }
  .jd__head {
    padding-bottom: 28px;
    border-bottom: 1px solid var(--vv-line);
  }
  .jd__head h1 {
    font-size: clamp(32px, 5vw, 46px);
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--vv-ink);
    line-height: 1.05;
  }
  .jd__tagline {
    font-size: 19px;
    line-height: 1.5;
    color: var(--vv-ink-2);
    margin: 14px 0 0;
    max-width: 60ch;
  }
  .jd__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 20px;
    margin-top: 20px;
  }
  .jd__meta span {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 14.5px;
    font-weight: 600;
    color: var(--vv-ink-2);
  }
  .jd__meta svg {
    width: 16px;
    height: 16px;
    color: var(--vv-pink);
  }
  .jd__apply-top {
    margin-top: 26px;
  }

  .jd__body section {
    margin-top: 38px;
  }
  .jd__body h2 {
    font-size: 23px;
    font-weight: 800;
    color: var(--vv-ink);
    letter-spacing: -0.02em;
    margin: 0 0 14px;
  }
  .jd__body p {
    font-size: 16.5px;
    line-height: 1.65;
    color: var(--vv-ink-2);
    margin: 0 0 12px;
  }
  .jd__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 12px;
  }
  .jd__list li {
    display: flex;
    gap: 12px;
    font-size: 16.5px;
    line-height: 1.6;
    color: var(--vv-ink-2);
  }
  .jd__tick {
    flex: none;
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    margin-top: 2px;
    border-radius: 999px;
    background: rgba(255, 59, 107, 0.12);
    color: var(--vv-pink-deep);
  }
  .jd__tick svg {
    width: 14px;
    height: 14px;
  }

  /* ---- application form ---- */
  .apply {
    margin-top: 52px;
    padding: 34px;
    background: var(--vv-white);
    border: 1px solid var(--vv-line);
    border-radius: var(--r-5);
    box-shadow: var(--sh-md);
    scroll-margin-top: 96px;
  }
  .apply__intro h2 {
    font-size: 26px;
    font-weight: 800;
    color: var(--vv-ink);
    margin: 0 0 8px;
  }
  .apply__intro p {
    color: var(--vv-ink-3);
    font-size: 15.5px;
    margin: 0 0 24px;
    max-width: 56ch;
  }
  .apply__form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .field--full {
    grid-column: 1 / -1;
  }
  .field label {
    font-size: 14px;
    font-weight: 700;
    color: var(--vv-ink);
  }
  .req {
    color: var(--vv-pink-deep);
  }
  .opt {
    font-weight: 500;
    color: var(--vv-ink-4);
  }
  .field input,
  .field textarea {
    font-family: inherit;
    font-size: 15.5px;
    color: var(--vv-ink);
    background: var(--vv-cream);
    border: 1.5px solid var(--vv-line);
    border-radius: var(--r-3);
    padding: 12px 14px;
    transition: border-color 0.16s ease, box-shadow 0.16s ease;
  }
  .field input:focus,
  .field textarea:focus {
    outline: none;
    border-color: var(--vv-pink);
    box-shadow: 0 0 0 3px rgba(255, 59, 107, 0.14);
  }
  .field textarea {
    resize: vertical;
  }
  .upload {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 13px 15px;
    border: 1.5px dashed var(--vv-line);
    border-radius: var(--r-3);
    background: var(--vv-cream);
    cursor: pointer;
    transition: border-color 0.16s ease, background 0.16s ease;
  }
  .upload:hover {
    border-color: var(--vv-pink);
    background: #fff;
  }
  .upload__ic {
    display: inline-grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: rgba(255, 59, 107, 0.1);
    color: var(--vv-pink-deep);
    flex: none;
  }
  .upload__ic svg {
    width: 18px;
    height: 18px;
  }
  .upload__txt {
    font-size: 14.5px;
    color: var(--vv-ink-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .upload__input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .apply__error {
    grid-column: 1 / -1;
    margin: 0;
    color: #b91c1c;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: var(--r-2);
    padding: 10px 13px;
    font-size: 14.5px;
  }
  .apply__submit {
    margin-top: 4px;
  }
  .apply__submit .btn {
    width: 100%;
  }
  .apply__done {
    text-align: center;
    padding: 22px 10px;
  }
  .apply__done-ic {
    display: inline-grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 999px;
    background: var(--vv-pink);
    color: #fff;
    margin-bottom: 14px;
  }
  .apply__done-ic svg {
    width: 28px;
    height: 28px;
  }
  .apply__done h2 {
    font-size: 24px;
    font-weight: 800;
    color: var(--vv-ink);
    margin: 0 0 8px;
  }
  .apply__done p {
    color: var(--vv-ink-2);
    font-size: 16px;
    line-height: 1.6;
    max-width: 46ch;
    margin: 0 auto 20px;
  }

  @media (max-width: 640px) {
    .apply {
      padding: 22px;
    }
    .apply__form {
      grid-template-columns: 1fr;
    }
  }
</style>
