<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let email = $state('');
	let busy = $state(false);
	let error = $state('');
	let done = $state(false);

	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
	<div class="card">
		<div class="brand">riteangle</div>

		{#if !data.valid}
			<h1 class="title">Invite not available</h1>
			<p class="sub">
				This invite link isn't active. Ask the person who shared it for an up-to-date link.
			</p>
		{:else if done}
			<h1 class="title">You're on the list ✨</h1>
			<p class="sub">
				Thanks! We'll email you when your spot opens up. Keep an eye on your inbox.
			</p>
		{:else}
			<span class="pill">Private testing</span>
			<h1 class="title">riteangle is invite-only right now</h1>
			<p class="sub">
				We're still testing with a small group. Drop your email and we'll add you to the beta — when
				you join, you'll start out already connected with the person who invited you.
			</p>

			<div class="field">
				<label class="label" for="beta-email">Email address</label>
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
				<p class="error">{error}</p>
			{/if}

			<button class="btn" onclick={submit} disabled={busy}>
				{busy ? 'Sending…' : 'Request access →'}
			</button>

			<p class="legal">We'll only use your email to invite you to the beta.</p>
		{/if}
	</div>
</div>

<style>
	.screen {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px 16px;
		background: radial-gradient(120% 120% at 50% 0%, #14211c 0%, #0b1120 60%, #070b14 100%);
		color: #e5e7eb;
		font-family:
			ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
	}

	.card {
		width: 100%;
		max-width: 420px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 20px;
		padding: 32px 28px;
	}

	.brand {
		font-size: 15px;
		font-weight: 700;
		letter-spacing: -0.01em;
		color: #34d399;
		margin-bottom: 24px;
	}

	.pill {
		display: inline-block;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #fbbf24;
		background: rgba(251, 191, 36, 0.12);
		border: 1px solid rgba(251, 191, 36, 0.25);
		padding: 4px 10px;
		border-radius: 999px;
		margin-bottom: 14px;
	}

	.title {
		font-size: 24px;
		line-height: 1.2;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: #ffffff;
		margin: 0 0 10px;
	}

	.sub {
		font-size: 14px;
		line-height: 1.6;
		color: #9ca3af;
		margin: 0 0 24px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 16px;
	}

	.label {
		font-size: 13px;
		font-weight: 600;
		color: #9ca3af;
	}

	.input {
		width: 100%;
		box-sizing: border-box;
		padding: 13px 14px;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 12px;
		color: #ffffff;
		font-size: 16px;
		outline: none;
		transition: border-color 200ms;
	}

	.input:focus {
		border-color: #34d399;
	}

	.input::placeholder {
		color: #6b7280;
	}

	.error {
		font-size: 13px;
		color: #f87171;
		margin: 0 0 12px;
	}

	.btn {
		width: 100%;
		padding: 14px 16px;
		border: none;
		border-radius: 12px;
		background: #10b981;
		color: #04120c;
		font-size: 15px;
		font-weight: 700;
		cursor: pointer;
		transition: background 200ms;
	}

	.btn:hover:not(:disabled) {
		background: #34d399;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.legal {
		font-size: 12px;
		color: #6b7280;
		text-align: center;
		margin: 14px 0 0;
	}
</style>
