<script lang="ts">
	/**
	 * /get/w-apply — the qualification step, between Meta's lead form and Play.
	 *
	 * THE FUNNEL THIS SITS IN. She taps a breakup-energy ad, fills Meta's instant
	 * form (first name, phone, email — autofilled, near-zero friction), and the
	 * thank-you screen sends her here carrying `ra_lead={{lead_id}}`. This page
	 * asks one real question, tells her she is in, and hands her to Play.
	 *
	 * WHY THE "YOU'RE QUALIFIED" CLAIM IS ALLOWED TO BE MADE. The app owner's
	 * first framing was explicitly theatrical — tell her she qualified when
	 * nothing was checked. That is a fabricated status, and both networks treat a
	 * misleading claim as an account-level matter, on an ad account that was
	 * claimed into the business portfolio on a route Meta treats as one-way.
	 *
	 * The age question fixes it, and this is the reason the page exists in this
	 * shape: 18+ is a REAL eligibility condition — compliance.md 6.3, both
	 * networks' dating-category rules, and the product's own verification. She is
	 * evaluated against a real criterion and she passes it. The celebration is
	 * therefore true. Remove the gate and the copy on this page becomes a lie, so
	 * the two ship together or not at all.
	 *
	 * ONE QUESTION, NOTHING ELSE ABOVE THE FOLD. Everything that had to sell her
	 * happened in the ad and the form. A page that starts selling again here gives
	 * her something to bounce off.
	 *
	 * THE PROGRESS BAR STARTS TWO-THIRDS FULL and that is not a trick: she really
	 * did complete two of three steps on Meta. It is a step counter, deliberately
	 * NOT a percentage score — compliance.md 5 forbids copy that reads as a
	 * numeric verdict on a person, and "you are 95% qualified" reads as one where
	 * "step 2 of 3" reads as what it is.
	 *
	 * NO JAVASCRIPT IS LOAD-BEARING. Same rule as /get, for the same reason
	 * recorded in its header. The age buttons are a real form posting to a real
	 * action; `use:enhance` only removes the navigation. Turn JS off and the page
	 * still qualifies her.
	 */
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { page as pageStore } from '$app/stores';
	import RiteLogo from '$lib/verified-vibe/components/RiteLogo.svelte';
	import { STORE_LINKS } from '$lib/store-links';
	import { getVisitId } from '$lib/marketing/visit-id';
	import { reportPageView } from '$lib/marketing/page-view-report';
	import { reportStoreClick } from '$lib/marketing/store-click-report';
	import {
		initMetaPixel,
		trackMeta,
		STORE_CLICK_EVENT as META_STORE_CLICK
	} from '$lib/marketing/meta-pixel';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/**
	 * EVERY USER-FACING STRING LIVES HERE, in one block, on purpose.
	 *
	 * The copy is Hinglish because three of the four sharpest competitor lines
	 * observed for this market are bilingual — Shaadi's "Blush chahiye? Ya blush
	 * karane wala?", Tinder's metro "aur red flags se bhi" — and every Riteangle
	 * line to date is English-only.
	 *
	 * IT HAS NOT BEEN VALIDATED BY A NATIVE SPEAKER. Hinglish that is almost right
	 * reads worse than clean English, and nobody on the authoring side of this file
	 * can judge which this is. It is isolated here so that review is a rewrite of
	 * one object and not a hunt through markup. Do not spend on traffic to this
	 * page until someone in the target register has read it.
	 */
	const COPY = {
		step: 'Step 2 of 3',
		greetingWithName: (name: string) => `Bas ek aakhri sawaal, ${name}.`,
		greeting: 'Bas ek aakhri sawaal.',
		question: 'Aapki umar?',
		under18Link: 'Main 18 se chhoti hoon',
		saving: 'Save kar rahe hain…',

		inTitle: 'You’re in.',
		inLine: 'Riteangle har aadmi ko verify karta hai — usse pehle ki woh aap tak pahunche.',
		inCta: 'App download karo',
		androidNote: 'Abhi sirf Android par.',

		noTitle: 'Abhi nahi.',
		noLine:
			'Riteangle sirf 18+ ke liye hai. Aapne jo details bheji thi, woh hata di jayengi.'
	} as const;

	const AGE_BANDS = ['18-20', '21-24', '25-30', '31+'] as const;

	/** Matches the beacons' LandingPage union and the table's check constraint. */
	const PAGE = 'get_w_apply' as const;
	const DEFAULT_CAMPAIGN = 'get_w_apply_lp';

	const campaign = $derived($pageStore.url.searchParams.get('utm_campaign') || DEFAULT_CAMPAIGN);

	let visitId = $state('');
	let submitting = $state(false);

	/**
	 * The Play link, with attribution attached.
	 *
	 * DIFFERENT FROM /get's BUILDER IN ONE WAY THAT MATTERS. That one keeps only
	 * `utm_*` and drops everything else off the query string. Here that would
	 * silently discard `ra_lead`, which is the ONLY key joining this install back
	 * to the lead Meta captured — there is no click and no shared identifier
	 * otherwise, and email matching is not available to the reporting side. So
	 * ra_lead is forwarded explicitly alongside the utm_*, and `ra_lp` names this
	 * page the way it names the others.
	 */
	const storeUrl = $derived.by(() => {
		const incoming = new URLSearchParams($pageStore.url.search);
		const referrer = new URLSearchParams();

		incoming.forEach((value, key) => {
			if (key.startsWith('utm_')) referrer.set(key, value);
		});
		if (referrer.size === 0) referrer.set('utm_campaign', DEFAULT_CAMPAIGN);

		const raLead = incoming.get('ra_lead');
		if (raLead) referrer.set('ra_lead', raLead);

		referrer.set('ra_lp', PAGE);
		return `${STORE_LINKS.android}&referrer=${encodeURIComponent(referrer.toString())}`;
	});

	/**
	 * The form's POST target, with the query string carried explicitly.
	 *
	 * NOT `action="?/qualify"`, which is the obvious spelling and is WRONG here.
	 * A relative URL beginning with `?` replaces the ENTIRE query string per URL
	 * resolution, so a real browser post from /get/w-apply?ra_lead=X&utm_*=... goes
	 * to /get/w-apply?/qualify and arrives with ra_lead and every utm_ stripped.
	 *
	 * This was live for one deploy and caught by reading the table rather than by
	 * testing: a real tap wrote a row with ra_lead null, which the page's own load
	 * function should make impossible. Curl tests missed it because they put the
	 * params in the POST url by hand, which is exactly what a browser does not do.
	 *
	 * ra_lead is the only key joining this install back to the lead Meta captured.
	 * Losing it here loses the entire funnel's attribution, which is the failure
	 * this page was designed around.
	 */
	const actionUrl = $derived(
		$pageStore.url.search ? `${$pageStore.url.search}&/qualify` : '?/qualify'
	);

	const qualified = $derived(form?.qualified === true);
	const rejected = $derived(form?.qualified === false);

	onMount(() => {
		visitId = getVisitId();
		initMetaPixel();
		reportPageView({ page: PAGE, campaign, url: $pageStore.url });
	});

	function onStoreClick() {
		const eventId = crypto.randomUUID?.() ?? `e-${Date.now()}`;
		trackMeta(META_STORE_CLICK, { eventId });
		reportStoreClick({
			eventId,
			page: PAGE,
			cta: 'qualified',
			campaign,
			url: $pageStore.url
		});
	}
