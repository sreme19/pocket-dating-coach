<script lang="ts">
	import type { PageData } from './$types';
	import { fade, slide } from 'svelte/transition';
	import RiteLogo from '$lib/verified-vibe/components/RiteLogo.svelte';
	import StoreBadges from '$lib/components/StoreBadges.svelte';
	import type { Platform } from '$lib/store-links';

	let { data }: { data: PageData } = $props();

	/**
	 * Open testing (2026-08-03). Play is a public listing and TestFlight a public
	 * join link, so there is no tester allow-list and no admin in the loop: this
	 * page hands over the download itself instead of collecting a lead and waiting
	 * for a human to mail an invite.
	 *
	 * The email field survives that change on purpose, and it is the ONLY field
	 * left. verified_vibe_beta_signups.email is the sole link between a joiner and
	 * their referrer — redeemBetaInviteIfEligible and awardReferralRewardIfEligible
	 * both look the signup up by the address the person later signs in with. No
	 * row, no auto-match and no referral payout. The device dropdown and WhatsApp
	 * number went: we now learn the device from the button they actually tap, which
	 * is better data than a self-declared select, and the number was only ever for
	 * the manual invite chase that no longer happens.
	 */
	let email = $state('');
	let error = $state('');
	/** Set once the lead has been recorded, so a second tap doesn't re-post. */
	let captured = $state(false);

	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	const name = $derived(data.referrer?.first_name ?? null);
	const initial = $derived((data.referrer?.first_name ?? '?').charAt(0).toUpperCase());

	/** Gate: the buttons stay inert until there's an address worth recording. */
	const ready = $derived(EMAIL_RE.test(email.trim()));

	/**
	 * Record the lead, then let the anchor open the store.
	 *
	 * Fire-and-forget by design: the store is what the person asked for, and making
	 * them wait on our POST (or blocking the tap if it fails) would trade the thing
	 * they want for a row in our table. `keepalive` so the request survives the tab
	 * losing focus to the store app.
	 *
	 * `platform` is the button they tapped — the device we're actually confident
	 * about. Not awaited, and errors are swallowed: a lost row costs attribution,
	 * never the download.
	 */
	function capture(platform: Platform) {
		if (!ready) return;
		if (captured) return;
		captured = true;
		void fetch('/api/beta/submit', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			keepalive: true,
			body: JSON.stringify({
				token: data.token,
				email: email.trim(),
				platform,
				mood: data.mood
			})
		}).catch(() => {
			/* Non-fatal: they're on their way to the store either way. */
		});
	}

	/** Nudge, shown only if they reach for a button with no valid email yet. */
	function nudge() {
		if (!ready) error = 'Enter your email first — that\'s how we know the invite is yours.';
	}
</script>

