<script lang="ts">
	/**
	 * /aibestie — the paid-social landing page that IS a conversation.
	 *
	 * /get sells the product and sends the tap to Play. This page skips the selling:
	 * a man taps the ad and is already talking to a woman's AI bestie, in a thread
	 * built to look exactly like the one he would see inside the app. The product
	 * demonstrates itself, and the install ask comes after he is invested rather
	 * than before he understands anything.
	 *
	 * IT DELIBERATELY DOES NOT REUSE THE APP'S CHAT PAGE. That file is 3,477 lines
	 * wired to the session, the stores and realtime, and none of it survives being
	 * pointed at an anonymous visitor. What is copied is the visual language and
	 * the poll-for-reply pattern; the state here is four fields.
	 *
	 * NOTHING IS WRITTEN UNTIL HE SPEAKS. Starting a session costs one narrow row
	 * and creates no identity at all — no auth user, no profile, no match. Her
	 * opener is rendered from the start response, so a visitor who reads it and
	 * leaves has cost a single row. His first message is what materialises the
	 * thread. See aibestie-session.ts for why it cannot be lazier than that.
	 *
	 * The bearer is therefore an OPAQUE token, not a Supabase JWT, and it lives
	 * under our own localStorage key. That also sidesteps a trap: had this used the
	 * shared supabase-js client, its persistence would have overwritten the session
	 * of anyone who is ALSO a signed-in member in the same browser — a member
	 * clicking his own ad would be logged out of his real account.
	 *
	 * WHAT THE PAGE MAY PROMISE is decided server-side by terminusMode() and
	 * arrives as `thread.terminus`. 'human' only when a real, consenting woman is
	 * behind the profile; otherwise 'artifact', which claims only what is true of
	 * any owner. The copy for each lives below and the page never picks between
	 * them on its own.
	 */
	import { onMount, onDestroy, tick } from 'svelte';
	import { page } from '$app/stores';
	import { STORE_LINKS } from '$lib/store-links';
	import { reportPageView } from '$lib/marketing/page-view-report';
	import {
		initMetaPixel,
		trackMeta,
		STORE_CLICK_EVENT as META_STORE_CLICK
	} from '$lib/marketing/meta-pixel';
	import { reportStoreClick } from '$lib/marketing/store-click-report';
	import PublicProfileBody from '$lib/verified-vibe/components/PublicProfileBody.svelte';

	/** Who she is, resolved server-side so the gate paints with her name. */
	let { data } = $props();

	/** Our own key. Never `supabase.auth.token` — see the note above. */
	const STORE_KEY = 'aibestie.session';

	/**
	 * Empty segments for the pre-materialised view, matching the real bar's stage
	 * weights so the control does not resize the instant the server takes over.
	 */
	const OPENING_SEGMENTS = [
		{ id: 'fit', label: 'Basics line up', weight: 10, earned: 0 },
		{ id: 'portfolio', label: 'Your profile holds up', weight: 30, earned: 0 },
		{ id: 'standout', label: 'What sets you apart', weight: 30, earned: 0 },
		{ id: 'corroboration', label: 'Backing up your claims', weight: 30, earned: 0 }
	];

	type View = 'gate' | 'chat';

	let view = $state<View>('gate');
	let token = $state<string | null>(null);
	let thread = $state<any>(null);
	let draft = $state('');
	let sending = $state(false);
	let starting = $state(false);
	let failed = $state<string | null>(null);

	let showProfile = $state(false);
	let profile = $state<any>(null);
	/** Set when her profile genuinely failed, so the sheet stops saying "loading". */
	let profileFailed = $state(false);
	let showLeaveSheet = $state(false);

	/**
	 * Which promise the GATE may make. The gate describes her BEFORE a session
	 * exists, so it cannot read `thread.terminus` and has to ask the readiness
	 * probe. Defaults to 'artifact' — the claim that is true of every owner — so a
	 * failed probe can never upgrade the page into promising a person.
	 */
	let gateTerminus = $state<'human' | 'artifact'>(
		data?.gate?.terminus === 'human' ? 'human' : 'artifact'
	);
	/**
	 * Her name + photo for the gate. Seeded from the server load so the first paint
	 * already names her — before this was client-only, and the opening frame of a
	 * paid click was an empty photo above "Meet her's AI bestie".
	 */
	let gateOwner = $state<{ firstName: string; avatarUrl: string | null } | null>(
		data?.gate?.owner ?? null
	);

	let poller: ReturnType<typeof setInterval> | null = null;
	let scroller: HTMLElement | null = null;

	const bestieTyping = $derived(!!thread?.awaitingReply);
	const closed = $derived(!!thread?.closed);
	// Falls back to the gate's copy of her, so the name is right on the very first
	// render as well as once a thread exists.
	const ownerName = $derived(thread?.owner?.firstName || gateOwner?.firstName || '');

	/**
	 * Play link with the ad's own utm_* forwarded as the install `referrer`, plus
	 * the claim code — the same attribution trick /get uses, carrying one extra
	 * value so the app can reunite him with this conversation. The code is also
	 * shown on screen, because the referrer is readable exactly once and only if
	 * the install came from this tap.
	 */
	const storeUrl = $derived.by(() => {
		const incoming = new URLSearchParams($page.url.search);
		for (const key of [...incoming.keys()]) if (!key.startsWith('utm_')) incoming.delete(key);
		if (incoming.size === 0) {
			// No utm_source in the default, on purpose. This used to claim
			// `utm_source=snapchat`, written when only Snap pointed here — then a
			// Meta campaign started sending untagged traffic, and every one of its
			// installs would have been recorded as Snapchat's. An absent source is
			// a gap the dashboard shows honestly; a fabricated one is a lie every
			// later query repeats. The page label still travels via ra_lp below.
			incoming.set('utm_campaign', 'aibestie_lp');
		}
		if (thread?.claimCode) incoming.set('ra_claim', thread.claimCode);
		// Marks which landing page produced the install, the same as /get and
		// /get-photos, so all three variants are comparable at install rather
		// than only at tap.
		incoming.set('ra_lp', 'aibestie');
		return `${STORE_LINKS.android}&referrer=${encodeURIComponent(incoming.toString())}`;
	});

	async function api(path: string, init: RequestInit = {}) {
		return fetch(path, {
			...init,
			headers: {
				'Content-Type': 'application/json',
				...(token ? { Authorization: `Bearer ${token}` } : {}),
				...(init.headers ?? {})
			}
		});
	}

	async function loadThread() {
		const res = await api('/api/aibestie/thread');
		if (res.status === 401 || res.status === 404) {
			// Token expired or the session was reaped. Drop it and start over rather
			// than leaving him on a page that silently cannot send.
			localStorage.removeItem(STORE_KEY);
			token = null;
			view = 'gate';
			return;
		}
		if (!res.ok) return;
		thread = await res.json();
		await tick();
		scroller?.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
	}

	/** Poll only while she owes him a reply — never a permanent background timer. */
	function syncPoller() {
		const wanted = bestieTyping;
		if (wanted && !poller) poller = setInterval(loadThread, 2500);
		if (!wanted && poller) {
			clearInterval(poller);
			poller = null;
		}
	}
	$effect(syncPoller);

	async function begin() {
		if (starting) return;
		starting = true;
		failed = null;
		try {
			const res = await fetch(`/api/aibestie/start${$page.url.search}`, { method: 'POST' });
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				failed =
					body.error === 'rate_limited'
						? "You've started a few of these already — give it an hour."
						: 'Something went wrong opening the chat. Try again in a moment.';
				return;
			}
			const started = await res.json();
			token = started.token;
			localStorage.setItem(STORE_KEY, JSON.stringify({ token }));

			// Paint from the start response rather than round-tripping. There is no
			// thread in the database yet — that happens when he replies — so this is
			// the only source for her opener until then.
			thread = {
				// The id is returned at the TOP level of the start response, not inside
				// `owner`. Without it folded in here, openProfile's guard fired on every
				// fresh session and the profile sheet sat on "Loading her profile…"
				// forever — invisible in testing, because sending a message replaces
				// this object with the server's, which does carry it.
				owner: { ...started.owner, id: started.ownerId },
				messages: [
					{ id: 'opener', fromOwner: true, content: started.opener, createdAt: new Date().toISOString() }
				],
				bar: { percent: 0, stages: OPENING_SEGMENTS, nextLabel: 'Tell her a bit more', capped: false },
				turns: 0,
				maxTurns: 5,
				closed: false,
				terminus: gateTerminus,
				claimCode: started.claimCode,
				awaitingReply: false
			};
			view = 'chat';
		} catch {
			failed = 'Something went wrong opening the chat. Try again in a moment.';
		} finally {
			starting = false;
		}
	}

	async function send() {
		const content = draft.trim();
		if (!content || sending || closed) return;
		sending = true;
		draft = '';
		// Optimistic: his own words appear instantly. The server's copy replaces
		// this on the next load, so a rejected send simply disappears.
		thread = {
			...thread,
			messages: [
				...thread.messages,
				{ id: `pending-${Date.now()}`, fromOwner: false, content, createdAt: new Date().toISOString() }
			],
			awaitingReply: true
		};
		await tick();
		scroller?.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
		try {
			const res = await api('/api/aibestie/thread', {
				method: 'POST',
				body: JSON.stringify({ content })
			});
			if (!res.ok) draft = content; // give it back rather than swallowing it
			await loadThread();
		} finally {
			sending = false;
		}
	}

	async function openProfile() {
		showProfile = true;
		if (profile) return;
		profileFailed = false;
		const ownerId = thread?.owner?.id;
		if (!ownerId) {
			profileFailed = true;
			return;
		}
		let res: Response;
		try {
			res = await fetch(`/api/verified-vibe/public-profile/${ownerId}`);
		} catch {
			profileFailed = true;
			return;
		}
		if (!res.ok) {
			// Previously this just returned, leaving the sheet on "Loading her
			// profile…" indefinitely — a failure indistinguishable from a slow network.
			profileFailed = true;
			return;
		}
		const { data } = await res.json();
		// Income and net worth are stripped on this surface. The endpoint applies no
		// viewer-based redaction — it was built for signed-in members — and those
		// fields add nothing to an ad's job while being the most sensitive thing on
		// a real woman's profile once one is staffed here.
		profile = { ...data, moneyMatters: null };
	}

	/**
	 * Off to Google Play, telling everyone who needs to know on the way out.
	 *
	 * `which` names the CTA that earned the tap — the header Continue, the
	 * in-chat signup gate, the profile sheet, the leave sheet. They are four
	 * different moments of persuasion, and lumping them would hide the only
	 * question this page exists to answer: what makes a man leave a conversation
	 * he is enjoying to go install the app.
	 *
	 * Three reports, deliberately redundant:
	 *  - cta-click marks the aibestie_lp_sessions row (first-party funnel);
	 *  - trackMeta is the browser pixel copy — often lost, because this navigates
	 *    the SAME tab and the pixel flushes on a ~1s timer, the exact teardown
	 *    race that zeroed /get's store clicks for a week;
	 *  - reportStoreClick is the keepalive server copy that survives the
	 *    teardown, carries fbc/fbp, and shares eventId so Meta dedupes the pair.
	 */
	function goToStore(which: string) {
		if (token) api('/api/aibestie/cta-click', { method: 'POST' }).catch(() => {});

		const campaign = $page.url.searchParams.get('utm_campaign') ?? 'aibestie_lp';
		const eventId = crypto.randomUUID();
		trackMeta(META_STORE_CLICK, { cta: which, campaign }, eventId);
		reportStoreClick({ eventId, page: 'aibestie', cta: which, campaign, url: $page.url });

		window.location.href = storeUrl;
	}

	function onBack() {
		showLeaveSheet = true;
	}

	onMount(() => {
		/**
		 * Count the arrival in the same table as /get and /get-photos.
		 *
		 * aibestie_lp_sessions already records an arrival with its utm, so this
		 * looks redundant and is not, for two reasons. It is written only when
		 * AIBESTIE_LP_GATE is on — which it currently is not, so paid traffic
		 * arriving here today is recorded nowhere at all and the page reads as
		 * having no visitors rather than as switched off. And the funnel wants one
		 * definition of "a landing page view" across all three pages; deriving it
		 * from a different table per page is how two charts on the same dashboard
		 * end up quietly disagreeing about the denominator.
		 *
		 * aibestie_lp_sessions keeps the job only it can do: conversation depth.
		 */
		reportPageView({
			page: 'aibestie',
			campaign: $page.url.searchParams.get('utm_campaign') ?? 'aibestie_lp',
			url: $page.url
		});

		/**
		 * Meta pixel, now that Meta ads point here. Origin-gated internally, so a
		 * dev machine never fires it.
		 *
		 * A pixel on a CHAT page needs saying why it is safe: initMetaPixel forces
		 * autoConfig off before init, which is the switch that stops Meta inventing
		 * events off our buttons and reading the page for contact details — and the
		 * dataset's "track events automatically" is off too. What Meta receives is
		 * the URL, the referrer, and exactly the events we send; never the
		 * conversation. That containment is also why this stays scoped to landing
		 * pages and must never move into a layout.
		 *
		 * Snap deliberately absent here for now — no Snap campaign points at this
		 * page, and a pixel that fires with no campaign behind it is denominator
		 * noise in someone else's dashboard.
		 */
		initMetaPixel();

		// Only when the server load could not answer. It normally can, so this is the
		// fallback for a database blip during SSR rather than the usual path.
		if (!data?.gate) {
			fetch('/api/aibestie/start')
				.then((r) => r.json())
				.then((r) => {
					if (r?.terminus === 'human') gateTerminus = 'human';
					if (r?.owner) gateOwner = r.owner;
				})
				.catch(() => {
					/* stays 'artifact' — the safe claim */
				});
		}

		try {
			const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
			if (saved?.token) {
				token = saved.token;
				view = 'chat';
				loadThread();
			}
		} catch {
			/* corrupt entry — fall through to the gate */
		}
	});

	onDestroy(() => {
		if (poller) clearInterval(poller);
	});
