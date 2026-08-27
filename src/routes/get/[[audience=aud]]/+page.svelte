<script lang="ts">
	/**
	 * /get — the paid-social landing page (built for the Snap ad).
	 *
	 * The ad's "Sign up" CTA lands here because a six-second ad cannot carry the
	 * product. The ad buys the tap; this page earns the install.
	 *
	 * EVERY CTA GOES STRAIGHT TO GOOGLE PLAY. An earlier pass sent people to the
	 * /beta invite page first, because verified_vibe_beta_signups.email is the only
	 * key in our own database that ties a joiner back to where they came from. That
	 * hop was removed deliberately — the app owner's call — because an email field
	 * between an ad tap and a download is a drop-off, and paid traffic is exactly
	 * where that costs the most.
	 *
	 * Attribution is therefore carried on the store link instead, as Play's install
	 * `referrer` parameter: whatever utm_* the ad appends to this page is forwarded
	 * into it, so acquisition still shows up per-campaign in Play Console. It is
	 * install-level rather than person-level — a referral payout still needs the
	 * /beta flow, which is untouched and still used by the women's invite links.
	 *
	 * SHOW, DON'T EXPLAIN. This is Snap traffic: nobody reads a paragraph. Every
	 * section is a picture with a caption — three mockups drawn in CSS (the AI
	 * vetting a man on her behalf, her ranked shortlist, his progress bar), a
	 * two-column split, a strip of numbers, and feature tiles capped at one short
	 * line each. The knowledge base flags this exact problem: the product's best
	 * moments are conversations, and they have to be staged deliberately to land in
	 * seconds. The mockups are that staging.
	 *
	 * ANDROID ONLY, on purpose: there is no public iOS listing, so every CTA here
	 * advertises the Android app and one line of copy says so plainly rather than
	 * letting an iPhone owner find out after the tap.
	 *
	 * "Early Access · Open" rather than "beta". Same fact, better read: beta says
	 * unfinished software, early access says you are in before everyone else. It is
	 * green for the same reason — the one green thing on a page of brand pink, and
	 * the only place green appears in the whole product, so it reads as a status
	 * light rather than decoration. Amber and red are already spoken for
	 * (functional: "worth a second look" and "red flag"), so neither could carry it.
	 *
	 * Every number in the strip is first-party, from the live platform, and quoted
	 * as a rate or a median — never a total. A median is true at any size; a total
	 * dates badly and reads small while the beta is young.
	 *
	 * Copy constraints (docs/requirements/AppStore_Rejection_Remediation.md, and the
	 * marketing knowledge base): money, wealth, generosity and provider framing are
	 * forbidden as reasons anyone is desirable. There are no purchases, no
	 * subscriptions and no credits, so nothing here may imply one. This route is
	 * scanned by scripts/check-banned-strings.sh for exactly that reason.
	 *
	 * No photographs anywhere, also on purpose. A man's raw photo never appears in
	 * the product at any stage, so it must not appear in marketing either — and the
	 * mockups carry a face as an initial in a circle, never a stock stranger.
	 *
	 * There is deliberately NO JavaScript behind the content. An earlier pass gated
	 * every section on a scroll-reveal observer, and one CSS specificity collision
	 * was enough to leave whole sections at opacity 0 on a page we are paying for
	 * traffic to. The entrance animation is CSS-only via `animation-timeline:
	 * view()`, so a browser without it just shows the page; the CTA is a plain
	 * anchor for the same reason.
	 *
	 * The single exception is the Snap Pixel below, and it obeys the same rule: it
	 * only measures. Nothing it does is load-bearing for a pixel of the page, and
	 * every CTA still works if it never runs. It is scoped to this route on
	 * purpose — $lib/marketing/snap-pixel.ts explains why it must not go into
	 * app.html or a layout.
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
	import { submitLead } from '$lib/marketing/lead-report';

	/**
	 * Which audience this render is for.
	 *
	 * `/get` is the men's page and is byte-identical in behaviour to what it was
	 * before this route gained a segment; `/get/w` is the women's. One file serves
	 * both because only the copy differs — the attribution logic, both pixels, all
	 * four CTAs and the entire stylesheet are audience-neutral, and the /get-photos
	 * route already demonstrates what happens when this page is forked instead:
	 * its own header claims check-banned-strings.sh scans it, and that has not been
	 * true since the day it was copied.
	 *
	 * The women's page exists because the men's one is written in the second person
	 * to a man on every line — "She asked how you spend your weekends", "then she
	 * sees you" — so a woman arriving from a women's ad was reading about how a man
	 * gets in front of her. 100% of store taps were male.
	 */
	const audience = $derived($page.params.audience === 'w' ? 'women' : 'men');

	/** Landing-page id for our own measurement, and Play's install referrer. */
	const lpId = $derived(audience === 'women' ? 'get_w' : 'get');

	/** Campaign labels used when the ad URL carries no utm_* of its own. */
	const defaultCampaign = $derived(audience === 'women' ? 'get_w_lp' : 'get_lp');
	const DEFAULT_UTM_BASE = 'utm_source=snapchat&utm_medium=paid_social&utm_campaign=';
	const DEFAULT_UTM = $derived(`${DEFAULT_UTM_BASE}${defaultCampaign}`);

	/**
	 * The Play listing, with attribution attached.
	 *
	 * Play reads `referrer` on the listing URL and reports it per-campaign in the
	 * Console's acquisition view, so the utm_* the ad appends to THIS page survive
	 * all the way to the install — the whole reason the link is assembled here
	 * rather than pasted into the markup four times. The URL itself comes from
	 * $lib/store-links so there stays exactly one definition of where the app is.
	 */
	const storeUrl = $derived.by(() => {
		const incoming = new URLSearchParams($page.url.search);
		for (const key of [...incoming.keys()]) {
			// Keep campaign params; drop anything else the click carried.
			if (!key.startsWith('utm_')) incoming.delete(key);
		}
		const referrer = new URLSearchParams(incoming.size > 0 ? incoming.toString() : DEFAULT_UTM);
		// Which page sent them, carried through the install alongside the utm_*.
		// Not recoverable from the campaign once an ad supplies its own
		// utm_campaign and overrides this page's default label — and knowing
		// whether the photo variant or this one produced an install is the only
		// reason /get-photos exists.
		referrer.set('ra_lp', lpId);
		return `${STORE_LINKS.android}&referrer=${encodeURIComponent(referrer.toString())}`;
	});

	/**
	 * Ad pixels — Snap and Meta. The only script on the page, and they render
	 * nothing; see the note at the top about why nothing here is allowed to gate
	 * content. Both are scoped to this route on purpose, and both modules say at
	 * length why lifting them into a layout would leak members' contact details
	 * to an ad network. Read those before adding a third.
	 *
	 * A page view on arrival, then the store-click event when any CTA is tapped.
	 * The listener is delegated off `document` rather than bolted onto each of
	 * the four anchors so the anchors stay plain hrefs: if this script never runs
	 * — blocked, failed, JS off — every CTA still works exactly as before, which
	 * is the whole point of them being anchors in the first place.
	 *
	 * `capture: true` so the event is recorded before the browser starts leaving
	 * for Play. The navigation is never delayed to wait for the beacon; a lost
	 * measurement is cheaper than a CTA that feels slow.
	 *
	 * That last rule is also why every CTA carries `target="_blank"`, which is
	 * load-bearing and not a style choice. Snap's SDK does not send an event when
	 * you hand it one — it queues it and flushes on a ~1s timer (measured against
	 * production 2026-08-09: click at 6ms, beacon out at 1003ms). A CTA that
	 * navigates the current tab to Play destroys the page, and the queue inside
	 * it, well before that timer fires, so the tap is never reported. PAGE_VIEW
	 * survives only because arrivals sit on the page far longer than a second.
	 * Opening Play in a new context leaves this page alive long enough to flush,
	 * and costs the visitor nothing: on Android the Play link hands off to the
	 * Play app either way. Remove the attribute and the store-click event silently
	 * stops being measurable — no error, just a permanent zero in Ads Manager.
	 */
	onMount(() => {
		initSnapPixel();
		initMetaPixel();

		// The same arrival, recorded somewhere we can read it. Both pixels send
		// their own PAGE_VIEW and both have always worked — an arrival sits still
		// for far longer than the ~1s flush timer that loses the store click — but
		// their counts live in a vendor dashboard, which makes them the one half
		// of tap rate we cannot audit. Tap rate needs a denominator we own.
		reportPageView({
			page: lpId,
			campaign: $page.url.searchParams.get('utm_campaign') ?? defaultCampaign,
			url: $page.url
		});

		const onClick = (e: MouseEvent) => {
			const cta = (e.target as HTMLElement | null)?.closest?.('[data-cta]');
			if (!cta) return;

			// Which of the four buttons earned the tap, and the campaign that
			// brought them — the same labels Play sees on the install referrer.
			const which = cta.getAttribute('data-cta') ?? 'unknown';
			const campaign = $page.url.searchParams.get('utm_campaign') ?? defaultCampaign;

			// One id for this tap, sent three ways. Both networks receive it twice
			// — once from the browser and once from our server — and collapse the
			// pair into a single conversion. Without it every tap counts twice.
			const eventId = crypto.randomUUID();

			// One listener, both networks. Each takes the same two facts in its
			// own vocabulary; neither is told anything the other is not.
			trackSnap(SNAP_STORE_CLICK, {
				item_category: 'play_store_click',
				item_ids: [which],
				description: campaign,
				client_dedup_id: eventId
			});
			trackMeta(META_STORE_CLICK, { cta: which, campaign }, eventId);
			reportStoreClick({ eventId, page: lpId, cta: which, campaign, url: $page.url });
		};

		document.addEventListener('click', onClick, { capture: true });
		return () => document.removeEventListener('click', onClick, { capture: true });
	});

	/**
	 * Copy, per audience. First-party measurements only, quoted as rates and
	 * medians — see the header note about why never a total.
	 *
	 * The men's block is exactly what this page said before it gained a women's
	 * variant; nothing in it changed. The women's block is not a translation of it.
	 * Three things are deliberately different rather than reworded:
	 *
	 *  1. Her page LEADS WITH THE LIST. His opens with the vetting because proving
	 *     himself is his job; hers opens with what she gets, and the vetting follows
	 *     as the reason the order can be trusted.
	 *  2. VERIFICATION IS SOMETHING SHE RECEIVES, not something she performs. On his
	 *     page verification is a task; on hers it is a property of everyone who
	 *     reached her list.
	 *  3. THE 14-SUITORS NUMBER STAYS, REFRAMED. The number is only worth quoting
	 *     alongside the order, which is why the label carries both.
	 *
	 * WHAT CHANGED ON 2026-08-27, and why the words above are no longer the flood.
	 * This block was written on the premise that her problem is volume — "a hundred
	 * matches with no order" — and every line followed from it. A scan of five
	 * Indian women creators that week found not one describing too many options to
	 * sort. What they describe is the QUALITY OF THE ATTENTION: an opener that is
	 * clearly mass-produced and run on many women at once, claims that cannot be
	 * checked, axes that do not line up. Plentiful but worthless is a different
	 * complaint from overwhelming, and it is the one the product actually answers,
	 * because vetting is what Riteangle does and sorting is merely how it shows the
	 * result. So `them` and `us` now contrast checkable proof against unverifiable
	 * charm, rather than one list against a hundred matches.
	 *
	 * Two things this deliberately does NOT do. It does not claim a better pool: a
	 * Bangalore rival already runs "equality means better choices" with a guaranteed
	 * 50:50 ratio, and our own membership is 31 men to 17 women, so competing on
	 * pool composition invites exactly the comparison we lose. And it does not drop
	 * the 14 — that number is first-party and true, and paired with the order it
	 * still earns its place.
	 *
	 * Sources: ad-management-agent research/learnings/
	 * lrn-2026-08-27-complaint-is-quality-not-volume, lrn-2026-08-27-vlncy-owns-
	 * better-not-more, lrn-2026-08-27-ratio-guarantee-is-unanswerable.
	 */
	const COPY = {
		men: {
			proof: [
				{ figure: '12 min', label: 'Median time to a first match, for men' },
				{ figure: '54%', label: 'Of all messages, sent by an AI for someone' },
				{ figure: '2:1', label: 'Our member ratio. Rivals run ~3 men per woman' },
				{ figure: '14', label: 'Suitors the median woman here has — ranked' }
			],
			them: ['Two hundred photos', 'Swipe and hope', 'Months of silence', 'Nothing like the profile'],
			us: ['Verify once', 'Your AI does the asking', 'A ranked shortlist', 'Claims already proven'],
			steps: [
				{ icon: '🪪', h: 'Verify once', p: 'Read, then deleted. Never stored.' },
				{ icon: '✨', h: 'Your AI does the talking', p: 'It asks what you never had time to.' },
				{ icon: '🤝', h: 'You just meet', p: 'Only the few who actually fit.' }
			],
			diff: [
				{ icon: '🚫', h: 'No swiping, ever', p: 'One free Notice Me. Both sides choose in.' },
				{ icon: '🗑️', h: 'Proof, never stored', p: 'Read, signal taken, file gone.' },
				{ icon: '🙅', h: 'The AI cannot flatter you', p: 'It says what happened, not how she feels.' },
				{ icon: '🤐', h: 'A no costs you nothing', p: 'Never a warning on her side.' },
				{ icon: '💬', h: 'Honest feedback, no cruelty', p: 'You get the fix, never the words.' },
				{ icon: '🌿', h: 'Pause without deleting', p: 'Networking Season turns dating off.' }
			],
			faq: [
				{ q: 'Another dating app?', a: 'No swipes. Ever. Just matches that mean something.' },
				{ q: 'Will an AI feel cold?', a: 'It does the heavy lifting. You stay in control, and it always says it is an AI.' },
				{ q: 'Why would anyone verify?', a: 'The shortlist is ordered by what you proved — and the proof is deleted once read.' },
				{ q: 'Is it safe?', a: 'Identity-verified members, strictly 18+, and block or report on every profile.' },
				{ q: 'iPhone?', a: 'Not yet — Android only for now. iPhone is on the way.' }
			],
			closing: ['Meet who you', 'actually want.']
		},
		women: {
			proof: [
				{ figure: '54%', label: 'Of all messages here, sent by an AI on someone’s behalf' },
				{ figure: '14', label: 'Suitors the median woman here has. You see them in order' },
				{ figure: '2:1', label: 'Our member ratio. Rivals run ~3 men per woman' },
				{ figure: '12 min', label: 'Median time to a first match, for men' }
			],
			them: [
				'The same opener, ten times',
				'Charm you cannot check',
				'Sorting on photos alone',
				'Nothing like the profile'
			],
			us: [
				'Answers before you ask',
				'Proof, not charm',
				'In the order you asked for',
				'Claims already checked'
			],
			steps: [
				{ icon: '🪪', h: 'Verify once', p: 'Read, then deleted. Never stored.' },
				{ icon: '✨', h: 'Your AI does the asking', p: 'The questions you never have time for.' },
				{ icon: '🤝', h: 'You just choose', p: 'From a list that is already short.' }
			],
			diff: [
				{ icon: '🚫', h: 'No swiping, ever', p: 'One free Notice Me. Both sides choose in.' },
				{ icon: '🗑️', h: 'Proof, never stored', p: 'He proves it. You never see the file.' },
				{ icon: '🙅', h: 'The AI cannot be charmed', p: 'It reports what he proved, not how he sounds.' },
				{ icon: '🤐', h: 'A no is silent', p: 'He is never told, and never sees a warning.' },
				{ icon: '📋', h: 'In order before you look', p: 'By what you asked for, not who posted most.' },
				{ icon: '🌿', h: 'Pause without deleting', p: 'Networking Season turns dating off.' }
			],
			faq: [
				{ q: 'Another dating app?', a: 'No swipes. Ever. Just a short list that means something.' },
				{
					q: 'They all open with the same line.',
					a: 'Here he answers your questions before he reaches you, in his own words, and you read the answers instead of the opener.'
				},
				{ q: 'Will an AI feel cold?', a: 'It does the asking, so you are not repeating yourself to ten people. It always says it is an AI.' },
				{ q: 'Why would he bother verifying?', a: 'Because that is how he reaches your list at all. He proves it, the document is read once and deleted, and you never see it.' },
				{ q: 'Is it safe?', a: 'Identity-verified members, strictly 18+, and block or report on every profile.' },
				{ q: 'iPhone?', a: 'Not yet — Android only for now. iPhone is on the way.' }
			],
			closing: ['A shortlist that', 'means something.']
		}
	} as const;

	const c = $derived(COPY[audience]);

	/**
	 * Lead capture — women's page only, and the first one Riteangle has ever run.
	 *
	 * WHY IT IS HERE AND NOT ON /get. Every CTA on this page goes to Google Play,
	 * and there is no public iOS listing, so until now an iPhone visitor could do
	 * precisely nothing with this page — she read it and left, and we did not even
	 * learn she wanted in. On top of that the stated goal for the women's lane is
	 * leads rather than installs, and TrulyMadly, BharatMatrimony and Shaadi.com all
	 * capture contact above the fold while we captured none.
	 *
	 * WHY IT SITS BELOW THE PLAY BUTTON RATHER THAN ABOVE IT. The Play tap is the
	 * one funnel already known to work, and putting a form in front of it would risk
	 * the working path to test the new one. So the button keeps its place and the
	 * form is the second option on the same screen, not a gate.
	 *
	 * One piece of state serves both placements on purpose: a visitor who submits in
	 * the hero should not scroll down to an empty form asking again.
	 */
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
			page: lpId as 'get' | 'get_w',
			audience: audience === 'women' ? 'woman' : 'man',
			contactKind,
			value,
			campaign: defaultCampaign,
			url: $page.url
		});

		sending = false;

		if (outcome.status === 'ok') {
			sent = true;
			contact = '';
			return;
		}
		// A bad number is hers to fix and says so; anything else is ours, and telling
		// her to check her number when our database is down would be a lie.
		leadError =
			outcome.status === 'invalid'
				? outcome.field === 'phone'
					? 'That does not look like an Indian mobile number.'
					: 'That does not look like an email address.'
				: 'Something went wrong on our side. Try again?';
	}
