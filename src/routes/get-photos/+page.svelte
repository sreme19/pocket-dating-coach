<script lang="ts">
	/**
	 * /get-photos — a photo-led variant of /get, for A/B testing paid-social creative.
	 *
	 * This is a deliberate copy of /get with the SAME copy, structure, attribution
	 * logic and cream palette — the one change is that real photographs of couples
	 * are woven through it, where /get uses CSS mockups and emoji only.
	 *
	 * WHY THIS EXISTS AS A SEPARATE ROUTE. /get is intentionally photo-free: a man's
	 * raw photo never appears in the product, so it never appears in /get's marketing
	 * either, and the mockups carry a face as an initial in a circle rather than a
	 * stranger. That is still the rule for /get. This route breaks it ON PURPOSE, in
	 * one place we can measure against the original, to test whether a warmer, human
	 * hero pulls more installs from Indian paid-social traffic than the drawn mockups.
	 * If it doesn't earn its keep, delete the route — the photos live only here.
	 *
	 * The photographs are royalty-free stock of Indian couples (Pexels license: free
	 * for commercial use, no attribution required), chosen to read modern and candid
	 * rather than wedding-formal, and diverse across the set. They are NOT members and
	 * are labelled as illustration in the footer so the page never implies otherwise.
	 *
	 * Everything else matches /get: every CTA goes straight to Google Play with the
	 * ad's utm_* forwarded into Play's install `referrer`; Android only; numbers are
	 * first-party rates and medians; no money / wealth / provider framing (this file
	 * is scanned by scripts/check-banned-strings.sh too). The default campaign label
	 * is get_photos_lp so this variant is separable from /get in Play Console.
	 */
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import RiteLogo from '$lib/verified-vibe/components/RiteLogo.svelte';
	import { STORE_LINKS } from '$lib/store-links';
	import {
		initSnapPixel,
		trackSnap,
		STORE_CLICK_EVENT as SNAP_STORE_CLICK
	} from '$lib/marketing/snap-pixel';
	import {
		initMetaPixel,
		trackMeta,
		STORE_CLICK_EVENT as META_STORE_CLICK
	} from '$lib/marketing/meta-pixel';
	import { reportStoreClick } from '$lib/marketing/store-click-report';
	import { reportPageView } from '$lib/marketing/page-view-report';

	/** Campaign labels used when the ad URL carries no utm_* of its own. */
	const DEFAULT_UTM = 'utm_source=snapchat&utm_medium=paid_social&utm_campaign=get_photos_lp';

	/**
	 * The Play listing, with attribution attached — identical to /get, so the two
	 * landing pages are directly comparable in Play Console's acquisition view.
	 */
	const storeUrl = $derived.by(() => {
		const incoming = new URLSearchParams($page.url.search);
		for (const key of [...incoming.keys()]) {
			if (!key.startsWith('utm_')) incoming.delete(key);
		}
		const referrer = new URLSearchParams(incoming.size > 0 ? incoming.toString() : DEFAULT_UTM);
		// The variant marker that survives the install. Without it a shared
		// utm_campaign across both pages makes the A/B test unreadable at the
		// only point that matters — installs, not taps.
		referrer.set('ra_lp', 'get_photos');
		return `${STORE_LINKS.android}&referrer=${encodeURIComponent(referrer.toString())}`;
	});

	/**
	 * Measurement, identical to /get — which is the entire point of this route.
	 *
	 * This page shipped with `data-cta` on all four buttons and nothing listening
	 * to them, so the variant it exists to test recorded no views, no taps and no
	 * conversions. Against an instrumented /get that does not read as "the photo
	 * variant lost", it reads as a zero, which is worse than no test at all: one
	 * is an answer and the other is an unmeasured page that looks like an answer.
	 *
	 * Everything below mirrors /get exactly — same pixels, same delegated capture
	 * listener, same beacons, same shared event id — because a variant test where
	 * the two arms are measured differently measures the instrumentation, not the
	 * creative. The one difference is `page: 'get_photos'`, which is what keeps
	 * the arms separable after an ad supplies its own utm_campaign and overrides
	 * both default labels.
	 *
	 * See the long note in /get about why `target="_blank"` on every CTA is
	 * load-bearing for the store-click event. It applies here unchanged.
	 */
	onMount(() => {
		initSnapPixel();
		initMetaPixel();

		reportPageView({
			page: 'get_photos',
			campaign: $page.url.searchParams.get('utm_campaign') ?? 'get_photos_lp',
			url: $page.url
		});

		const onClick = (e: MouseEvent) => {
			const cta = (e.target as HTMLElement | null)?.closest?.('[data-cta]');
			if (!cta) return;

			const which = cta.getAttribute('data-cta') ?? 'unknown';
			const campaign = $page.url.searchParams.get('utm_campaign') ?? 'get_photos_lp';

			// One id per tap, sent to both networks twice — browser and server — so
			// each collapses the pair into a single conversion instead of two.
			const eventId = crypto.randomUUID();

			trackSnap(SNAP_STORE_CLICK, {
				item_category: 'play_store_click',
				item_ids: [which],
				description: campaign,
				client_dedup_id: eventId
			});
			trackMeta(META_STORE_CLICK, { cta: which, campaign }, eventId);
			reportStoreClick({ eventId, page: 'get_photos', cta: which, campaign, url: $page.url });
		};

		document.addEventListener('click', onClick, { capture: true });
		return () => document.removeEventListener('click', onClick, { capture: true });
	});

	/** First-party measurements. Rates and medians only — see the header note. */
	const PROOF = [
		{ figure: '12 min', label: 'Median time to a first match, for men' },
		{ figure: '54%', label: 'Of all messages, sent by an AI for someone' },
		{ figure: '2:1', label: 'Our member ratio. Rivals run 70–93% men' },
		{ figure: '14', label: 'Suitors the median woman here has — ranked' }
	];

	const THEM = ['Two hundred photos', 'Swipe and hope', 'Months of silence', 'Nothing like the profile'];
	const US = ['Verify once', 'Your AI does the asking', 'A ranked shortlist', 'Claims already proven'];

	const STEPS = [
		{ icon: '🪪', h: 'Verify once', p: 'Read, then deleted. Never stored.' },
		{ icon: '✨', h: 'Your AI does the talking', p: 'It asks what you never had time to.' },
		{ icon: '🤝', h: 'You just meet', p: 'Only the few who actually fit.' }
	];

	const DIFF = [
		{ icon: '🚫', h: 'No swiping, ever', p: 'One free Notice Me. Both sides choose in.' },
		{ icon: '🗑️', h: 'Proof, never stored', p: 'Read, signal taken, file gone.' },
		{ icon: '🙅', h: 'The AI cannot flatter you', p: 'It says what happened, not how she feels.' },
		{ icon: '🤐', h: 'A no costs you nothing', p: 'Never a warning on her side.' },
		{ icon: '💬', h: 'Honest feedback, no cruelty', p: 'You get the fix, never the words.' },
		{ icon: '🌿', h: 'Pause without deleting', p: 'Networking Season turns dating off.' }
	];

	const FAQ = [
		{ q: 'Another dating app?', a: 'No swipes. Ever. Just matches that mean something.' },
		{ q: 'Will an AI feel cold?', a: 'It does the heavy lifting. You stay in control, and it always says it is an AI.' },
		{ q: 'Why would anyone verify?', a: 'The shortlist is ordered by what you proved — and the proof is deleted once read.' },
		{ q: 'Is it safe?', a: 'Identity-verified members, strictly 18+, and block or report on every profile.' },
		{ q: 'iPhone?', a: 'Not yet — Android only for now. iPhone is on the way.' }
	];