<svelte:head>
	{#if data.valid && data.referrer}
		{@const ogTitle = `Get matched today with ${data.referrer.first_name} on riteangle`}
		{@const ogDesc = `${data.referrer.first_name}${data.referrer.age ? `, ${data.referrer.age}` : ''}${data.referrer.city ? ` · ${data.referrer.city}` : ''} is identity-verified on riteangle — and she wants to match with you. Claim your private-beta invite.`}
		<title>{ogTitle}</title>
		<meta name="description" content={ogDesc} />

		<meta property="og:type" content="website" />
		<meta property="og:site_name" content="riteangle" />
		<meta property="og:url" content={data.pageUrl} />
		<meta property="og:title" content={ogTitle} />
		<meta property="og:description" content={ogDesc} />
		{#if data.ogImage}
			<meta property="og:image" content={data.ogImage} />
			<meta property="og:image:alt" content={`${data.referrer.first_name} on riteangle`} />
		{/if}

		<meta name="twitter:card" content={data.ogImage ? 'summary_large_image' : 'summary'} />
		<meta name="twitter:title" content={ogTitle} />
		<meta name="twitter:description" content={ogDesc} />
		{#if data.ogImage}
			<meta name="twitter:image" content={data.ogImage} />
		{/if}
	{:else if data.valid}
		<!-- Admin-level link: valid, but not attributed to any real person —
		     generic brand card (logo image) instead of a referrer's photo. -->
		{@const ogTitle = 'riteangle · private beta'}
		{@const ogDesc = 'An identity-verified dating beta. Invite only.'}
		<title>{ogTitle}</title>
		<meta name="description" content={ogDesc} />

		<meta property="og:type" content="website" />
		<meta property="og:site_name" content="riteangle" />
		<meta property="og:url" content={data.pageUrl} />
		<meta property="og:title" content={ogTitle} />
		<meta property="og:description" content={ogDesc} />
		<meta property="og:image" content={data.ogImage} />
		<meta property="og:image:alt" content="riteangle" />

		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:title" content={ogTitle} />
		<meta name="twitter:description" content={ogDesc} />
		<meta name="twitter:image" content={data.ogImage} />
	{:else}
		<title>riteangle · private beta</title>
		<meta property="og:type" content="website" />
		<meta property="og:site_name" content="riteangle" />
		<meta property="og:title" content="riteangle · private beta" />
		<meta property="og:description" content="An identity-verified dating beta. Invite only." />
	{/if}
</svelte:head>

<div class="screen">
	<div class="col" transition:slide={{ duration: 400, axis: 'y' }}>
		<div class="brand" transition:fade={{ duration: 300 }}>
			<RiteLogo mark={true} word={true} markSize={28} />
		</div>

		{#if !data.valid}
			<div class="state">
				<h1 class="title">This invite isn't active</h1>
				<p class="sub">
					The link you followed has expired or was turned off. Ask the person who shared it for a
					fresh one.
				</p>
			</div>
		{:else}
			<!-- Hero: her photo leads -->
			{#if data.referrer}
				<div class="photo">
					{#if data.referrer.avatar_url}
						<img src={data.referrer.avatar_url} alt={name} />
					{:else}
						<div class="photo-fallback">{initial}</div>
					{/if}
					<div class="scrim"></div>
					<span class="vpill"><span class="tick">✓</span> Verified</span>
					<div class="id">
						<div class="nm">
							{data.referrer.first_name}<span>{data.referrer.age ? ` ${data.referrer.age}` : ''}</span>
						</div>
						{#if data.referrer.city}
							<div class="loc">📍 {data.referrer.city}</div>
						{/if}
					</div>
				</div>
			{/if}

			{#if data.mood === 'networking'}
				<h1 class="hl">{#if name}<em>{name}</em> invited you into a curated circle{:else}You're invited into a curated circle{/if}</h1>
				<p class="hl-sub">riteangle is an invite-only, identity-verified network of high-functioning people, across tech, finance, founders, creatives and sport. First come, first served.</p>
				<div class="callout">
					<span class="ico">🤝</span>
					<span class="ctxt"><b>Here to meet someone too?</b> That works. Same circle, whenever you're ready.</span>
				</div>
			{:else if data.mood === 'casual'}
				<h1 class="hl">{#if name}<em>{name}</em> thinks you'd love it here{:else}You're going to love it here{/if}</h1>
				<p class="hl-sub">Not like the other apps: everyone's identity-verified, it skews established professionals (tech, finance, founders), and an AI filters out the creeps before they reach you.</p>
				<div class="callout">
					<span class="ico">✨</span>
					<span class="ctxt"><b>Come have fun with it.</b> No pressure, just genuinely good people.</span>
				</div>
			{:else if data.mood === 'serious'}
				<h1 class="hl">{#if name}<em>{name}</em> invited you to something real{:else}You're invited to something real{/if}</h1>
				<p class="hl-sub">Identity-verified members, an AI that filters out the noise, and people who actually want something serious, a lot of them in tech and finance.</p>
				<div class="callout">
					<span class="ico">💍</span>
					<span class="ctxt"><b>For people who mean it.</b> Verified, serious, worth your time.</span>
				</div>
			{:else if name}
				<h1 class="hl"><em>{name}</em> moved your chat here</h1>
				<p class="hl-sub">{name} gets a lot of messages, so she has her Bestie get to know you first. Impress her, and you're straight through to {name}.</p>
				<div class="callout">
					<span class="ico">💬</span>
					<span class="ctxt"><b>She only meets the guys her Bestie clicks with.</b> Make your first impression count.</span>
				</div>
			{:else if data.isPrivate}
				<!-- Private link: the loader never even fetched the referrer, so there is
				     nothing to show. Say so plainly rather than letting it read as a
				     faceless mass invite. -->
				<h1 class="hl">You've got a private invite</h1>
				<p class="hl-sub">riteangle is an identity-verified community — every profile is checked before anyone matches. Real people, no noise.</p>
				<div class="callout">
					<span class="ico">🔒</span>
					<span class="ctxt"><b>Whoever invited you chose to stay private.</b> Their profile isn't shown here, and you won't be matched with them — you're joining the community, not their inbox.</span>
				</div>
			{:else}
				<h1 class="hl">You've been invited to riteangle</h1>
				<p class="hl-sub">An identity-verified dating community — every profile is checked before anyone matches. Real people, no noise.</p>
				<div class="callout">
					<span class="ico">🔒</span>
					<span class="ctxt"><b>Verified profiles only.</b> No bots, no catfish, no wasted time.</span>
				</div>
			{/if}

			<div class="field">
				<label class="label" for="beta-email">Your email</label>
				<input
					id="beta-email"
					type="email"
					class="input"
					placeholder="you@example.com"
					bind:value={email}
					oninput={() => (error = '')}
					autocomplete="email"
				/>
			</div>

			{#if error}
				<p class="error" transition:fade={{ duration: 150 }}>{error}</p>
			{/if}

			<!-- Store badges, inert until the email is valid. They stay real anchors
			     the whole time (never swapped for buttons) so long-press and
			     open-in-new-tab work the moment they go live. -->
			<div class="dl" onclickcapture={() => nudge()}>
				<StoreBadges
					locked={!ready}
					lockedLabel="Enter your email to unlock the download"
					onpick={capture}
				/>
			</div>

			<p class="dl-note">
				{#if ready}
					Pick your phone. Sign in with <strong>{email.trim()}</strong> so we know the invite is
					yours{#if !data.mood && name}{' '}— {name} will be waiting in your matches{/if}. On iPhone the
					link opens TestFlight (Apple's beta app), which walks you through the rest.
				{:else}
					Enter your email to unlock the download. Use the same address when you sign in — that's how
					we know the invite is yours.
				{/if}
			</p>

			<p class="legal">
				We'll only use your email for your invite and to reach you if something goes wrong. No spam,
				ever.
			</p>
		{/if}
	</div>
</div>

<style>
	.screen {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 28px 16px calc(36px + env(safe-area-inset-bottom, 0));
		background:
			radial-gradient(120% 80% at 50% -8%, var(--accent-tint) 0%, transparent 52%),
			var(--bg-1);
		font-family: var(--font-serif);
	}

	.col {
		width: 100%;
		max-width: 400px;
		display: flex;
		flex-direction: column;
	}

	.brand {
		display: flex;
		align-items: center;
		margin-bottom: 18px;
	}

	/* ── Hero photo (3:4, matches discover) ───────────────────────────────── */
	.photo {
		position: relative;
		width: 100%;
		aspect-ratio: 3 / 4;
		border-radius: 22px;
		overflow: hidden;
		isolation: isolate;
		box-shadow: 0 20px 48px -26px rgba(122, 17, 51, 0.5);
	}

	.photo img,
	.photo-fallback {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.photo img {
		object-fit: cover;
		display: block;
	}

	.photo-fallback {
		display: grid;
		place-items: center;
		background: linear-gradient(150deg, var(--accent) 0%, var(--accent-bright) 100%);
		color: #fff;
		font-size: 84px;
		font-weight: 800;
	}

	.scrim {
		position: absolute;
		inset: 0;
		z-index: 1;
		background: linear-gradient(
			to top,
			rgba(24, 6, 14, 0.74) 0%,
			rgba(24, 6, 14, 0.14) 36%,
			transparent 60%
		);
	}

	.vpill {
		position: absolute;
		z-index: 2;
		top: 13px;
		left: 13px;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 6px 12px 6px 8px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.94);
		color: var(--accent-bright);
		font-size: 12px;
		font-weight: 800;
		box-shadow: 0 4px 14px -4px rgba(122, 17, 51, 0.45);
		backdrop-filter: blur(6px);
	}

	.vpill .tick {
		width: 15px;
		height: 15px;
		border-radius: 50%;
		background: var(--accent);
		color: #fff;
		display: grid;
		place-items: center;
		font-size: 10px;
	}

	.id {
		position: absolute;
		z-index: 2;
		left: 17px;
		right: 17px;
		bottom: 15px;
		color: #fff;
	}

	.id .nm {
		font-size: 27px;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.04;
	}

	.id .nm span {
		font-weight: 600;
		opacity: 0.92;
	}

	.id .loc {
		font-size: 13px;
		font-weight: 600;
		opacity: 0.9;
		margin-top: 3px;
	}

	/* ── Copy ─────────────────────────────────────────────────────────────── */
	.hl {
		font-size: 24px;
		line-height: 1.16;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--text-1);
		margin: 18px 0 7px;
		text-wrap: balance;
	}

	.hl em {
		font-style: normal;
		color: var(--accent);
	}

	.hl-sub {
		font-size: 14px;
		line-height: 1.55;
		color: var(--text-3);
		margin: 0 0 15px;
	}

	/* ── Testing callout (urgency) ────────────────────────────────────────── */
	.callout {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-radius: 12px;
		background: rgba(240, 168, 52, 0.16);
		border: 1px solid rgba(240, 168, 52, 0.42);
		margin: 0 0 16px;
	}

	.callout .ico {
		flex: none;
		font-size: 15px;
	}

	.callout .ctxt {
		font-size: 12.5px;
		line-height: 1.42;
		font-weight: 600;
		color: #8a5a12;
	}

	.callout .ctxt b {
		color: #6e440b;
		font-weight: 800;
	}

	/* ── Form ─────────────────────────────────────────────────────────────── */
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 12px;
	}

	.label {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-2);
	}

	.input {
		width: 100%;
		box-sizing: border-box;
		padding: 13px 14px;
		background: var(--bg-2);
		border: 1px solid var(--border-2);
		border-radius: 13px;
		color: var(--text-1);
		font-size: 16px;
		font-family: inherit;
		outline: none;
		transition: border-color 200ms;
	}

	.input:focus {
		border-color: var(--accent);
	}

	.input::placeholder {
		color: var(--text-4);
	}

	.error {
		font-size: 13px;
		color: var(--accent-bright);
		background: var(--accent-tint);
		border: 1px solid var(--accent-glow);
		border-radius: 10px;
		padding: 9px 12px;
		margin: 0 0 12px;
	}

	.legal {
		font-size: 12px;
		color: var(--text-4);
		text-align: center;
		margin: 13px 0 0;
		line-height: 1.5;
	}

	/* ── Non-invite states (not active / success) ─────────────────────────── */
	.state {
		background: var(--bg-2);
		border: 1px solid var(--border-2);
		border-radius: var(--r-lg);
		padding: 30px 26px;
		box-shadow: 0 20px 50px -30px rgba(122, 17, 51, 0.35);
	}

	.title {
		font-size: 24px;
		line-height: 1.18;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--text-1);
		margin: 0 0 10px;
	}

	.sub {
		font-size: 14.5px;
		line-height: 1.6;
		color: var(--text-3);
		margin: 0;
	}

	/* ── Download badges ──────────────────────────────────────────────────── */
	/* Wrapper only — the badges themselves live in StoreBadges.svelte so every
	   download surface renders the same thing. */
	.dl {
		margin: 4px 0 0;
	}

	.dl-note {
		font-size: 12px;
		line-height: 1.5;
		color: var(--text-4);
		margin: 12px 0 0;
	}

</style>
