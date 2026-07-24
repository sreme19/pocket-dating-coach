<script lang="ts">
	import type { PageData } from './$types';
	import { fade, slide } from 'svelte/transition';
	import RiteLogo from '$lib/verified-vibe/components/RiteLogo.svelte';

	let { data }: { data: PageData } = $props();

	let email = $state('');
	let platform = $state<'' | 'ios' | 'android'>('');
	let busy = $state(false);
	let error = $state('');
	let done = $state(false);

	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	const name = $derived(data.referrer?.first_name ?? 'her');
	const initial = $derived((data.referrer?.first_name ?? '?').charAt(0).toUpperCase());

	async function submit() {
		error = '';
		if (!EMAIL_RE.test(email.trim())) {
			error = 'Please enter a valid email address.';
			return;
		}
		if (platform !== 'ios' && platform !== 'android') {
			error = 'Please select your phone type.';
			return;
		}
		busy = true;
		try {
			const res = await fetch('/api/beta/submit', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ token: data.token, email: email.trim(), platform, mood: data.mood })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				error = body?.error ?? 'Something went wrong. Please try again.';
				return;
			}
			done = true;
		} catch {
			error = 'Network error. Please try again.';
		} finally {
			busy = false;
		}
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
		{:else if done}
			<div class="state">
				<div class="success-mark" aria-hidden="true">✓</div>
				<h1 class="title">You're on the list</h1>
				<p class="sub">
					Thanks! We'll email <strong>{email}</strong> the moment your spot opens up.{#if !data.mood} When you join,
					{name} will already be waiting in your matches.{/if}
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
				<h1 class="hl"><em>{name}</em> invited you into a curated circle</h1>
				<p class="hl-sub">riteangle is an invite-only, identity-verified network of high-functioning people, across tech, finance, founders, creatives and sport. First come, first served.</p>
				<div class="callout">
					<span class="ico">🤝</span>
					<span class="ctxt"><b>Here to meet someone too?</b> That works. Same circle, whenever you're ready.</span>
				</div>
			{:else if data.mood === 'casual'}
				<h1 class="hl"><em>{name}</em> thinks you'd love it here</h1>
				<p class="hl-sub">Not like the other apps: everyone's identity-verified, it skews high-earning (tech, finance, founders), and an AI filters out the creeps before they reach you.</p>
				<div class="callout">
					<span class="ico">✨</span>
					<span class="ctxt"><b>Come have fun with it.</b> No pressure, just genuinely good people.</span>
				</div>
			{:else if data.mood === 'serious'}
				<h1 class="hl"><em>{name}</em> invited you to something real</h1>
				<p class="hl-sub">Identity-verified members, an AI that filters out the noise, and people who actually want something serious, a lot of them in tech and finance.</p>
				<div class="callout">
					<span class="ico">💍</span>
					<span class="ctxt"><b>For people who mean it.</b> Verified, serious, worth your time.</span>
				</div>
			{:else}
				<h1 class="hl"><em>{name}</em> moved your chat here</h1>
				<p class="hl-sub">{name} gets a lot of messages, so she has her Bestie get to know you first. Impress her, and you're straight through to {name}.</p>
				<div class="callout">
					<span class="ico">💬</span>
					<span class="ctxt"><b>She only meets the guys her Bestie clicks with.</b> Make your first impression count.</span>
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
					onkeydown={(e) => e.key === 'Enter' && submit()}
					autocomplete="email"
				/>
				{#if platform === 'ios'}
					<p class="hint-ios" transition:fade={{ duration: 150 }}>
						📧 Use the same email as your Apple ID — TestFlight will send the invite there.
					</p>
				{/if}
			</div>

			<div class="field">
				<label class="label" for="beta-platform">Your phone</label>
				<select
					id="beta-platform"
					class="input select"
					class:placeholder={platform === ''}
					bind:value={platform}
				>
					<option value="" disabled>Select your phone type…</option>
					<option value="ios">iPhone (iOS)</option>
					<option value="android">Android</option>
				</select>
			</div>

			{#if error}
				<p class="error" transition:fade={{ duration: 150 }}>{error}</p>
			{/if}

			<button class="btn" onclick={submit} disabled={busy}>
				{busy ? 'Sending…' : 'Claim my invite →'}
			</button>

			<p class="legal">We'll only use your email to send your beta invite. No spam, ever.</p>
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

	/* Native select styled to match .input, with a custom caret. */
	.select {
		appearance: none;
		-webkit-appearance: none;
		cursor: pointer;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='none' stroke='%23b08' stroke-width='2' d='M1 1l5 5 5-5'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 14px center;
		padding-right: 38px;
	}

	.select.placeholder {
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

	.btn {
		width: 100%;
		padding: 14px 16px;
		border: none;
		border-radius: 14px;
		background: var(--accent);
		color: #fff;
		font-size: 15px;
		font-weight: 800;
		font-family: inherit;
		cursor: pointer;
		box-shadow: 0 12px 24px -8px var(--accent-glow);
		transition: background 200ms, transform 120ms;
	}

	.btn:hover:not(:disabled) {
		background: var(--accent-bright);
	}

	.btn:active:not(:disabled) {
		transform: translateY(1px);
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.legal {
		font-size: 12px;
		color: var(--text-4);
		text-align: center;
		margin: 13px 0 0;
		line-height: 1.5;
	}

	.hint-ios {
		font-size: 12px;
		color: #b45309;
		background: #fef3c7;
		border: 1px solid #fde68a;
		border-radius: 8px;
		padding: 8px 12px;
		margin: 8px 0 0;
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

	.sub strong {
		color: var(--text-1);
		font-weight: 700;
	}

	.success-mark {
		width: 52px;
		height: 52px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: var(--accent-tint);
		color: var(--accent-bright);
		font-size: 26px;
		font-weight: 800;
		margin-bottom: 16px;
	}
</style>