</script>

<svelte:head>
	<!--
		Never hardcode the owner here. The roster rotates and is env-driven, so a
		literal name is wrong the moment it changes — this said "Jessica" while the
		page was serving Linda. Generic until the session tells us who she is.
	-->
	<title>{ownerName ? `Talk to ${ownerName}'s AI bestie` : 'Talk to her AI bestie'}</title>
	<meta name="theme-color" content="#FFF3F0" />
	<!-- A page whose whole body is a private conversation has no business in an index. -->
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="shell">
	{#if view === 'gate'}
		<div class="gate">
			<!--
				The hook, above even her photo: the one sentence of positioning the
				visitor gets before the page starts being a conversation. It states the
				product's whole difference — a match handed to you, no swiping — and it
				must NOT crowd the h1 below, which carries the page's honesty ("AI
				bestie") and keeps that job to itself.
			-->
			<p class="gate-kicker">We have given you a Match. No Swiping.</p>
			<div class="gate-photo">
				{#if gateOwner?.avatarUrl}
					<img src={gateOwner.avatarUrl} alt={gateOwner.firstName || 'Her profile'} />
				{/if}
			</div>
			<!--
				"AI bestie" has to stay in the HEADING, not just the line under it.
				This is the page's disclosure, and it is what makes an advert that shows
				a woman honest about who answers — so it has to survive someone who reads
				four words and taps. The warmth is in the phrasing, never in burying it.
			-->
			<h1>Meet {gateOwner?.firstName ?? 'her'}'s AI bestie</h1>
			<!--
				The second sentence is the ONLY part that varies, and it varies because
				"then with her" is a claim about a person. terminusMode() decides whether
				anyone is actually behind the profile; an unstaffed owner gets the line
				that is true of every owner instead. See aibestie-owner.ts.
			-->
			<p class="gate-sub">
				You'll speak to {gateOwner?.firstName ?? 'her'}'s AI bestie first.
				{#if gateTerminus === 'human'}
					Then with {gateOwner?.firstName ?? 'her'} herself.
				{:else}
					Everything you tell her is saved to your profile.
				{/if}
			</p>
			<button class="cta" onclick={begin} disabled={starting}>
				{starting ? 'Opening…' : "I'm 18 or over — start chatting"}
			</button>
			{#if failed}<p class="gate-error">{failed}</p>{/if}
			<!--
				Storage notice. Says only what storage is FOR, and nothing about who
				reads it — the sentence above already makes whichever claim the owner's
				staffing has earned, and repeating it here in weaker words is how the
				human promise crept back in the first time.
			-->
			<p class="gate-note">
				This chat is saved to your profile so you can pick it up in the app.
				<a href="/verified-vibe/privacy">Privacy</a>
			</p>
		</div>
	{:else if thread}
		<header class="bar">
			<button class="icon" onclick={onBack} aria-label="Back">
				<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2">
					<path d="M15 5l-7 7 7 7" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>

			<button class="who" onclick={openProfile}>
				<span class="ava">
					{#if thread.owner.avatarUrl}
						<img src={thread.owner.avatarUrl} alt={ownerName} />
					{/if}
					<span class="ava-badge">✦</span>
				</span>
				<span class="who-text">
					<span class="who-name">{ownerName}{thread.owner.age ? `, ${thread.owner.age}` : ''}</span>
					<span class="who-sub">✦ AI Bestie</span>
				</span>
			</button>

			<button class="signup" onclick={() => goToStore('header')}>Continue</button>
		</header>

		<div class="progress">
			<div class="progress-top">
				<span class="progress-dot"></span>
				<span class="progress-label">AI Bestie</span>
				<span class="progress-pct">{Math.round(thread.bar.percent)}%</span>
			</div>
			<div class="segments">
				{#each thread.bar.stages as stage (stage.id)}
					<div class="seg" style="flex:{stage.weight}">
						<div
							class="seg-fill seg-{stage.id}"
							style="width:{(stage.earned / stage.weight) * 100}%"
						></div>
					</div>
				{/each}
			</div>
			{#if thread.bar.nextLabel}
				<p class="progress-next">{thread.bar.nextLabel}</p>
			{/if}
		</div>

		<div class="thread" bind:this={scroller}>
			{#each thread.messages as m (m.id)}
				{#if m.fromOwner}
					<div class="row">
						<p class="from">✦ {ownerName}'s AI Bestie</p>
						<div class="bubble hers">{m.content}</div>
					</div>
				{:else}
					<div class="row mine">
						<div class="bubble his">{m.content}</div>
					</div>
				{/if}
			{/each}

			{#if bestieTyping}
				<div class="row">
					<p class="from">✦ {ownerName}'s AI Bestie</p>
					<div class="bubble hers typing"><span></span><span></span><span></span></div>
				</div>
			{/if}

			{#if closed}
				<div class="cta-card">
					<p class="cta-line">
						{#if thread.terminus === 'human'}
							You've answered these better than most people I talk to. I want {ownerName} to
							read this properly — she's the one who decides from here.
						{:else}
							You've answered these better than most people I talk to. Everything you've told
							me is saved — get the app and it goes straight onto your profile.
						{/if}
					</p>
					<button class="cta" onclick={() => goToStore('chat_gate')}>Sign up on Google Play</button>
					{#if thread.claimCode}
						<p class="cta-code">Your code: <strong>{thread.claimCode}</strong></p>
					{/if}
				</div>
			{/if}
		</div>

		<div class="composer">
			{#if closed}
				<div class="locked">Sign up to keep chatting</div>
			{:else}
				<input
					bind:value={draft}
					placeholder="Message…"
					maxlength="2000"
					disabled={sending}
					onkeydown={(e) => e.key === 'Enter' && send()}
				/>
				<button class="send" onclick={send} disabled={sending || !draft.trim()} aria-label="Send">
					<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4">
						<path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
			{/if}
		</div>
	{:else}
		<div class="gate"><p class="gate-sub">Loading…</p></div>
	{/if}

	{#if showProfile}
		<div class="sheet-full">
			<header class="bar">
				<button class="icon" onclick={() => (showProfile = false)} aria-label="Close">
					<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2">
						<path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
					</svg>
				</button>
				<span class="who-name">{ownerName}{thread?.owner?.age ? `, ${thread.owner.age}` : ''}</span>
			</header>
			<div class="profile-scroll">
				{#if profile}
					<PublicProfileBody {profile} subjectUserId={thread.owner.id} surface="aibestie_lp" />
				{:else if profileFailed}
					<p class="gate-sub">Couldn't load her profile just now.</p>
					<button class="ghost" onclick={openProfile}>Try again</button>
				{:else}
					<p class="gate-sub">Loading her profile…</p>
				{/if}
			</div>
			<!--
				Her profile is the highest-intent screen on the page — he opened it because
				he wants her — and it was a dead end: a long scroll whose only exit was the
				X. The CTA is PINNED rather than appended to the scroll, because the body
				runs several screens and an install ask below the fold is one nobody sees.

				Copy is deliberately terminus-INDEPENDENT. Every other conversion surface
				branches on whether a real woman is behind the profile, and each branch is a
				separate chance to promise a person who does not exist. This says only what
				is true of any owner — mirroring the leave sheet, which already carries the
				vetted framing for "he wants more of this".
			-->
			<div class="profile-cta">
				<p>Sign up to see the women you'd actually match with — and keep this conversation.</p>
				<button class="cta" onclick={() => goToStore('profile_sheet')}>Sign up on Google Play</button>
			</div>
		</div>
	{/if}

	{#if showLeaveSheet}
		<div class="scrim">
			<div class="sheet">
				<div class="grab"></div>
				<h2>There are others like {ownerName}</h2>
				<p>
					Sign up to see the women you'd actually match with — and keep this conversation.
				</p>
				<button class="cta" onclick={() => goToStore('leave_sheet')}>Sign up on Google Play</button>
				<button class="ghost" onclick={() => (showLeaveSheet = false)}>
					Keep talking to {ownerName}
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.shell {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100dvh;
		max-width: 560px;
		margin: 0 auto;
		background: var(--bg-1, #fff3f0);
		font-family: var(--font-serif, 'Gabarito', system-ui, sans-serif);
		color: #1a1a1a;
		overflow: hidden;
	}

	/* ── Age gate ─────────────────────────────────────────────── */
	.gate {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 2rem 1.5rem;
	}
	/* The positioning line above her photo. Styled as a kicker — small, spaced,
	   confident — so it reads as a banner over the page rather than competing
	   with the h1, whose disclosure job it must not dilute. */
	.gate-kicker {
		font-size: 0.9rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--accent-bright, #e11d54);
		margin: 0 0 1rem;
	}
	/* Big and flat rather than a small circle: she is what the ad promised, so she
	   should be the first thing on the page at a size worth looking at. */
	.gate-photo {
		width: 100%;
		max-width: 320px;
		aspect-ratio: 4 / 5;
		border-radius: 18px;
		background: #f0cdd4;
		margin-bottom: 1.4rem;
		overflow: hidden;
	}
	.gate-photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.gate h1 {
		font-size: 1.35rem;
		font-weight: 600;
		margin: 0 0 0.6rem;
	}
	.gate-sub {
		font-size: 0.95rem;
		line-height: 1.55;
		color: #7c6b6b;
		margin: 0 0 1.4rem;
		max-width: 22rem;
	}
	.gate-note {
		font-size: 0.78rem;
		line-height: 1.5;
		color: #9a8a88;
		margin: 1rem 0 0;
		max-width: 22rem;
	}
	.gate-note a {
		color: #9a8a88;
	}
	.gate-error {
		color: var(--accent-bright, #e11d54);
		font-size: 0.85rem;
		margin: 0.9rem 0 0;
	}

	/* ── Header ───────────────────────────────────────────────── */
	.bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.7rem 0.6rem;
		flex-shrink: 0;
	}
	.icon,
	.who,
	.signup,
	.send,
	.ghost {
		border: 0;
		background: none;
		font: inherit;
		cursor: pointer;
		color: inherit;
	}
	.icon {
		display: grid;
		place-items: center;
		padding: 0.25rem;
	}
	.who {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex: 1;
		min-width: 0;
		text-align: left;
		padding: 0;
	}
	.ava {
		position: relative;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: #e3b9c4;
		flex-shrink: 0;
		display: block;
	}
	.ava img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}
	.ava-badge {
		position: absolute;
		right: -2px;
		bottom: -2px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--accent, #ff3b6b);
		color: #fff;
		font-size: 9px;
		display: grid;
		place-items: center;
	}
	.who-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.who-name {
		font-size: 0.98rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.who-sub {
		font-size: 0.74rem;
		color: var(--accent-bright, #e11d54);
		font-weight: 500;
	}
	.signup {
		background: var(--accent, #ff3b6b);
		color: #fff;
		font-size: 0.82rem;
		font-weight: 600;
		padding: 0.5rem 0.95rem;
		border-radius: 999px;
		flex-shrink: 0;
	}

	/* ── Progress card ────────────────────────────────────────── */
	.progress {
		background: #fff;
		margin: 0 0.7rem;
		border-radius: 14px;
		padding: 0.7rem 0.8rem;
		flex-shrink: 0;
	}
	.progress-top {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.progress-dot {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--accent, #ff3b6b);
	}
	.progress-label {
		flex: 1;
		font-size: 0.85rem;
		font-weight: 600;
	}
	.progress-pct {
		font-size: 1rem;
		font-weight: 700;
		color: var(--accent-bright, #e11d54);
	}
	.segments {
		display: flex;
		gap: 3px;
		margin-top: 0.55rem;
	}
	.seg {
		height: 8px;
		border-radius: 5px;
		background: #f3e3e0;
		overflow: hidden;
	}
	.seg-fill {
		height: 100%;
		border-radius: 5px;
		transition: width 420ms ease;
	}
	/* Same stage colours as the Flutter bar, so the page is the same control. */
	.seg-fit { background: #7c6bf0; }
	.seg-portfolio { background: #3ba3f0; }
	.seg-standout { background: #f09a2b; }
	.seg-corroboration { background: #22a97a; }
	.progress-next {
		font-size: 0.74rem;
		color: #8a7a78;
		margin: 0.5rem 0 0;
	}

	/* ── Thread ───────────────────────────────────────────────── */
	.thread {
		flex: 1;
		overflow-y: auto;
		padding: 0.9rem 0.7rem 0.4rem;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.row {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}
	.row.mine {
		align-items: flex-end;
	}
	.from {
		font-size: 0.72rem;
		color: var(--accent-bright, #e11d54);
		font-weight: 600;
		margin: 0 0 0.28rem 0.2rem;
	}
	.bubble {
		max-width: 84%;
		padding: 0.7rem 0.85rem;
		border-radius: 14px;
		font-size: 0.94rem;
		line-height: 1.5;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.hers {
		background: #fce7e7;
		border: 1px solid #f2a0ae;
	}
	.his {
		background: var(--accent, #ff3b6b);
		color: #fff;
	}
	.typing {
		display: flex;
		gap: 4px;
		align-items: center;
	}
	.typing span {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #d78d9c;
		animation: blink 1.2s infinite;
	}
	.typing span:nth-child(2) { animation-delay: 0.18s; }
	.typing span:nth-child(3) { animation-delay: 0.36s; }
	@keyframes blink {
		0%, 60%, 100% { opacity: 0.28; }
		30% { opacity: 1; }
	}

	/* ── Conversion card ──────────────────────────────────────── */
	.cta-card {
		background: #fff;
		border: 1px solid #f2a0ae;
		border-radius: 14px;
		padding: 0.9rem;
		margin-top: 0.3rem;
	}
	.cta-line {
		font-size: 0.92rem;
		line-height: 1.5;
		margin: 0 0 0.75rem;
	}
	.cta {
		display: block;
		width: 100%;
		background: var(--accent, #ff3b6b);
		color: #fff;
		border: 0;
		font: inherit;
		font-weight: 600;
		font-size: 0.95rem;
		padding: 0.8rem 1rem;
		border-radius: 999px;
		cursor: pointer;
		text-align: center;
	}
	.cta:disabled {
		opacity: 0.55;
	}
	.cta-code {
		text-align: center;
		font-size: 0.78rem;
		color: #8a7a78;
		margin: 0.6rem 0 0;
	}

	/* ── Composer ─────────────────────────────────────────────── */
	.composer {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 0.7rem 0.9rem;
		flex-shrink: 0;
	}
	.composer input {
		flex: 1;
		border: 0;
		background: #f7e6e3;
		border-radius: 999px;
		padding: 0.8rem 1rem;
		font: inherit;
		font-size: 0.92rem;
		color: #1a1a1a;
		min-width: 0;
	}
	.composer input:focus {
		outline: 2px solid var(--accent, #ff3b6b);
		outline-offset: 1px;
	}
	.send {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--accent, #ff3b6b);
		color: #fff;
		display: grid;
		place-items: center;
		flex-shrink: 0;
	}
	.send:disabled {
		opacity: 0.45;
	}
	.locked {
		flex: 1;
		background: #f3e3e0;
		border-radius: 999px;
		padding: 0.8rem 1rem;
		font-size: 0.88rem;
		color: #a89392;
		text-align: center;
	}

	/* ── Overlays ─────────────────────────────────────────────── */
	.sheet-full {
		position: absolute;
		inset: 0;
		background: var(--bg-1, #fff3f0);
		display: flex;
		flex-direction: column;
		z-index: 20;
	}
	.profile-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 0 0.9rem 2rem;
	}
	/* A flex sibling of the scroller, not a fixed overlay: it reserves its own space,
	   so it can never cover the last line of her profile on a short viewport. */
	.profile-cta {
		flex-shrink: 0;
		background: var(--bg-1, #fff3f0);
		border-top: 1px solid #f3e3e0;
		padding: 0.8rem 1.1rem calc(0.9rem + env(safe-area-inset-bottom));
	}
	.profile-cta p {
		font-size: 0.84rem;
		line-height: 1.45;
		color: #7c6b6b;
		text-align: center;
		margin: 0 0 0.65rem;
	}
	.scrim {
		position: absolute;
		inset: 0;
		background: rgba(26, 12, 16, 0.4);
		display: flex;
		align-items: flex-end;
		z-index: 30;
	}
	.sheet {
		width: 100%;
		background: #fff;
		border-radius: 18px 18px 0 0;
		padding: 0.9rem 1.1rem 1.6rem;
		text-align: center;
	}
	.grab {
		width: 34px;
		height: 4px;
		border-radius: 2px;
		background: #eadcda;
		margin: 0 auto 0.9rem;
	}
	.sheet h2 {
		font-size: 1.1rem;
		font-weight: 600;
		margin: 0 0 0.45rem;
	}
	.sheet p {
		font-size: 0.9rem;
		line-height: 1.5;
		color: #7c6b6b;
		margin: 0 0 1rem;
	}
	.ghost {
		display: block;
		width: 100%;
		padding: 0.75rem;
		margin-top: 0.5rem;
		color: #7c6b6b;
		font-size: 0.9rem;
	}
</style>
