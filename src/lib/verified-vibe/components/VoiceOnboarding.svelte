<!--
  VoiceOnboarding.svelte — the female owner's voice-call controls.

  Two independent things:
    1. Calls opt-in toggle: whether her AI bestie will accept "Get a call now"
       requests from matches at all. Works even with the default voice.
    2. Voice clone: optionally record a short consented sample so her bestie
       speaks in her own voice instead of the default premium voice.

  Self-gating: fetches /api/voice/profile and renders nothing unless the signed-in
  user is a woman. Uses MediaRecorder for the sample.
-->
<script lang="ts">
	import { onMount } from 'svelte';

	let loaded = $state(false);
	let eligible = $state(false);
	let voiceStatus = $state<'none' | 'sample_uploaded' | 'cloning' | 'cloned' | 'failed'>('none');
	let callsOptIn = $state(false);
	let busy = $state(false);
	let msg = $state('');

	// recording state
	let recording = $state(false);
	let recorded = $state<Blob | null>(null);
	let recordedUrl = $state('');
	let consent = $state(false);
	let recorder: MediaRecorder | null = null;
	let chunks: BlobPart[] = [];

	async function token(): Promise<string | null> {
		const { getSupabaseClient } = await import('$lib/client/supabase');
		const { data } = await getSupabaseClient().auth.getSession();
		return data.session?.access_token ?? null;
	}

	async function load() {
		const t = await token();
		if (!t) {
			loaded = true;
			return;
		}
		const res = await fetch('/api/voice/profile', { headers: { Authorization: `Bearer ${t}` } });
		const data = await res.json();
		eligible = data.gender === 'woman';
		voiceStatus = data.voiceStatus ?? 'none';
		callsOptIn = !!data.callsOptIn;
		loaded = true;
	}

	onMount(load);

	async function toggleOptIn() {
		busy = true;
		msg = '';
		try {
			const t = await token();
			const res = await fetch('/api/voice/profile', {
				method: 'POST',
				headers: { 'content-type': 'application/json', Authorization: `Bearer ${t}` },
				body: JSON.stringify({ callsOptIn: !callsOptIn })
			});
			if (!res.ok) throw new Error('Could not update');
			callsOptIn = !callsOptIn;
		} catch (e) {
			msg = e instanceof Error ? e.message : 'Error';
		} finally {
			busy = false;
		}
	}

	async function startRecording() {
		msg = '';
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			chunks = [];
			recorder = new MediaRecorder(stream);
			recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
			recorder.onstop = () => {
				recorded = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' });
				recordedUrl = URL.createObjectURL(recorded);
				stream.getTracks().forEach((tr) => tr.stop());
			};
			recorder.start();
			recording = true;
		} catch {
			msg = 'Microphone access is needed to record a sample.';
		}
	}

	function stopRecording() {
		recorder?.stop();
		recording = false;
	}

	async function uploadClone() {
		if (!recorded || !consent) return;
		busy = true;
		msg = '';
		voiceStatus = 'cloning';
		try {
			const t = await token();
			const form = new FormData();
			form.append('sample', recorded, 'sample.webm');
			form.append('consent', 'true');
			const res = await fetch('/api/voice/profile/sample', {
				method: 'POST',
				headers: { Authorization: `Bearer ${t}` },
				body: form
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error || 'Cloning failed');
			voiceStatus = 'cloned';
			recorded = null;
			recordedUrl = '';
			msg = 'Your voice is ready — your bestie will speak in your voice on calls.';
		} catch (e) {
			voiceStatus = 'failed';
			msg = e instanceof Error ? e.message : 'Cloning failed';
		} finally {
			busy = false;
		}
	}
</script>

{#if loaded && eligible}
	<section class="vo">
		<h3 class="vo-h">Bestie voice calls</h3>
		<p class="vo-sub">
			Let your AI bestie take live voice calls from matches who want to get to know you before you
			jump in. You stay in control — you'll get a recap of every call in your chat.
		</p>

		<label class="vo-row">
			<span>
				<strong>Accept bestie voice calls</strong>
				<small>Matches can request a live call with your AI bestie.</small>
			</span>
			<button
				class="vo-switch"
				class:on={callsOptIn}
				onclick={toggleOptIn}
				disabled={busy}
				type="button"
				role="switch"
				aria-checked={callsOptIn}
			>
				<span class="vo-knob"></span>
			</button>
		</label>

		<div class="vo-clone">
			<strong>Your voice (optional)</strong>
			{#if voiceStatus === 'cloned'}
				<p class="vo-ok">✓ Your bestie speaks in your voice. Re-record any time to update it.</p>
			{:else}
				<small>Record ~30 seconds of natural speech so your bestie sounds like you. Otherwise it uses a warm default voice.</small>
			{/if}

			{#if !recording && !recorded}
				<button class="vo-btn" onclick={startRecording} type="button" disabled={busy}>
					{voiceStatus === 'cloned' ? 'Re-record' : 'Record sample'}
				</button>
			{/if}
			{#if recording}
				<button class="vo-btn rec" onclick={stopRecording} type="button">■ Stop recording</button>
			{/if}
			{#if recorded && recordedUrl}
				<audio src={recordedUrl} controls></audio>
				<label class="vo-consent">
					<input type="checkbox" bind:checked={consent} />
					I consent to Verified Vibe cloning my voice for my own AI bestie's calls.
				</label>
				<div class="vo-actions">
					<button class="vo-btn ghost" onclick={() => { recorded = null; recordedUrl = ''; }} type="button">Discard</button>
					<button class="vo-btn" onclick={uploadClone} type="button" disabled={!consent || busy}>
						{busy ? 'Cloning…' : 'Use this voice'}
					</button>
				</div>
			{/if}
		</div>

		{#if msg}<p class="vo-msg">{msg}</p>{/if}
	</section>
{/if}

<style>
	.vo { display: flex; flex-direction: column; gap: 0.75rem; }
	.vo-h { margin: 0; font-size: 1rem; font-weight: 700; }
	.vo-sub { margin: 0; font-size: 0.85rem; opacity: 0.8; line-height: 1.45; }
	.vo-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.6rem 0; }
	.vo-row span { display: flex; flex-direction: column; gap: 0.15rem; }
	.vo-row small, .vo-clone small { font-size: 0.78rem; opacity: 0.7; }
	.vo-switch {
		flex-shrink: 0; width: 46px; height: 26px; border-radius: 999px; border: none;
		background: rgba(150,150,170,0.4); position: relative; cursor: pointer; transition: background 200ms;
	}
	.vo-switch.on { background: #22c55e; }
	.vo-knob {
		position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%;
		background: #fff; transition: transform 200ms;
	}
	.vo-switch.on .vo-knob { transform: translateX(20px); }
	.vo-clone { display: flex; flex-direction: column; gap: 0.55rem; padding-top: 0.5rem; border-top: 1px solid rgba(150,150,170,0.2); }
	.vo-consent { display: flex; gap: 0.5rem; align-items: flex-start; font-size: 0.8rem; opacity: 0.85; }
	.vo-actions { display: flex; gap: 0.5rem; }
	.vo-ok { margin: 0; font-size: 0.82rem; color: #22c55e; }
	.vo-btn {
		align-self: flex-start; padding: 0.5rem 0.9rem; border: none; border-radius: 999px;
		background: linear-gradient(135deg, #a855f7, #ec4899); color: #fff; font-weight: 600;
		font-size: 0.84rem; cursor: pointer;
	}
	.vo-btn.rec { background: #ef4444; }
	.vo-btn.ghost { background: transparent; border: 1px solid rgba(150,150,170,0.4); color: inherit; }
	.vo-msg { margin: 0; font-size: 0.82rem; opacity: 0.85; }
	audio { width: 100%; }
</style>
