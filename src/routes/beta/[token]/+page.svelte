<script lang="ts">
	import type { PageData } from './$types';
	import { fade, slide } from 'svelte/transition';
	import RiteLogo from '$lib/verified-vibe/components/RiteLogo.svelte';

	let { data }: { data: PageData } = $props();

	let email = $state('');
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
		busy = true;
		try {
			const res = await fetch('/api/beta/submit', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ token: data.token, email: email.trim() })
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
	<title>riteangle · private beta</title>
</svelte:head>

<div class="screen">
	<div class="brand" transition:fade={{ duration: 300 }}>
		<RiteLogo mark={true} word={true} markSize={30} />
	</div>

	<div class="card" transition:slide={{ duration: 400, axis: 'y' }}>
		{#if !data.valid}
			<h1 class="title">This invite isn't active</h1>
			<p class="sub">
				The link you followed has expired or was turned off. Ask the person who shared it for a
				fresh one.
			</p>
		{:else if done}
			<div class="success-mark" aria-hidden="true">✓</div>
			<h1 class="title">You're on the list</h1>
			<p class="sub">
				Thanks! We'll email <strong>{email}</strong> the moment your spot opens up. When you join,
				{name} will already be waiting in your matches.
			</p>
		{:else}
			<span class="pill"><span class="pulse" aria-hidden="true"></span> Private beta · invite only</span>

			<h1 class="title">Get matched today with <em>{name}</em></h1>
			<p class="sub">
				{name} wants to meet you on riteangle — a dating app where every profile is identity-verified,
				so the person you match with is exactly who they say they are.
			</p>

			<!-- Who invited you -->
			{#if data.referrer}
				<div class="match-card">
					<div class="photo">
						{#if data.referrer.avatar_url}
							<img src={data.referrer.avatar_url} alt={name} />
						{:else}
							<div class="photo-fallback">{initial}</div>
						{/if}
						<span class="verified-badge" title="Identity verified">✓ Verified</span>
						<div class="photo-overlay">
							<div class="match-name">
								{data.referrer.first_name}{data.referrer.age ? `, ${data.referrer.age}` : ''}
							</div>
							{#if data.referrer.city}
								<div class="match-meta">📍 {data.referrer.city}</div>
							{/if}
						</div>
					</div>
					<div class="match-tag">💌 Wants to match with you</div>
				</div>
			{/if}

			<p class="testing-note">
				We're still in private testing and letting people in a few at a time. Drop your email below
				and we'll send your invite — you'll start out already connected with {name}.
			</p>

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
			</div>

			{#if error}
				<p class="error" transition:fade={{ duration: 150 }}>{error}</p>
			{/if}

			<button class="btn" onclick={submit} disabled={busy}>
				{busy ? 'Sending…' : `Claim my invite →`}
			</button>

			<p class="legal">
				We'll only use your email to send your beta invite. No spam, ever.
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
		gap: 28px;
		padding: 24px 16px calc(32px + env(safe-area-inset-bottom, 0));
		background:
			radial-gradient(120% 90% at 50% -10%, var(--accent-tint) 0%, transparent 55%),
			var(--bg-1);
		font-family: var(--font-serif);
	}

	.brand {
		display: flex;
		align-items: center;
	}

	.card {
		width: 100%;
		max-width: 420px;
		background: var(--bg-2);
		border: 1px solid var(--border-2);
		border-radius: var(--r-lg);
		padding: 30px 26px;
		box-shadow: 0 20px 50px -24px rgba(122, 17, 51, 0.35);
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 11.5px;
		font-weight: 600;
		letter-spacing: 0.01em;
		color: var(--accent-bright);
		background: var(--accent-tint);
		border: 1px solid var(--accent-glow);
		padding: 5px 11px;
		border-radius: 999px;
		margin-bottom: 16px;
	}

	.pulse {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 0 0 var(--accent-glow);
		animation: pulse 1.8s infinite;
	}

	@keyframes pulse {
		0% { box-shadow: 0 0 0 0 var(--accent-glow); }
		70% { box-shadow: 0 0 0 7px transparent; }
		100% { box-shadow: 0 0 0 0 transparent; }
	}

	.title {
		font-size: 25px;
		line-height: 1.18;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--text-1);
		margin: 0 0 10px;
	}

	.title em {
		font-style: normal;
		color: var(--accent);
	}

	.sub {
		font-size: 14.5px;
		line-height: 1.6;
		color: var(--text-3);
		margin: 0 0 22px;
	}

	.sub strong {
		color: var(--text-1);
		font-weight: 700;
	}

	/* Match card — photo-forward */
	.match-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 12px;
		background: var(--bg-3);
		border: 1px solid var(--border-2);
		border-radius: 20px;
		margin-bottom: 20px;
	}

	.photo {
		position: relative;
		width: 100%;
		aspect-ratio: 4 / 3;
		border-radius: 14px;
		overflow: hidden;
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
		display: grid;
		place-items: center;
		background: linear-gradient(150deg, var(--accent) 0%, var(--accent-bright) 100%);
		color: #fff;
		font-size: 64px;
		font-weight: 800;
	}

	.verified-badge {
		position: absolute;
		top: 10px;
		right: 10px;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.92);
		color: var(--accent-bright);
		font-size: 11.5px;
		font-weight: 700;
		backdrop-filter: blur(4px);
	}

	.photo-overlay {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 28px 14px 12px;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.62) 0%, transparent 100%);
	}

	.match-name {
		font-size: 20px;
		font-weight: 800;
		color: #fff;
		line-height: 1.15;
		letter-spacing: -0.01em;
	}

	.match-meta {
		font-size: 13px;
		color: rgba(255, 255, 255, 0.88);
		margin-top: 3px;
	}

	.match-tag {
		font-size: 12.5px;
		font-weight: 600;
		color: var(--accent-bright);
		background: var(--accent-tint);
		padding: 6px 12px;
		border-radius: 999px;
	}

	.testing-note {
		font-size: 13.5px;
		line-height: 1.6;
		color: var(--text-2);
		margin: 0 0 20px;
	}

	/* Field */
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 14px;
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
		background: var(--bg-1);
		border: 1px solid var(--border-2);
		border-radius: 12px;
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

	.btn {
		width: 100%;
		padding: 14px 16px;
		border: none;
		border-radius: 14px;
		background: var(--accent);
		color: #fff;
		font-size: 15px;
		font-weight: 700;
		font-family: inherit;
		cursor: pointer;
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

	/* Success */
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