</script>

<svelte:head>
	<title>riteangle · No swiping. Ever. Just matches.</title>
	<meta
		name="description"
		content="An identity-verified dating app where an AI does the searching, the asking and the vetting — and hands you a short, ranked shortlist. Early access is open on Android."
	/>
	<meta name="theme-color" content="#FFF3F0" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="riteangle" />
	<meta property="og:title" content="No swiping. Ever. Just matches." />
	<meta
		property="og:description"
		content="An AI does the searching, the asking and the vetting. You just meet. Early access is open on Android."
	/>
	<meta property="og:image" content="/og/riteangle-logo.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="No swiping. Ever. Just matches." />
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
				<span class="pill"
					><span class="dot" aria-hidden="true"></span>Early Access Membership · Open</span
				>
			</div>

			<h1 class="h1">No swiping. <em>Ever.</em><br />Just matches.</h1>

			<p class="lede">
				AI handles the conversations, the profile, the searching.
				<em>You do the meeting.</em>
			</p>

			<!-- The photo variant's whole point: a warm human hero before the fold.
			     Framed, not full-bleed, so the cream palette still reads first. -->
			<figure class="figure hero-fig">
				<img
					src="/get-photos/hero.jpg"
					width="1400"
					height="1120"
					alt="A young couple holding hands outdoors on a sunny day"
					fetchpriority="high"
					decoding="async"
				/>
			</figure>

			<a class="cta" href={storeUrl} data-cta="hero">
				{@render playMark()}
				Get the Android app
			</a>
			<p class="cta-note">Android only right now — iPhone is on the way.</p>

			<ul class="chips">
				<li>✓ ID-verified</li>
				<li>✓ Proof deleted</li>
				<li>✓ 18+</li>
			</ul>
		</div>
	</header>

	<!-- ── Them / us split ───────────────────────────────────────────────── -->
	<section class="sec">
		<div class="wrap">
			<div class="split">
				<div class="sp them">
					<span class="sp-tag">Every other app</span>
					<ul>
						{#each THEM as t (t)}
							<li><span class="x">✕</span>{t}</li>
						{/each}
					</ul>
				</div>
				<div class="sp us">
					<span class="sp-tag">riteangle</span>
					<ul>
						{#each US as u (u)}
							<li><span class="v">✓</span>{u}</li>
						{/each}
					</ul>
				</div>
			</div>
		</div>
	</section>

	<!-- ── Numbers ───────────────────────────────────────────────────────── -->
	<section class="sec tinted">
		<div class="wrap">
			<h2 class="h2">Not a promise.<br />A measurement.</h2>
			<div class="proof">
				{#each PROOF as p (p.figure)}
					<div class="pcard">
						<div class="fig">{p.figure}</div>
						<div class="plabel">{p.label}</div>
					</div>
				{/each}
			</div>
			<p class="foot">From our own live platform, not an industry report.</p>
		</div>
	</section>

	<!-- ── Lifestyle band ────────────────────────────────────────────────── -->
	<section class="sec band-sec">
		<div class="wrap">
			<figure class="figure band">
				<img
					src="/get-photos/couple-walk.jpg"
					width="1400"
					height="955"
					alt="A couple on a coffee date at an outdoor cafe"
					loading="lazy"
					decoding="async"
				/>
				<figcaption class="band-cap">Fewer, better matches. On purpose.</figcaption>
			</figure>
		</div>
	</section>

	<!-- ── Mockup 1: her AI goes first ───────────────────────────────────── -->
	<section class="sec">
		<div class="wrap">
			<h2 class="h2">Her AI talks to him first</h2>
			<figure class="figure">
				<img
					src="/get-photos/couple-phone.jpg"
					width="1400"
					height="1051"
					alt="A couple talking over coffee on a date"
					loading="lazy"
					decoding="async"
				/>
			</figure>
			<div class="mock">
				<div class="mock-top">
					<span class="ava">B</span>
					<span class="mock-name">Bestie</span>
					<span class="ai-tag">✨ AI</span>
				</div>
				<div class="b ai">She asked how you spend your weekends. One line is fine.</div>
				<div class="b me">Climbing on Saturdays. Cooking on Sundays.</div>
				<div class="b ai">Logged. That closes one of the three things she asked for.</div>
				<div class="mock-foot">2 left → then she sees you</div>
			</div>
			<p class="cap">It asks the things she would never have time to ask.</p>
		</div>
	</section>

	<!-- ── Mockup 2 + 3: what each side gets ─────────────────────────────── -->
	<section class="sec tinted">
		<div class="wrap">
			<h2 class="h2">Two sides, two views</h2>

			<div class="mock list">
				<div class="mock-cap">What she sees</div>
				{#each [{ i: 'A', pct: 92 }, { i: 'R', pct: 78 }, { i: 'K', pct: 61 }] as r, idx (r.i)}
					<div class="row">
						<span class="rank">{idx + 1}</span>
						<span class="ava sm">{r.i}</span>
						<span class="meter"><span class="fill" style="width:{r.pct}%"></span></span>
						<span class="pct">{r.pct}%</span>
					</div>
				{/each}
				<div class="mock-foot">Ranked by what she asked for — not by who uploaded most</div>
			</div>

			<div class="mock prog">
				<div class="mock-cap">What he sees</div>
				<div class="segs">
					<span class="seg on"></span>
					<span class="seg on"></span>
					<span class="seg on"></span>
					<span class="seg"></span>
				</div>
				<div class="prog-row"><strong>68%</strong> <span>and it never slides back</span></div>
				<div class="next">Next: verify your workplace <span class="up">+9%</span></div>
				<div class="mock-foot">Never a ranking against men he cannot see</div>
			</div>
		</div>
	</section>

	<!-- ── Mid CTA ───────────────────────────────────────────────────────── -->
	<section class="sec mid">
		<div class="wrap narrow">
			<h2 class="h2 c">Minutes, not months.</h2>
			<a class="cta" href={storeUrl} data-cta="mid">
				{@render playMark()}
				Get the Android app
			</a>
		</div>
	</section>

	<!-- ── How it works ──────────────────────────────────────────────────── -->
	<section class="sec">
		<div class="wrap">
			<h2 class="h2">Three steps, two are ours</h2>
			<figure class="figure">
				<img
					src="/get-photos/couple-coffee.jpg"
					width="1400"
					height="2100"
					alt="A couple holding hands across a cafe table"
					loading="lazy"
					decoding="async"
				/>
			</figure>
			<div class="steps">
				{#each STEPS as s, i (s.h)}
					<div class="step">
						<span class="tile">{s.icon}</span>
						<div>
							<h3 class="h3"><span class="n">{i + 1}</span>{s.h}</h3>
							<p class="p">{s.p}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ── Feature tiles ─────────────────────────────────────────────────── -->
	<section class="sec tinted">
		<div class="wrap">
			<h2 class="h2">Things no other app does</h2>
			<div class="grid">
				{#each DIFF as d (d.h)}
					<div class="card">
						<span class="tile">{d.icon}</span>
						<h3 class="h3">{d.h}</h3>
						<p class="p">{d.p}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<!-- ── Objections ────────────────────────────────────────────────────── -->
	<section class="sec">
		<div class="wrap">
			<h2 class="h2">Fair questions</h2>
			<div class="faq">
				{#each FAQ as f (f.q)}
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
			<figure class="figure close-fig">
				<img
					src="/get-photos/couple-river.jpg"
					width="1400"
					height="2100"
					alt="A couple smiling together at a cafe"
					loading="lazy"
					decoding="async"
				/>
			</figure>
			<h2 class="h2 c">Meet who you<br />actually want.</h2>
			<a class="cta" href={storeUrl} data-cta="footer">
				{@render playMark()}
				Get the Android app
			</a>
			<p class="cta-note c">One tap. Android only right now.</p>
		</div>
	</section>

	<footer class="ft">
		<div class="wrap">
			<RiteLogo mark={true} word={true} markSize={22} />
			<p class="ftnote">
				Strictly 18+, confirmed at verification. Verification documents are read once and discarded.
			</p>
			<p class="ftnote">Photographs are for illustration and do not depict members.</p>
			<a class="ftlink" href="/privacy-policy">Privacy</a>
		</div>
	</footer>

	<!-- Sticky thumb-reach CTA, identical to /get. -->
	<div class="bar">
		<a class="cta" href={storeUrl} data-cta="sticky">
			{@render playMark()}
			Get the Android app
		</a>
	</div>
</div>

<style>
	/* Cream, light and warm — the product's own palette. Every major rival ships a
	   dark app, so in a feed of dark dating creative the cream is the
	   differentiator before a word is read. Do not darken this page. */
	.pg {
		background: var(--bg-1);
		color: var(--text-1);
		font-family: var(--font-serif);
		min-height: 100vh;
		overflow-x: hidden;
	}

	.wrap {
		width: 100%;
		max-width: 560px;
		margin: 0 auto;
		padding: 0 20px;
		box-sizing: border-box;
	}

	.wrap.narrow {
		max-width: 460px;
	}

	/* ── Photos ───────────────────────────────────────────────────────────── */
	/* Framed, never full-bleed and never darkened: the image sits inside the cream
	   column with the same rounded, soft-shadowed card treatment as the mockups, so
	   the photo reads as part of the page rather than a banner pasted over it. */
	.figure {
		margin: 0 0 18px;
		border-radius: 18px;
		overflow: hidden;
		border: 1px solid var(--border-1);
		background: var(--bg-2);
		box-shadow: 0 18px 40px -30px rgba(122, 17, 51, 0.45);
	}

	.figure img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		/* In-body figures (no aspect on their container) crop to a clean landscape;
		   the hero/band/close figures set their own aspect on the container, and
		   their img fills it via height:100%, so this default is ignored there. */
		aspect-ratio: 3 / 2;
	}

	.hero-fig {
		aspect-ratio: 5 / 4;
		margin: 4px 0 22px;
	}

	.hero-fig img {
		object-position: 50% 30%;
	}

	/* Wide lifestyle band with a caption strip along the bottom. */
	.band-sec {
		padding-top: 8px;
		padding-bottom: 8px;
	}

	.figure.band {
		position: relative;
		margin: 0;
		aspect-ratio: 16 / 9;
	}

	.band-cap {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 26px 16px 13px;
		font-size: 15px;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: #fff;
		/* A gradient scrim ONLY behind the caption text, so the photo itself is never
		   darkened — just enough to keep white type legible over the image. */
		background: linear-gradient(to top, rgba(60, 12, 24, 0.72) 0%, rgba(60, 12, 24, 0) 100%);
	}

	.close-fig {
		aspect-ratio: 4 / 5;
		max-width: 340px;
		margin: 0 auto 22px;
	}

	.close-fig img {
		object-position: 50% 25%;
	}

	/* ── Hero ─────────────────────────────────────────────────────────────── */
	.hero {
		padding: 22px 0 32px;
		background:
			radial-gradient(120% 70% at 50% -10%, var(--accent-tint) 0%, transparent 58%),
			radial-gradient(90% 60% at 100% 0%, rgba(255, 122, 77, 0.14) 0%, transparent 60%);
	}

	.brandrow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 10px 12px;
		margin-bottom: 26px;
	}

	.pill {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #047857;
		background: rgba(16, 185, 129, 0.14);
		border: 1px solid rgba(16, 185, 129, 0.45);
		border-radius: 999px;
		padding: 5px 11px 5px 9px;
	}

	.pill .dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #10b981;
		box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.22);
	}

	.h1 {
		font-size: clamp(36px, 12vw, 50px);
		line-height: 1;
		letter-spacing: -0.04em;
		font-weight: 900;
		margin: 0 0 12px;
		text-wrap: balance;
	}

	.h1 em {
		font-style: normal;
		color: var(--accent);
	}

	.lede {
		font-size: 17px;
		line-height: 1.4;
		font-weight: 600;
		color: var(--text-2);
		margin: 0 0 22px;
	}

	.lede em {
		display: block;
		font-style: normal;
		font-weight: 800;
		color: var(--accent-bright);
	}

	.chips {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
		margin: 16px 0 0;
		padding: 0;
	}

	.chips li {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-2);
		background: rgba(255, 255, 255, 0.85);
		border: 1px solid var(--border-1);
		border-radius: 999px;
		padding: 5px 10px;
	}

	/* ── CTA ──────────────────────────────────────────────────────────────── */
	.cta {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		width: 100%;
		box-sizing: border-box;
		min-height: 56px;
		padding: 15px 20px;
		border-radius: 15px;
		background: linear-gradient(135deg, var(--accent) 0%, var(--accent-bright) 100%);
		color: #fff;
		font-size: 17px;
		font-weight: 800;
		letter-spacing: -0.01em;
		text-decoration: none;
		box-shadow: 0 14px 30px -14px rgba(225, 29, 84, 0.62);
		transition:
			transform 150ms ease,
			box-shadow 150ms ease;
	}

	.cta:hover {
		transform: translateY(-1px);
		box-shadow: 0 18px 34px -14px rgba(225, 29, 84, 0.7);
	}

	.cta:active {
		transform: translateY(0);
	}

	.cta-ico {
		flex: none;
		width: 22px;
		height: 22px;
		display: grid;
		place-items: center;
		background: #fff;
		border-radius: 6px;
		padding: 3px;
		box-sizing: content-box;
	}

	.cta-ico svg {
		width: 100%;
		height: 100%;
		display: block;
	}

	.cta-note {
		font-size: 12.5px;
		line-height: 1.5;
		color: var(--text-4);
		margin: 10px 0 0;
	}

	/* ── Sections ─────────────────────────────────────────────────────────── */
	.sec {
		padding: 34px 0;
	}

	.sec.tinted {
		background: var(--bg-3);
	}

	.sec.mid {
		background:
			radial-gradient(100% 80% at 50% 100%, var(--accent-tint) 0%, transparent 62%), var(--bg-1);
		text-align: center;
	}

	.sec.close {
		padding-bottom: 42px;
		text-align: center;
	}

	.h2 {
		font-size: clamp(24px, 7vw, 30px);
		line-height: 1.1;
		letter-spacing: -0.035em;
		font-weight: 900;
		margin: 0 0 18px;
		text-wrap: balance;
	}

	.h3 {
		font-size: 15.5px;
		line-height: 1.25;
		font-weight: 800;
		letter-spacing: -0.02em;
		margin: 0 0 4px;
		display: flex;
		align-items: baseline;
		gap: 7px;
	}

	.p {
		font-size: 13.5px;
		line-height: 1.5;
		color: var(--text-3);
		margin: 0;
	}

	.c {
		text-align: center;
	}

	.foot,
	.cap {
		font-size: 12px;
		line-height: 1.5;
		color: var(--text-4);
		margin: 12px 0 0;
	}

	.cap {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-3);
		text-align: center;
	}

	.sec.mid .cta,
	.sec.close .cta {
		margin-top: 18px;
	}

	/* ── Them / us split ──────────────────────────────────────────────────── */
	.split {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}

	.sp {
		border-radius: 16px;
		padding: 14px 13px 15px;
		background: var(--bg-2);
		border: 1px solid var(--border-1);
	}

	.sp.us {
		background: linear-gradient(165deg, #fff 0%, #fff4f1 100%);
		border-color: var(--border-3);
		box-shadow: 0 16px 36px -26px rgba(122, 17, 51, 0.42);
	}

	.sp-tag {
		display: block;
		font-size: 10.5px;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-4);
		margin-bottom: 11px;
	}

	.sp.us .sp-tag {
		text-transform: none;
		font-size: 13.5px;
		letter-spacing: -0.02em;
		color: var(--accent-bright);
	}

	.sp ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 9px;
	}

	.sp li {
		display: flex;
		align-items: flex-start;
		gap: 7px;
		font-size: 13px;
		line-height: 1.35;
		font-weight: 600;
		color: var(--text-2);
	}

	.sp.them li {
		color: var(--text-4);
	}

	.x,
	.v {
		flex: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		font-size: 9px;
		font-weight: 900;
		margin-top: 1px;
	}

	.x {
		background: rgba(138, 122, 128, 0.16);
		color: var(--text-4);
	}

	.v {
		background: var(--accent);
		color: #fff;
	}

	/* ── Numbers ──────────────────────────────────────────────────────────── */
	.proof {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 9px;
	}

	.pcard {
		background: var(--bg-2);
		border: 1px solid var(--border-1);
		border-radius: 15px;
		padding: 13px 13px 14px;
	}

	.fig {
		font-size: clamp(26px, 8vw, 32px);
		line-height: 1;
		font-weight: 900;
		letter-spacing: -0.04em;
		color: var(--accent-bright);
		margin-bottom: 6px;
	}

	.plabel {
		font-size: 12.5px;
		line-height: 1.35;
		font-weight: 700;
		color: var(--text-2);
	}

	/* ── Mockups ──────────────────────────────────────────────────────────── */
	.mock {
		background: var(--bg-2);
		border: 1px solid var(--border-1);
		border-radius: 18px;
		padding: 14px;
		box-shadow: 0 18px 40px -30px rgba(122, 17, 51, 0.45);
	}

	.mock + .mock {
		margin-top: 12px;
	}

	.mock-top {
		display: flex;
		align-items: center;
		gap: 8px;
		padding-bottom: 12px;
		margin-bottom: 12px;
		border-bottom: 1px solid var(--border-1);
	}

	.ava {
		flex: none;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		font-size: 13px;
		font-weight: 900;
		color: #fff;
		background: linear-gradient(140deg, var(--accent) 0%, var(--accent-bright) 100%);
	}

	.ava.sm {
		width: 24px;
		height: 24px;
		font-size: 11px;
	}

	.mock-name {
		font-size: 14px;
		font-weight: 800;
		letter-spacing: -0.01em;
	}

	.ai-tag {
		margin-left: auto;
		font-size: 10.5px;
		font-weight: 800;
		letter-spacing: 0.03em;
		color: var(--accent-bright);
		background: var(--accent-tint);
		border-radius: 999px;
		padding: 4px 9px;
	}

	.b {
		font-size: 13.5px;
		line-height: 1.45;
		padding: 10px 12px;
		border-radius: 14px;
		max-width: 86%;
		margin-bottom: 8px;
	}

	.b.ai {
		background: var(--bg-3);
		color: var(--text-1);
		border-bottom-left-radius: 5px;
	}

	.b.me {
		background: linear-gradient(135deg, var(--accent) 0%, var(--accent-bright) 100%);
		color: #fff;
		font-weight: 600;
		margin-left: auto;
		border-bottom-right-radius: 5px;
	}

	.mock-foot {
		font-size: 11.5px;
		font-weight: 700;
		color: var(--text-4);
		margin-top: 10px;
		padding-top: 10px;
		border-top: 1px solid var(--border-1);
	}

	.mock-cap {
		font-size: 10.5px;
		font-weight: 800;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--accent-bright);
		margin-bottom: 12px;
	}

	/* Ranked shortlist */
	.row {
		display: flex;
		align-items: center;
		gap: 9px;
		margin-bottom: 10px;
	}

	.rank {
		flex: none;
		width: 15px;
		font-size: 12px;
		font-weight: 900;
		color: var(--text-4);
	}

	.meter {
		flex: 1;
		height: 8px;
		border-radius: 999px;
		background: var(--bg-3);
		overflow: hidden;
	}

	.fill {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--accent) 0%, var(--accent-bright) 100%);
	}

	.pct {
		flex: none;
		width: 34px;
		text-align: right;
		font-size: 12px;
		font-weight: 900;
		color: var(--text-2);
	}

	/* Progress bar */
	.segs {
		display: flex;
		gap: 5px;
		margin-bottom: 11px;
	}

	.seg {
		flex: 1;
		height: 9px;
		border-radius: 999px;
		background: var(--bg-3);
	}

	.seg.on {
		background: linear-gradient(90deg, var(--accent) 0%, var(--accent-bright) 100%);
	}

	.prog-row {
		display: flex;
		align-items: baseline;
		gap: 7px;
		font-size: 13px;
		color: var(--text-3);
	}

	.prog-row strong {
		font-size: 22px;
		font-weight: 900;
		letter-spacing: -0.03em;
		color: var(--text-1);
	}

	.next {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 11px;
		padding: 9px 11px;
		border-radius: 11px;
		background: var(--accent-tint);
		font-size: 12.5px;
		font-weight: 700;
		color: var(--accent-bright);
	}

	.up {
		margin-left: auto;
		font-weight: 900;
	}

	/* ── Steps + tiles ────────────────────────────────────────────────────── */
	.steps {
		display: grid;
		gap: 12px;
	}

	.step {
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}

	.tile {
		flex: none;
		width: 38px;
		height: 38px;
		border-radius: 12px;
		display: grid;
		place-items: center;
		font-size: 18px;
		background: var(--accent-tint);
		border: 1px solid var(--border-3);
	}

	.h3 .n {
		font-size: 11px;
		font-weight: 900;
		color: var(--accent);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 9px;
	}

	.card {
		background: var(--bg-2);
		border: 1px solid var(--border-1);
		border-radius: 15px;
		padding: 13px;
	}

	.card .tile {
		width: 32px;
		height: 32px;
		font-size: 16px;
		margin-bottom: 9px;
	}

	.card .h3 {
		display: block;
		font-size: 14px;
	}

	.card .p {
		font-size: 12.5px;
	}

	/* ── FAQ ──────────────────────────────────────────────────────────────── */
	.faq {
		display: grid;
		gap: 8px;
	}

	.qa {
		background: var(--bg-2);
		border: 1px solid var(--border-1);
		border-radius: 13px;
		padding: 12px 14px;
	}

	.qa summary {
		font-size: 14px;
		font-weight: 800;
		letter-spacing: -0.01em;
		cursor: pointer;
		list-style: none;
		display: flex;
		justify-content: space-between;
		gap: 10px;
		align-items: center;
	}

	.qa summary::-webkit-details-marker {
		display: none;
	}

	.qa summary::after {
		content: '+';
		flex: none;
		font-size: 18px;
		font-weight: 700;
		line-height: 1;
		color: var(--accent);
	}

	.qa[open] summary::after {
		content: '–';
	}

	.qa[open] summary {
		margin-bottom: 7px;
	}

	/* ── Footer ───────────────────────────────────────────────────────────── */
	.ft {
		padding: 24px 0 calc(94px + env(safe-area-inset-bottom, 0));
		background: var(--bg-3);
		border-top: 1px solid var(--border-1);
		text-align: center;
	}

	.ft .wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 9px;
	}

	.ftnote {
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--text-4);
		margin: 0;
		max-width: 400px;
	}

	.ftlink {
		font-size: 12.5px;
		font-weight: 700;
		color: var(--text-3);
		text-decoration: none;
		border-bottom: 1px solid var(--border-2);
	}

	/* ── Sticky CTA bar ───────────────────────────────────────────────────── */
	.bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 20;
		padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0));
		background: rgba(255, 243, 240, 0.94);
		backdrop-filter: blur(10px);
		border-top: 1px solid var(--border-2);
	}

	.bar .cta {
		max-width: 528px;
		margin: 0 auto;
		min-height: 52px;
		box-shadow: 0 10px 22px -14px rgba(225, 29, 84, 0.6);
	}

	/* ── Entrance animation ───────────────────────────────────────────────── */
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(14px);
		}

		to {
			opacity: 1;
			transform: none;
		}
	}

	@supports (animation-timeline: view()) {
		@media (prefers-reduced-motion: no-preference) {
			.sec .h2,
			.sp,
			.pcard,
			.mock,
			.figure,
			.step,
			.card,
			.qa,
			.sec.mid .cta,
			.sec.close .cta {
				animation: rise linear both;
				animation-timeline: view();
				animation-range: entry 0% entry 55%;
			}
		}
	}

	/* Wider screens: the page stays a phone-shaped column on purpose (paid social
	   traffic), but the tiles get room and the sticky bar steps back. */
	@media (min-width: 720px) {
		.wrap {
			max-width: 680px;
		}

		.proof {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}

		.grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.steps {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.step {
			flex-direction: column;
		}

		.hero {
			padding: 30px 0 44px;
		}

		.sec {
			padding: 50px 0;
		}

		.cta {
			max-width: 340px;
		}

		.sec.mid .cta,
		.sec.close .cta {
			margin-left: auto;
			margin-right: auto;
		}

		.hero-fig {
			aspect-ratio: 16 / 10;
		}

		.bar {
			display: none;
		}
	}
</style>
