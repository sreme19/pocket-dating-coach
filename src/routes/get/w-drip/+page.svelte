<script lang="ts">
	/**
	 * /get/w-drip — the destination for the Gen1 women's email drip.
	 *
	 * A NEW route rather than an edit to `/get/w`, on purpose: the emails open
	 * with a breakup/move-on line ("Move on toh karna hai, / par dhang se.") and
	 * `/get/w` opens with a calmer "Vetted before he reaches you." register. This
	 * page carries the email's own language through instead of changing the
	 * subject on arrival — see `/get/w-apply`'s header for the precedent of a
	 * separate route over a fork of the `[[audience=aud]]` param.
	 *
	 * ONE lead-capture form, at the very end, never in the hero. `/get/w` shows
	 * the same form twice (hero + footer) because that page's job is to sell from
	 * a cold ad tap. This traffic already opened an email and read a Hinglish
	 * pitch, so the Android tap is the whole ask up top; the form is the quiet
	 * fallback for whoever reads to the end without one.
	 *
	 * No Snap/Meta pixels. Both exist on `/get*` to feed paid-ad optimisation and
	 * conversions APIs; this traffic is email, not a paid ad account, so there is
	 * nothing on either network to report back to. `reportPageView` /
	 * `reportStoreClick` / `submitLead` still fire — those are our own
	 * first-party beacons, not ad-network pixels.
	 */
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import RiteLogo from '$lib/verified-vibe/components/RiteLogo.svelte';
	import { STORE_LINKS } from '$lib/store-links';
	import { reportPageView } from '$lib/marketing/page-view-report';
	import { reportStoreClick } from '$lib/marketing/store-click-report';
	import { submitLead } from '$lib/marketing/lead-report';

	/** Landing-page id for our own measurement. Must match the type union in
	 * page-view-report.ts, the check constraints in the migration that added it,
	 * and the ALLOWED_PAGES/ALLOWED_CTAS sets in the three /api/marketing
	 * endpoints — see that migration's header for why all five places move
	 * together. */
	const PAGE = 'get_w_drip' as const;
	const DEFAULT_CAMPAIGN = 'get_w_drip_lp';

	/**
	 * EVERY USER-FACING STRING LIVES HERE, in one block, on purpose — same
	 * convention as `/get/w-apply`. Hinglish register locked in
	 * `research/outreach/email-drip-sequence.md` (ad-management-agent):
	 * genuine code-switched Hinglish, not English with a sprinkle. The hero line
	 * and lede are Email 1's own opener and bridge line, carried through rather
	 * than rewritten, so the page does not change the subject on arrival.
	 */
	const COPY = {
		h1a: 'Move on toh karna hai,',
		h1b: 'par dhang se.',
		lede: 'Breakup ke baad ka glow? Yahi toh hai. ✨',
		ctaNote: 'Android only right now — iPhone is on the way.',
		chips: ['ID-verified', 'Proof deleted', '18+'],
		proofHeading: ['Not a promise.', 'A measurement.'],
		proof: [
			{ figure: '54%', label: 'Of all messages here, sent by an AI on someone’s behalf' },
			{ figure: '14', label: 'Suitors the median woman here has. You see them in order' },
			{ figure: '2:1', label: 'Our member ratio. Rivals run ~3 men per woman' },
			{ figure: '12 min', label: 'Median time to a first match, for men' }
		],
		momentHeading: 'Sort karne ke liye ek dher nahi.',
		momentCap: 'Ek shortlist — log pehle se vetted hain. Chunna AI karta hai. Tumhe bas aana hai.',
		midHeading: 'Minutes, not months.',
		closeHeading: ['A shortlist that', 'means something.'],
		closeNote: 'One tap. Android only right now.',
		capLead: 'Not on Android, or not today? Leave one line and we will come to you.',
		capNote: 'Used once, to tell you when your invite is ready. Not shared, and 18+ only.',
		faq: [
			{
				q: 'Will an AI feel cold?',
				a: 'It does the asking, so you are not repeating yourself to ten people. It always says it is an AI.'
			},
			{
				q: 'Why would he bother verifying?',
				a: 'Because that is how he reaches your list at all. He proves it, the document is read once and deleted, and you never see it.'
			},
			{ q: 'Is it safe?', a: 'Identity-verified members, strictly 18+, and block or report on every profile.' },
			{ q: 'iPhone?', a: 'Not yet — Android only for now. iPhone is on the way.' }
		]
	} as const;

	const campaign = $derived($page.url.searchParams.get('utm_campaign') || DEFAULT_CAMPAIGN);

	/** Same shape as `/get/w`'s: only utm_* survives onto the install referrer,
	 * plus `ra_lp` so Play Console and our own tables agree on which page sent
	 * the tap. */
	const storeUrl = $derived.by(() => {
		const incoming = new URLSearchParams($page.url.search);
		for (const key of [...incoming.keys()]) {
			if (!key.startsWith('utm_')) incoming.delete(key);
		}
		const referrer = new URLSearchParams(
			incoming.size > 0 ? incoming.toString() : `utm_source=brevo&utm_medium=email&utm_campaign=${DEFAULT_CAMPAIGN}`
		);
		referrer.set('ra_lp', PAGE);
		return `${STORE_LINKS.android}&referrer=${encodeURIComponent(referrer.toString())}`;
	});

	onMount(() => {
		reportPageView({ page: PAGE, campaign, url: $page.url });
	});

	function onStoreClick(cta: string) {
		const eventId = crypto.randomUUID?.() ?? `e-${Date.now()}`;
		reportStoreClick({ eventId, page: PAGE, cta, campaign, url: $page.url });
	}

	// ── Lead capture — the one fallback action, at the foot of the page only.
	let contactKind = $state<'whatsapp' | 'email'>('whatsapp');
	let contact = $state('');
	let sending = $state(false);
	let sent = $state(false);
	let leadError = $state<string | null>(null);

	async function onLeadSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (sending || sent) return;

		const value = contact.trim();
		if (!value) {
			leadError = contactKind === 'whatsapp' ? 'Enter your number.' : 'Enter your email.';
			return;
		}

		sending = true;
		leadError = null;

		const outcome = await submitLead({
			page: PAGE,
			audience: 'woman',
			contactKind,
			value,
			campaign,
			url: $page.url
		});

		sending = false;

		if (outcome.status === 'ok') {
			sent = true;
			contact = '';
			return;
		}
		leadError =
			outcome.status === 'invalid'
				? outcome.field === 'phone'
					? 'That does not look like an Indian mobile number.'
					: 'That does not look like an email address.'
				: 'Something went wrong on our side. Try again?';
	}
