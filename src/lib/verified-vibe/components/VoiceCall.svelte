<!--
  VoiceCall.svelte — the male match's "call her AI bestie" experience.

  Flow: idle button -> consent sheet -> connect to the LiveKit room the server
  created -> in-call panel (timer, mute, hang up). The bestie agent joins from
  the worker and speaks; we just publish the mic and play her audio track. When
  the call ends, the worker summarises it and the recap lands in this thread via
  the normal message poll — so there's nothing to render here afterwards.

  Self-contained: imports the same supabase client the page uses for its token,
  and lazy-imports livekit-client so it never weighs on first paint.
-->
<script lang="ts">
	let { conversationId, ownerName }: { conversationId: string; ownerName: string } = $props();

	type Phase = 'idle' | 'consent' | 'connecting' | 'live' | 'ended' | 'error';
	let phase = $state<Phase>('idle');
	let errorMsg = $state('');
	let muted = $state(false);
	let elapsed = $state(0);

	let room: any = null;
	let audioEl: HTMLAudioElement | null = null;
	let timer: ReturnType<typeof setInterval> | null = null;

	async function authToken(): Promise<string | null> {
		const { getSupabaseClient } = await import('$lib/client/supabase');
		const { data } = await getSupabaseClient().auth.getSession();
		return data.session?.access_token ?? null;
	}

	function startTimer() {
		const t0 = Date.now();
		timer = setInterval(() => (elapsed = Math.round((Date.now() - t0) / 1000)), 1000);
	}

	function fmt(s: number) {
		const m = Math.floor(s / 60);
		const r = s % 60;
		return `${m}:${r.toString().padStart(2, '0')}`;
	}

	async function connect() {
		phase = 'connecting';
		errorMsg = '';
		try {
			const token = await authToken();
			if (!token) throw new Error('Please sign in again.');

			const res = await fetch('/api/voice/calls/start', {
				method: 'POST',
				headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({ matchId: conversationId, consent: true })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.message || data?.error || 'Could not start the call.');

			const { Room, RoomEvent, Track } = await import('livekit-client');
			room = new Room({ adaptiveStream: true, dynacast: true });

			room.on(RoomEvent.TrackSubscribed, (track: any) => {
				if (track.kind === Track.Kind.Audio && audioEl) {
					track.attach(audioEl);
				}
			});
			room.on(RoomEvent.Disconnected, () => endLocal());

			await room.connect(data.wsUrl, data.token);
			await room.localParticipant.setMicrophoneEnabled(true);

			phase = 'live';
			startTimer();
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Something went wrong.';
			phase = 'error';
			await cleanup();
		}
	}

	async function toggleMute() {
		if (!room) return;
		muted = !muted;
		await room.localParticipant.setMicrophoneEnabled(!muted);
	}

	function endLocal() {
		if (phase === 'live' || phase === 'connecting') phase = 'ended';
		void cleanup();
	}

	async function hangUp() {
		phase = 'ended';
		await cleanup();
	}

	async function cleanup() {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
		try {
			await room?.disconnect();
		} catch {
			/* ignore */
		}
		room = null;
	}

	function reset() {
		phase = 'idle';
		elapsed = 0;
		muted = false;
		errorMsg = '';
	}
</script>

<audio bind:this={audioEl} autoplay></audio>

{#if phase === 'idle'}
	<button class="vc-launch" onclick={() => (phase = 'consent')} type="button">
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
		</svg>
		Talk to {ownerName}'s AI bestie
	</button>
{/if}

{#if phase === 'consent'}
	<div class="vc-sheet">
		<p class="vc-title">Voice call with {ownerName}'s AI bestie</p>
		<p class="vc-body">
			You'll have a live voice chat with {ownerName}'s AI bestie — an AI, speaking on her behalf,
			helping her get to know you before she joins. The call may be recorded, and a short recap is
			shared back in this chat. It uses your microphone.
		</p>
		<div class="vc-actions">
			<button class="vc-secondary" onclick={reset} type="button">Not now</button>
			<button class="vc-primary" onclick={connect} type="button">I understand — call</button>
		</div>
	</div>
{/if}

{#if phase === 'connecting' || phase === 'live'}
	<div class="vc-live">
		<span class="vc-dot" class:pulse={phase === 'live'}></span>
		<span class="vc-status">
			{phase === 'connecting' ? `Connecting to ${ownerName}'s bestie…` : `On call · ${fmt(elapsed)}`}
		</span>
		<div class="vc-controls">
			<button class="vc-icon" class:active={muted} onclick={toggleMute} type="button" title={muted ? 'Unmute' : 'Mute'} disabled={phase !== 'live'}>
				{muted ? 'Unmute' : 'Mute'}
			</button>
			<button class="vc-hang" onclick={hangUp} type="button">End call</button>
		</div>
	</div>
{/if}

{#if phase === 'ended'}
	<div class="vc-ended">
		<span>Call ended. {ownerName}'s bestie is writing a recap in the chat…</span>
		<button class="vc-secondary" onclick={reset} type="button">Done</button>
	</div>
{/if}

{#if phase === 'error'}
	<div class="vc-ended vc-err">
		<span>{errorMsg}</span>
		<button class="vc-secondary" onclick={reset} type="button">Close</button>
	</div>
{/if}

<style>
	.vc-launch {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		width: 100%;
		justify-content: center;
		padding: 0.6rem 0.9rem;
		margin-bottom: 0.55rem;
		border: none;
		border-radius: 999px;
		background: linear-gradient(135deg, #a855f7, #ec4899);
		color: #fff;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
	}
	.vc-launch:hover { filter: brightness(1.05); }

	.vc-sheet {
		padding: 0.85rem 1rem;
		margin-bottom: 0.55rem;
		border-radius: 14px;
		background: rgba(168, 85, 247, 0.08);
		border: 1px solid rgba(168, 85, 247, 0.25);
	}
	.vc-title { margin: 0 0 0.3rem; font-weight: 700; font-size: 0.92rem; }
	.vc-body { margin: 0 0 0.7rem; font-size: 0.82rem; line-height: 1.45; opacity: 0.85; }
	.vc-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }

	.vc-primary {
		padding: 0.5rem 0.9rem; border: none; border-radius: 999px;
		background: linear-gradient(135deg, #a855f7, #ec4899); color: #fff;
		font-weight: 600; font-size: 0.85rem; cursor: pointer;
	}
	.vc-secondary {
		padding: 0.5rem 0.9rem; border: 1px solid rgba(150,150,170,0.4);
		border-radius: 999px; background: transparent; color: inherit;
		font-size: 0.85rem; cursor: pointer;
	}

	.vc-live, .vc-ended {
		display: flex; align-items: center; gap: 0.6rem;
		padding: 0.6rem 0.85rem; margin-bottom: 0.55rem;
		border-radius: 12px; background: rgba(34,197,94,0.1);
		border: 1px solid rgba(34,197,94,0.3); font-size: 0.85rem;
	}
	.vc-ended { background: rgba(120,120,140,0.1); border-color: rgba(120,120,140,0.3); }
	.vc-err { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.35); }
	.vc-status { flex: 1; font-weight: 600; }
	.vc-controls { display: flex; gap: 0.4rem; }

	.vc-dot { width: 9px; height: 9px; border-radius: 50%; background: #22c55e; }
	.vc-dot.pulse { animation: vc-pulse 1.4s ease-in-out infinite; }
	@keyframes vc-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

	.vc-icon {
		padding: 0.4rem 0.7rem; border: 1px solid rgba(150,150,170,0.4);
		border-radius: 999px; background: transparent; color: inherit;
		font-size: 0.8rem; cursor: pointer;
	}
	.vc-icon.active { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.4); }
	.vc-hang {
		padding: 0.4rem 0.8rem; border: none; border-radius: 999px;
		background: #ef4444; color: #fff; font-size: 0.8rem; font-weight: 600; cursor: pointer;
	}
</style>
