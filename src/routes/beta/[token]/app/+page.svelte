<script lang="ts">
	import type { PageData } from './$types';
	import RiteLogo from '$lib/verified-vibe/components/RiteLogo.svelte';
	import { storeChoices } from '$lib/store-links';

	let { data }: { data: PageData } = $props();

	const name = $derived(data.referrer?.first_name ?? null);
	const initial = $derived((data.referrer?.first_name ?? '?').charAt(0).toUpperCase());

	// BOTH stores, always — the detected device (?d= from the admin Copy button, or a
	// User-Agent sniff) only decides which one leads. This used to filter down to
	// one, which meant a device recorded weeks earlier on the /beta form, or a link
	// forwarded to a different phone, was a dead end.
	const buttons = $derived(storeChoices(data.platform));
</script>

<svelte:head>
	{#if data.valid && data.referrer}
		{@const ogTitle = `You're in — ${data.referrer.first_name} is waiting on riteangle`}
		{@const ogDesc = `You've been accepted into the riteangle early-access beta. Get the app and ${data.referrer.first_name} will be waiting in your matches.`}
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
	{:else}
		{@const ogTitle = "You're in — riteangle early access"}
		<title>{ogTitle}</title>
		<meta name="description" content="Your riteangle early-access invite. Get the app." />
		<meta property="og:type" content="website" />
		<meta property="og:site_name" content="riteangle" />
		<meta property="og:url" content={data.pageUrl} />
		<meta property="og:title" content={ogTitle} />
		<meta property="og:description" content="Your riteangle early-access invite. Get the app." />
	{/if}
	<!-- Invite pages must never be indexed: they name a real member. -->
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="screen">
	<div class="card">
		<div class="brand"><RiteLogo /></div>

		{#if !data.valid}
			<div class="state">
				<h1 class="title">This invite isn't active</h1>
				<p class="sub">
					The link you followed has expired or was turned off. Ask the person who shared it for a
					fresh one.
				</p>
			</div>
		{:else}
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

			<h1 class="hl">Congratulations — you're in! 🎉</h1>
			<!-- The {' '} literals are load-bearing: Svelte strips the newline between
			     text and a block tag, which glued "riteangle." to the next sentence. -->
			<p class="hl-sub">
				You've been accepted as an <b>early access member</b> of riteangle.{' '}{#if name}You've
					been matched with {name} — she'll be waiting for you in the app.{:else}Set up your profile
					and we'll introduce you to someone worth meeting — real people, properly verified.{/if}
			</p>

			<div class="cta">
				{#each buttons as b (b.platform)}
					<a
						class="btn"
						class:secondary={b.platform !== data.platform}
						href={b.url}
						target="_blank"
						rel="noreferrer">{b.label} →</a
					>
				{/each}
			</div>

			<p class="legal">
				{#if name}
					Get the app, finish a short setup, and {name} is already in your matches.
				{:else}
					Get the app and finish a short setup to start matching.
				{/if}
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
		padding: 24px 16px;
		background: var(--bg-1);
	}

	.card {
		width: 100%;
		max-width: 420px;
	}

	.brand {
		display: flex;
		justify-content: center;
		margin-bottom: 18px;
	}

	/* Hero — same treatment as the signup landing page, so an invitee who saw
	   one recognises the other. */
	.photo {
		position: relative;
		width: 100%;
		aspect-ratio: 4 / 5;
		border-radius: 20px;
		overflow: hidden;
		background: var(--bg-2);
		margin-bottom: 18px;
	}

	.photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.photo-fallback {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 64px;
		font-weight: 800;
		color: #fff;
		background: var(--accent);
	}

	.scrim {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.68) 0%, rgba(0, 0, 0, 0) 52%);
	}

	.vpill {
		position: absolute;
		top: 12px;
		left: 12px;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		background: #fff;
		color: var(--text-1);
		font-size: 12px;
		font-weight: 700;
		padding: 5px 10px;
		border-radius: 999px;
	}

	.tick {
		color: var(--accent);
		font-weight: 900;
	}

	.id {
		position: absolute;
		left: 16px;
		bottom: 14px;
		color: #fff;
	}

	.nm {
		font-size: 26px;
		font-weight: 800;
		line-height: 1.1;
	}

	.loc {
		font-size: 13px;
		font-weight: 600;
		opacity: 0.92;
		margin-top: 3px;
	}

	.hl {
		font-size: 24px;
		font-weight: 800;
		color: var(--text-1);
		margin: 0 0 8px;
		line-height: 1.2;
	}

	.hl-sub {
		font-size: 15px;
		line-height: 1.55;
		color: var(--text-2);
		margin: 0 0 18px;
	}

	.cta {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.btn {
		display: block;
		text-align: center;
		text-decoration: none;
		padding: 14px 16px;
		border-radius: 14px;
		background: var(--accent);
		color: #fff;
		font-size: 15px;
		font-weight: 800;
		box-shadow: 0 12px 24px -8px var(--accent-glow);
	}

	.btn:hover {
		background: var(--accent-bright);
	}

	/* The store we don't think they're on — offered anyway, ranked second. */
	.btn.secondary {
		background: var(--bg-2);
		color: var(--accent-bright);
		border: 1px solid var(--accent-glow);
		box-shadow: none;
	}

	.btn.secondary:hover {
		background: var(--accent-tint);
	}

	.legal {
		font-size: 12px;
		color: var(--text-4);
		text-align: center;
		margin: 13px 0 0;
		line-height: 1.5;
	}

	.state {
		text-align: center;
		padding: 24px 8px;
	}

	.title {
		font-size: 22px;
		font-weight: 800;
		color: var(--text-1);
		margin: 0 0 8px;
	}

	.sub {
		font-size: 15px;
		line-height: 1.55;
		color: var(--text-2);
		margin: 0;
	}
</style>