</script>

<svelte:head>
	<title
		>riteangle · {audience === 'women'
			? 'A shortlist that means something.'
			: 'No swiping. Ever. Just matches.'}</title
	>
	<meta
		name="description"
		content={audience === 'women'
			? 'An identity-verified dating app where an AI does the asking and the vetting for you — and hands you a short list, already in the order you asked for. Early access is open on Android.'
			: 'An identity-verified dating app where an AI does the searching, the asking and the vetting — and hands you a short, ranked shortlist. Early access is open on Android.'}
	/>
	<meta name="theme-color" content="#FFF3F0" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="riteangle" />
	<meta
		property="og:title"
		content={audience === 'women'
			? 'A shortlist that means something.'
			: 'No swiping. Ever. Just matches.'}
	/>
	<meta
		property="og:description"
		content="An AI does the searching, the asking and the vetting. You just meet. Early access is open on Android."
	/>
	<meta property="og:image" content="/og/riteangle-logo.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta
		name="twitter:title"
		content={audience === 'women'
			? 'A shortlist that means something.'
			: 'No swiping. Ever. Just matches.'}
	/>
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

<!--
	The capture form. Takes an `id` because it is rendered twice on the same page
	and a label's `for` has to point at exactly one input; the STATE is shared, so
	submitting in the hero also settles the copy at the foot of the page.