</script>

<svelte:head>
	<title>riteangle</title>
	<!-- Nothing here should ever be indexed or shared: it is one step inside a
	     paid funnel and it reads as nonsense out of context. -->
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main>
	<header><RiteLogo /></header>

	{#if qualified}
		<section class="panel" aria-live="polite">
			<div class="bar"><i style="width:100%"></i></div>
			<p class="step">Step 3 of 3</p>

			<div class="tick" aria-hidden="true">✓</div>
			<h1>{COPY.inTitle}</h1>
			<p class="line">{COPY.inLine}</p>

			<a class="cta" href={storeUrl} rel="noopener" onclick={onStoreClick}>{COPY.inCta}</a>
			<p class="foot">{COPY.androidNote}</p>
		</section>
	{:else if rejected}
		<!--
			The turn-away is real, and it commits us to something operational.

			Her name, phone and email were captured inside Meta BEFORE this gate, so
			"woh hata di jayengi" is a promise about data we are holding elsewhere.
			marketing_apply_gate carries the unqualified index precisely so that
			whoever exports the leads can find and drop these rows. Under India's
			DPDP a child's data needs verifiable parental consent, which we do not
			have and are not going to seek — so removal is the only lawful end state,
			and it must actually happen at export time.
		-->
		<section class="panel" aria-live="polite">
			<h1>{COPY.noTitle}</h1>
			<p class="line">{COPY.noLine}</p>
		</section>
	{:else}
		<section class="panel">
			<div class="bar"><i style="width:66%"></i></div>
			<p class="step">{COPY.step}</p>

			<h1>
				{data.firstName ? COPY.greetingWithName(data.firstName) : COPY.greeting}
			</h1>
			<p class="question">{COPY.question}</p>

			<form
				method="POST"
				action={actionUrl}
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
					};
				}}
			>
				<input type="hidden" name="visit_id" value={visitId} />
				<input type="hidden" name="campaign" value={campaign} />

				<div class="bands">
					{#each AGE_BANDS as band (band)}
						<button class="band" name="age_band" value={band} disabled={submitting}>
							{band}
						</button>
					{/each}
				</div>

				<!--
					Under 18 is a plain link, not a fifth button, and that asymmetry is
					deliberate: it is an exit, not an option with equal standing. It is
					still a real submit, because the answer has to be recorded — a gate
					that lets her leave without telling us cannot suppress her lead.
				-->
				<button class="under" name="age_band" value="under-18" disabled={submitting}>
					{COPY.under18Link}
				</button>

				{#if submitting}<p class="foot">{COPY.saving}</p>{/if}
			</form>
		</section>
	{/if}
</main>

<style>
	:global(body) {
		background: #fdf8f4;
		margin: 0;
	}

	main {
		min-height: 100svh;
		display: flex;
		flex-direction: column;
		padding: 20px 22px 32px;
		box-sizing: border-box;
		font-family: Gabarito, ui-sans-serif, -apple-system, 'Segoe UI', Roboto, sans-serif;
		color: #1e1712;
	}

	header {
		margin-bottom: auto;
	}

	.panel {
		width: 100%;
		max-width: 460px;
		margin: 0 auto auto;
		padding-top: 8vh;
	}

	.bar {
		height: 6px;
		background: #ecdfd5;
		border-radius: 99px;
		overflow: hidden;
	}
	.bar i {
		display: block;
		height: 100%;
		background: #d9614a;
		border-radius: 99px;
		transition: width 0.5s ease;
	}
	.step {
		font-size: 13px;
		color: #7d6f65;
		margin: 8px 0 30px;
	}

	h1 {
		font-size: clamp(26px, 7vw, 34px);
		line-height: 1.15;
		letter-spacing: -0.02em;
		margin: 0 0 6px;
		font-weight: 700;
	}
	.question {
		font-size: clamp(20px, 5.5vw, 25px);
		margin: 0 0 26px;
		color: #4a4039;
	}
	.line {
		font-size: 16px;
		line-height: 1.5;
		color: #4a4039;
		margin: 0 0 28px;
	}

	.bands {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 11px;
	}
	.band {
		font: inherit;
		font-size: 18px;
		font-weight: 650;
		padding: 18px 0;
		border: 1.5px solid #e0d2c6;
		border-radius: 12px;
		background: #fff;
		color: inherit;
		cursor: pointer;
	}
	.band:active {
		background: #f7ece5;
	}

	.under {
		display: block;
		margin: 22px auto 0;
		background: none;
		border: 0;
		font: inherit;
		font-size: 14px;
		color: #7d6f65;
		text-decoration: underline;
		cursor: pointer;
	}

	.tick {
		width: 46px;
		height: 46px;
		border-radius: 50%;
		background: #e0f0e8;
		color: #2f7d5d;
		display: grid;
		place-items: center;
		font-size: 24px;
		margin-bottom: 16px;
	}

	.cta {
		display: block;
		text-align: center;
		background: #d9614a;
		color: #fff;
		text-decoration: none;
		font-size: 17px;
		font-weight: 700;
		padding: 17px;
		border-radius: 12px;
	}

	.foot {
		font-size: 13px;
		color: #7d6f65;
		text-align: center;
		margin: 12px 0 0;
	}

	button:disabled {
		opacity: 0.55;
	}
</style>