</script>

<svelte:head>
	<title>riteangle · Move on, the right way.</title>
	<meta
		name="description"
		content="An identity-verified dating app where an AI does the asking and the vetting for you — and hands you a short list, already in the order you asked for. Early access is open on Android."
	/>
	<meta name="theme-color" content="#FFF3F0" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="riteangle" />
	<meta property="og:title" content="Move on, the right way." />
	<meta
		property="og:description"
		content="An AI does the searching, the asking and the vetting. You just meet. Early access is open on Android."
	/>
	<meta property="og:image" content="/og/riteangle-logo.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Move on, the right way." />
	<meta name="twitter:image" content="/og/riteangle-logo.png" />
</svelte:head>

{#snippet playMark()}
	<span class="cta-ico" aria-hidden="true">
		<svg viewBox="0 0 24 24">
			<path d="M3 2.2 13.4 12H3z" fill="#34A853" />
			<path d="M3 2.2 21 12h-7.6z" fill="#EA4335" />
			<path d="M3 21.8 13.4 12H3z" fill="#4285F4" />
			<path d="M3 21.8 21 12h-7.6z" fill="#FBBC04" />
		</svg>
	</span>
{/snippet}

<div class="pg">
	<!-- ── Hero ──────────────────────────────────────────────────────────── -->
	<header class="hero">
		<div class="wrap">
			<div class="brandrow">
				<RiteLogo mark={true} word={true} markSize={30} />
			</div>

			<h1 class="h1">{COPY.h1a}<br /><em>{COPY.h1b}</em></h1>
			<p class="lede">{COPY.lede}</p>

			<figure class="shot hero-shot">
				<img
					src="/get-w-drip/hero.jpg"
					alt="A woman in a white dress walking a European old-town street, caption reading “High-maintenance?”"
					width="1080"
					height="1920"
					fetchpriority="high"
					decoding="async"
				/>
			</figure>

			<!-- Android is the first, most prominent action — the form below is the
			     quiet fallback, never a competing option at this position. -->
			<a
				class="cta"
				href={storeUrl}
				data-cta="hero"
				target="_blank"
				rel="noopener"
				onclick={() => onStoreClick('hero')}
			>
				{@render playMark()}
				Get the Android app
			</a>
			<p class="cta-note">{COPY.ctaNote}</p>

			<ul class="chips">
				{#each COPY.chips as chip (chip)}
					<li>✓ {chip}</li>
				{/each}
			</ul>
		</div>
	</header>

	<!-- ── Numbers ───────────────────────────────────────────────────────── -->
	<section class="sec tinted">
		<div class="wrap">
			<h2 class="h2">{COPY.proofHeading[0]}<br />{COPY.proofHeading[1]}</h2>
			<div class="proof">
				{#each COPY.proof as p (p.figure)}
					<div class="pcard">
						<div class="fig">{p.figure}</div>
						<div class="plabel">{p.label}</div>
					</div>
				{/each}
			</div>
			<p class="foot">From our own live platform, not an industry report.</p>
		</div>
	</section>

	<!-- ── Moment ────────────────────────────────────────────────────────── -->
	<section class="sec">
		<div class="wrap">
			<h2 class="h2">{COPY.momentHeading}</h2>
			<figure class="shot">
				<img
					src="/get-w-drip/moment.jpg"
					alt="A woman from behind in a green dress on a rooftop restaurant at dusk, caption reading “Meri respect deal pe nahi.”"
					width="1080"
					height="1920"
					loading="lazy"
					decoding="async"
				/>
			</figure>
			<p class="cap">{COPY.momentCap}</p>
		</div>
	</section>

	<!-- ── Mid CTA ───────────────────────────────────────────────────────── -->
	<section class="sec mid">
		<div class="wrap narrow">
			<h2 class="h2 c">{COPY.midHeading}</h2>
			<a
				class="cta"
				href={storeUrl}
				data-cta="mid"
				target="_blank"
				rel="noopener"
				onclick={() => onStoreClick('mid')}
			>
				{@render playMark()}
				Get the Android app
			</a>
		</div>
	</section>

	<!-- ── Objections ────────────────────────────────────────────────────── -->
	<section class="sec">
		<div class="wrap">
			<h2 class="h2">Fair questions</h2>
			<div class="faq">
				{#each COPY.faq as f (f.q)}
					<details class="qa">
						<summary>{f.q}</summary>
						<p class="p">{f.a}</p>
					</details>
				{/each}
			</div>
		</div>
	</section>

	<!-- ── Close ─────────────────────────────────────────────────────────── -->
	<section class="sec close">
		<div class="wrap narrow">
			<figure class="shot">
				<img
					src="/get-w-drip/close.jpg"
					alt="A woman on a tropical beach, caption reading “Tumse na ho paayega.”"
					width="1080"
					height="1920"
					loading="lazy"
					decoding="async"
				/>
			</figure>

			<h2 class="h2 c">{COPY.closeHeading[0]}<br />{COPY.closeHeading[1]}</h2>
			<a
				class="cta"
				href={storeUrl}
				data-cta="footer"
				target="_blank"
				rel="noopener"
				onclick={() => onStoreClick('footer')}
			>
				{@render playMark()}
				Get the Android app
			</a>
			<p class="cta-note c">{COPY.closeNote}</p>

			<!-- The one lead-capture form on the page, and it lives here only. -->
			<div class="cap-box">
				{#if sent}
					<p class="cap-done">
						<strong>You are on the list.</strong> We will message you when your invite is ready — nothing
						else.
					</p>
				{:else}
					<form class="cap-form" onsubmit={onLeadSubmit} novalidate>
						<p class="cap-lead">{COPY.capLead}</p>

						<div class="cap-kind" role="group" aria-label="How should we reach you?">
							<button
								type="button"
								class="cap-tab"
								aria-pressed={contactKind === 'whatsapp'}
								onclick={() => {
									contactKind = 'whatsapp';
									leadError = null;
								}}>WhatsApp</button
							>
							<button
								type="button"
								class="cap-tab"
								aria-pressed={contactKind === 'email'}
								onclick={() => {
									contactKind = 'email';
									leadError = null;
								}}>Email</button
							>
						</div>

						<label class="cap-label" for="cap-drip">
							{contactKind === 'whatsapp' ? 'WhatsApp number' : 'Email address'}
						</label>
						<div class="cap-row">
							<input
								id="cap-drip"
								class="cap-input"
								bind:value={contact}
								type={contactKind === 'whatsapp' ? 'tel' : 'email'}
								inputmode={contactKind === 'whatsapp' ? 'numeric' : 'email'}
								autocomplete={contactKind === 'whatsapp' ? 'tel' : 'email'}
								placeholder={contactKind === 'whatsapp' ? '98765 43210' : 'you@example.com'}
								aria-invalid={leadError ? 'true' : undefined}
								aria-describedby={leadError ? 'cap-err-drip' : 'cap-note-drip'}
								disabled={sending}
							/>
							<button class="cap-go" type="submit" disabled={sending}>
								{sending ? 'Sending…' : 'Send it'}
							</button>
						</div>

						{#if leadError}
							<p class="cap-err" id="cap-err-drip" role="alert">{leadError}</p>
						{:else}
							<p class="cap-note" id="cap-note-drip">{COPY.capNote}</p>
						{/if}
					</form>
				{/if}
			</div>
		</div>
	</section>

	<footer class="ft">
		<div class="wrap">
			<RiteLogo mark={true} word={true} markSize={22} />
			<p class="ftnote">
				Strictly 18+, confirmed at verification. Verification documents are read once and discarded.
			</p>
			<!-- Required, not decorative: compliance.md section 6.2. See /get/w's
			     footer for the full note — same rule, same wording. -->
			<p class="ftnote">Images are AI-generated illustrations. They do not depict members.</p>
			<a class="ftlink" href="/privacy-policy">Privacy</a>
		</div>
	</footer>
</div>

<style>
	:global(body) {
		background: var(--bg-1);
		margin: 0;
	}

	.pg {
		font-family: Gabarito, ui-sans-serif, -apple-system, 'Segoe UI', Roboto, sans-serif;
		color: var(--text-1);
	}

	.wrap {
		max-width: 560px;
		margin: 0 auto;
		padding: 0 22px;
	}

	.narrow {
		max-width: 460px;
	}

	.hero {
		padding: 28px 0 8px;
	}

	.brandrow {
		margin-bottom: 22px;
	}

	.h1 {
		font-size: clamp(28px, 8vw, 38px);
		line-height: 1.15;
		letter-spacing: -0.02em;
		margin: 0 0 10px;
		font-weight: 700;
	}
	.h1 em {
		font-style: normal;
		color: var(--accent);
	}

	.lede {
		font-size: 17px;
		line-height: 1.5;
		color: var(--text-2);
		margin: 0 0 4px;
	}

	.shot {
		margin: 22px 0 0;
		border-radius: 18px;
		overflow: hidden;
		background: var(--bg-2);
		border: 1px solid var(--border-1);
	}
	.shot img {
		display: block;
		width: 100%;
		height: auto;
	}
	.hero-shot {
		margin: 22px 0 26px;
		box-shadow: 0 22px 44px -26px rgba(27, 16, 32, 0.45);
	}

	.cta {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		text-align: center;
		background: var(--text-1);
		color: #fff;
		text-decoration: none;
		font-size: 17px;
		font-weight: 700;
		padding: 17px;
		border-radius: 14px;
	}
	.cta-ico svg {
		width: 20px;
		height: 20px;
		display: block;
	}
	.cta-note {
		font-size: 13px;
		color: var(--text-4);
		text-align: center;
		margin: 10px 0 0;
	}
	.cta-note.c {
		margin: 12px 0 0;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 14px;
		list-style: none;
		margin: 20px 0 0;
		padding: 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-3);
	}

	.sec {
		padding: 40px 0;
	}
	.sec.tinted {
		background: var(--bg-2);
	}
	.sec.mid {
		padding: 24px 0;
		text-align: center;
	}
	.sec.close {
		padding-top: 30px;
	}

	.h2 {
		font-size: clamp(22px, 6vw, 28px);
		line-height: 1.2;
		letter-spacing: -0.01em;
		margin: 0 0 20px;
		font-weight: 700;
	}
	.h2.c {
		text-align: center;
	}

	.cap {
		font-size: 15px;
		line-height: 1.5;
		color: var(--text-2);
		margin: 14px 0 0;
	}

	.proof {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
	}
	.pcard {
		background: var(--bg-1);
		border: 1px solid var(--border-1);
		border-radius: 14px;
		padding: 16px;
	}
	.fig {
		font-size: 26px;
		font-weight: 800;
		color: var(--accent);
	}
	.plabel {
		font-size: 13px;
		color: var(--text-3);
		margin-top: 4px;
		line-height: 1.35;
	}
	.foot {
		font-size: 12px;
		color: var(--text-4);
		margin: 16px 0 0;
	}

	.faq {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.qa {
		border: 1px solid var(--border-1);
		border-radius: 12px;
		padding: 14px 16px;
	}
	.qa summary {
		font-weight: 700;
		cursor: pointer;
	}
	.qa .p {
		margin: 10px 0 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--text-2);
	}

	.cap-box {
		margin: 24px 0 0;
		padding: 16px;
		border-radius: 16px;
		background: var(--bg-2);
		border: 1px solid var(--border-1);
		text-align: left;
	}
	.cap-lead {
		margin: 0 0 12px;
		font-size: 14px;
		line-height: 1.45;
		font-weight: 600;
		color: var(--text-2);
	}
	.cap-kind {
		display: flex;
		gap: 6px;
		margin: 0 0 12px;
	}
	.cap-tab {
		flex: 1;
		min-height: 38px;
		padding: 8px 10px;
		border-radius: 10px;
		border: 1px solid var(--border-2);
		background: transparent;
		color: var(--text-3);
		font-family: inherit;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
	}
	.cap-tab[aria-pressed='true'] {
		background: var(--accent);
		border-color: var(--accent);
		color: #fff;
	}
	.cap-label {
		display: block;
		margin: 0 0 6px;
		font-size: 12px;
		font-weight: 700;
		color: var(--text-3);
	}
	.cap-row {
		display: flex;
		gap: 8px;
	}
	.cap-input {
		flex: 1;
		min-width: 0;
		min-height: 48px;
		padding: 12px 14px;
		border-radius: 12px;
		border: 1px solid var(--border-2);
		background: var(--bg-1);
		color: var(--text-1);
		font-family: inherit;
		/* 16px exactly: iOS Safari zooms the whole page when a focused input is
		   any smaller. */
		font-size: 16px;
	}
	.cap-input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.cap-input[aria-invalid='true'] {
		border-color: var(--accent-bright);
	}
	.cap-go {
		min-height: 48px;
		padding: 12px 18px;
		border-radius: 12px;
		border: 0;
		background: linear-gradient(135deg, var(--accent) 0%, var(--accent-bright) 100%);
		color: #fff;
		font-family: inherit;
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
		white-space: nowrap;
	}
	.cap-go:disabled,
	button:disabled {
		opacity: 0.55;
	}
	.cap-err {
		margin: 10px 0 0;
		font-size: 13px;
		color: var(--accent-bright);
	}
	.cap-note {
		margin: 10px 0 0;
		font-size: 12px;
		color: var(--text-4);
	}
	.cap-done {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--text-2);
	}

	.ft {
		padding: 30px 0 44px;
		text-align: center;
	}
	.ftnote {
		font-size: 12px;
		line-height: 1.5;
		color: var(--text-4);
		max-width: 420px;
		margin: 14px auto 0;
	}
	.ftlink {
		display: inline-block;
		margin-top: 14px;
		font-size: 12px;
		color: var(--text-4);
	}
</style>