-->
{#snippet capture(id: string)}
	<div class="cap-box">
		{#if sent}
			<p class="cap-done">
				<strong>You are on the list.</strong> We will message you when your invite is ready — nothing
				else.
			</p>
		{:else}
			<form class="cap-form" onsubmit={onLeadSubmit} novalidate>
				<p class="cap-lead">Not on Android, or not today? Leave one line and we will come to you.</p>

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

				<label class="cap-label" for="cap-{id}">
					{contactKind === 'whatsapp' ? 'WhatsApp number' : 'Email address'}
				</label>
				<div class="cap-row">
					<input
						id="cap-{id}"
						class="cap-input"
						bind:value={contact}
						type={contactKind === 'whatsapp' ? 'tel' : 'email'}
						inputmode={contactKind === 'whatsapp' ? 'numeric' : 'email'}
						autocomplete={contactKind === 'whatsapp' ? 'tel' : 'email'}
						placeholder={contactKind === 'whatsapp' ? '98765 43210' : 'you@example.com'}
						aria-invalid={leadError ? 'true' : undefined}
						aria-describedby={leadError ? `cap-err-${id}` : `cap-note-${id}`}
						disabled={sending}
					/>
					<button class="cap-go" type="submit" disabled={sending}>
						{sending ? 'Sending…' : 'Send it'}
					</button>
				</div>

				{#if leadError}
					<p class="cap-err" id="cap-err-{id}" role="alert">{leadError}</p>
				{:else}
					<p class="cap-note" id="cap-note-{id}">
						Used once, to tell you when your invite is ready. Not shared, and 18+ only.
					</p>
				{/if}
			</form>
		{/if}
	</div>
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

			<!--
				HIS headline is the category promise: no swiping. HERS is the answer to
				the complaint she actually has, which is not that there are too many men
				but that nothing any of them says can be checked. It also matches the ad
				that brings her here word for word, so the page does not open by changing
				the subject. See the long note on COPY.women above.

				Three jobs named, then the payoff on its own line in pink. The men's list
				is deliberately verb-free after the first word: "handles" carries all
				three, which is what makes it readable at a glance on a phone.
			-->
			{#if audience === 'women'}
				<h1 class="h1">Vetted <em>before</em><br />he reaches you.</h1>
				<p class="lede">
					Your AI asks what you would have asked.
					<em>You read the answers.</em>
				</p>
			{:else}
				<h1 class="h1">No swiping. <em>Ever.</em><br />Just matches.</h1>
				<p class="lede">
					AI handles the conversations, the profile, the searching.
					<em>You do the meeting.</em>
				</p>
			{/if}

			{#if audience === 'women'}
				<figure class="shot hero-shot">
					<img
						src="/get-w/hero.jpg"
						alt="A woman at home laughing, head tipped back, mid-conversation."
						width="896"
						height="1050"
						fetchpriority="high"
						decoding="async"
					/>
				</figure>
			{/if}

			<a class="cta" href={storeUrl} data-cta="hero" target="_blank" rel="noopener">
				{@render playMark()}
				Get the Android app
			</a>
			<p class="cta-note">Android only right now — iPhone is on the way.</p>

			{#if audience === 'women'}
				{@render capture('hero')}
			{/if}

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
						{#each c.them as t (t)}
							<li><span class="x">✕</span>{t}</li>
						{/each}
					</ul>
				</div>
				<div class="sp us">
					<span class="sp-tag">riteangle</span>
					<ul>
						{#each c.us as u (u)}
							<li><span class="v">✓</span>{u}</li>
						{/each}
					</ul>
				</div>
			</div>
		</div>
	</section>

	<!--
		The problem in one frame, hers only. Every line in the split above is
		something she has already lived; this is the moment at the end of it. No face
		and nobody addressing her — creative-generation.md section 1 puts the camera
		behind her eyes rather than pointed at her, and here that is literal.
	-->
	{#if audience === 'women'}
		<section class="sec">
			<div class="wrap">
				<figure class="shot">
					<img
						src="/get-w/moment.jpg"
						alt="A woman mid-step on a Bangalore street, glancing back and laughing."
						width="760"
						height="1152"
						loading="lazy"
						decoding="async"
					/>
					<figcaption class="cap">
						The asking is handled. You get your evening back.
					</figcaption>
				</figure>
			</div>
		</section>
	{/if}

	<!-- ── Numbers ───────────────────────────────────────────────────────── -->
	<section class="sec tinted">
		<div class="wrap">
			<h2 class="h2">Not a promise.<br />A measurement.</h2>
			<div class="proof">
				{#each c.proof as p (p.figure)}
					<div class="pcard">
						<div class="fig">{p.figure}</div>
						<div class="plabel">{p.label}</div>
					</div>
				{/each}
			</div>
			<p class="foot">From our own live platform, not an industry report.</p>
		</div>
	</section>

	<!--
		The mockups, and the one place the two pages genuinely diverge in structure
		rather than wording.

		HIS page runs vetting first, then the two-sided view: proving himself is his
		job, so the chat where his AI answers on his behalf is the thing he needs to
		understand, and the split afterwards shows him what she gets out of it.

		HERS runs the list first. Her problem is the flood — a hundred matches with
		no order — so the ordered list IS the product and it leads. The chat follows
		as the reason the order can be trusted, and it is staged from her side of the
		conversation, not his. Her page drops his progress bar entirely: it is his
		surface, and on her page it would be a picture of a stranger's homework.
	-->
	{#if audience === 'women'}
		<!--
			── Hers, 1: the list, already in order ─────────────────────────────

			The photograph replaces the CSS meter mock this section used to carry, and
			the percentages go with it. That mock put a hard number beside each man —
			92%, 78%, 61% — which is the one thing compliance.md #5 says never to do:
			a score is not a verdict on a person's worth, and the men's side of this
			same page is careful to promise "never a ranking against men he cannot
			see". Her side was quietly doing the opposite. What is left is position in
			her list and the reason for it, which is the sanctioned "ordered shortlist"
			and is also the truer description of the product.
		-->
		<section class="sec">
			<div class="wrap">
				<h2 class="h2">Your list, already in order</h2>
				<figure class="shot">
					<img
						src="/get-w/shortlist.jpg"
						alt="A phone showing a short, ordered list of three verified men."
						width="928"
						height="970"
						loading="lazy"
						decoding="async"
					/>
				</figure>
				<p class="cap">
					In the order you asked for — not who posted most. Short, because the asking already
					happened.
				</p>
			</div>
		</section>

		<!-- ── Hers, 2: how the order got there ──────────────────────────────── -->
		<section class="sec tinted">
			<div class="wrap">
				<h2 class="h2">His answers came before you asked</h2>
				<div class="mock">
					<div class="mock-top">
						<span class="ava">B</span>
						<span class="mock-name">Bestie</span>
						<span class="ai-tag">✨ AI</span>
					</div>
					<div class="b ai">You said weekends matter. I asked him all three.</div>
					<div class="b me">And?</div>
					<div class="b ai">Climbs on Saturdays, cooks on Sundays. Workplace verified.</div>
					<div class="mock-foot">One left → then he reaches your list</div>
				</div>
				<p class="cap">It asks the things you would never have time to ask.</p>
			</div>
		</section>
	{:else}
		<!-- ── Mockup 1: her AI goes first ───────────────────────────────────── -->
		<section class="sec">
			<div class="wrap">
				<h2 class="h2">Her AI talks to him first</h2>
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
	{/if}

	<!-- ── Mid CTA ───────────────────────────────────────────────────────── -->
	<section class="sec mid">
		<div class="wrap narrow">
			<h2 class="h2 c">Minutes, not months.</h2>
			<a class="cta" href={storeUrl} data-cta="mid" target="_blank" rel="noopener">
				{@render playMark()}
				Get the Android app
			</a>
		</div>
	</section>

	<!-- ── How it works ──────────────────────────────────────────────────── -->
	<section class="sec">
		<div class="wrap">
			<h2 class="h2">Three steps, two are ours</h2>
			<div class="steps">
				{#each c.steps as s, i (s.h)}
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
				{#each c.diff as d (d.h)}
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
				{#each c.faq as f (f.q)}
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
			<h2 class="h2 c">{c.closing[0]}<br />{c.closing[1]}</h2>
			<a class="cta" href={storeUrl} data-cta="footer" target="_blank" rel="noopener">
				{@render playMark()}
				Get the Android app
			</a>
			<p class="cta-note c">One tap. Android only right now.</p>

			{#if audience === 'women'}
				{@render capture('close')}
			{/if}
		</div>
	</section>

	<footer class="ft">
		<div class="wrap">
			<RiteLogo mark={true} word={true} markSize={22} />
			<p class="ftnote">
				Strictly 18+, confirmed at verification. Verification documents are read once and discarded.
			</p>
			{#if audience === 'women'}
				<!--
					Required, not decorative: compliance.md section 6.2 says AI imagery is
					labelled and that creative showing a portrait must never imply an
					untouched snapshot. /get-photos carries the same line for its stock
					photographs. Nobody pictured is a member and no quote is attributed to
					anyone pictured — a face beside a testimonial would be a fabricated
					review, which is why there isn't one anywhere on this page.
				-->
				<p class="ftnote">
					Images are AI-generated illustrations. They do not depict members.
				</p>
			{/if}
			<a class="ftlink" href="/privacy-policy">Privacy</a>
		</div>
	</footer>

	<!-- Sticky thumb-reach CTA. Always present on a phone rather than revealed on
	     scroll: the tap is the only thing this page is for, and a CTA that depends
	     on script to appear is a CTA that can fail to appear. Hidden on desktop,
	     where the page's own buttons are never far away. -->
	<div class="bar">
		<a class="cta" href={storeUrl} data-cta="sticky" target="_blank" rel="noopener">
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

	/* ── Hero ─────────────────────────────────────────────────────────────── */
	.hero {
		padding: 22px 0 32px;
		background:
			radial-gradient(120% 70% at 50% -10%, var(--accent-tint) 0%, transparent 58%),
			radial-gradient(90% 60% at 100% 0%, rgba(255, 122, 77, 0.14) 0%, transparent 60%);
	}

	/* Wraps rather than squeezing: "Early Access Membership · Open" is long, and on a
	   narrow phone it takes its own line under the wordmark instead of shrinking to
	   unreadable or crowding the logo. */
	.brandrow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 10px 12px;
		margin-bottom: 26px;
	}

	/* Status light, not decoration — see the note in the script block on why this is
	   the one green element on the page. The values are literal rather than tokens
	   because the design system has no green: it ships pink, coral, amber and red,
	   and amber and red both already mean something specific in-product. */
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
	/* Brand pink, not a store badge. The badge belongs on the page that actually
	   hands over the download (/beta) — wearing it here would promise a store and
	   deliver an email field. The Play mark stays, because the one thing this
	   button must say at a glance is "Android". */
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

	/* ── Photography ──────────────────────────────────────────────────────────
	   The page was image-free by design for a long time and the mockups carried
	   everything. These are the women's page only. Width and height are on every
	   <img> so the layout does not jump while they load — a hero that reflows
	   under her thumb on a 3G Bangalore connection costs more than it gains. */
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
		margin: 24px 0 26px;
		box-shadow: 0 22px 44px -26px rgba(27, 16, 32, 0.45);
	}

	.shot .cap {
		padding: 12px 16px 14px;
		margin: 0;
	}

	/* ── Lead capture ─────────────────────────────────────────────────────────
	   Sits under the Play button, never in front of it. Styled as a quieter
	   surface than .cta on purpose: this is the second option on the screen, and
	   two things competing to be the loudest would make the page harder to act on,
	   not easier. */
	.cap-box {
		margin: 18px 0 0;
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
		/* 16px exactly: iOS Safari zooms the whole page when a focused input is any
		   smaller, and a page that jumps on focus reads as broken. */
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
		font-size: 15px;
		font-weight: 800;
		white-space: nowrap;
		cursor: pointer;
	}

	.cap-go[disabled] {
		opacity: 0.6;
		cursor: default;
	}

	.cap-note,
	.cap-err {
		margin: 10px 0 0;
		font-size: 12px;
		line-height: 1.5;
	}

	.cap-note {
		color: var(--text-4);
	}

	.cap-err {
		color: var(--accent-bright);
		font-weight: 700;
	}

	.cap-done {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--text-2);
	}

	.cap-done strong {
		color: var(--text-1);
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

	/* The wordmark is lowercase, always — the lowercase and the "rite" spelling are
	   what carry the pun, so this one tag opts out of the uppercase eyebrow. */
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
	/* Drawn in CSS rather than shipped as images: they stay crisp at any size, they
	   restyle with the brand tokens, and they cost nothing to load on a phone that
	   just tapped an ad. */
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
	/* Scroll-driven, and CSS-only. The content is visible with no animation at all
	   by default; the @supports block is the ONLY place opacity is ever taken to 0,
	   so a browser without scroll-driven animations (or a person who asked for
	   reduced motion) gets a plain, fully readable page instead of a blank one.
	   This is the opposite of the usual JS reveal, where a script failing to run
	   leaves the page empty — not a risk worth taking on paid traffic. */
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
			.step,
			.card,
			.qa,
			.sec.mid .cta,
			.sec.close .cta {
				animation: rise linear both;
				animation-timeline: view();
				/* Ranged on `entry` alone, never on `cover`: an element in the last
				   screenful can't scroll far enough to finish a cover-based range, so
				   the closing CTA sat permanently half-faded. Entry completes as soon
				   as the element is properly on screen, wherever it sits. */
				animation-range: entry 0% entry 55%;
			}
		}
	}

	/* Wider screens: the page stays a phone-shaped column on purpose (this is paid
	   social traffic), but the tiles get room and the sticky bar steps back. */
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

		/* The persistent bar is a thumb-reach device. On a desktop window it is just
		   a floating slab over the content, and the page's own buttons are always a
		   short scroll away, so it goes. The footer keeps its padding either way. */
		.bar {
			display: none;
		}
	}
</style>
