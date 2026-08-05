<script lang="ts">
	/**
	 * The two app-store badges, drawn in the stores' OWN badge format: a black
	 * rounded plaque, the platform mark on the left, a small eyebrow line above a
	 * large store wordmark, set in the system UI font. Every download surface
	 * renders THIS — the /beta landing, /beta/{token}/app, the web Coming Soon
	 * screen and the marketing page (hero + footer) — so the buttons look the same
	 * wherever someone meets them, and there is one place to change a link.
	 *
	 * Black plaque, not brand pink. People recognise a store badge by its shape and
	 * colour before they read a word of it; a recoloured badge reads as somebody's
	 * homemade button, which is exactly the trust we can't afford to spend on a
	 * download screen. The hairline border is white at low alpha so it draws the
	 * edge against the dark marketing footer and vanishes on the cream /beta card.
	 *
	 * Both badges are deliberately identical in weight. Earlier versions painted
	 * the likely device as the filled button and the other as an outline, which read
	 * as "this one is the real button" — wrong, because the device is only ever a
	 * guess. The mark distinguishes them; `order` just decides which comes first.
	 *
	 * The iOS badge says TestFlight, NOT "Download on the App Store". The link opens
	 * a TestFlight public-beta join page and needs Apple's TestFlight app installed;
	 * wearing the App Store badge would promise a normal store install we can't
	 * deliver, and that badge is Apple's to grant for released apps. The plaque
	 * itself already matches Apple's, so the day there's a real listing it's a
	 * two-word change in COPY and nothing else.
	 */
	import { storeChoices, type Platform } from '$lib/store-links';

	let {
		order = null,
		locked = false,
		lockedLabel = '',
		onpick
	}: {
		/** Device hint — orders the badges only, never filters one out. */
		order?: Platform | null;
		/** Renders both badges inert (see the /beta landing's email gate). */
		locked?: boolean;
		/** Tooltip while locked, e.g. why the badges aren't live yet. */
		lockedLabel?: string;
		/**
		 * Called on a live tap, before the browser follows the link. Give the page
		 * a chance to record the lead — keep it cheap and non-blocking, because the
		 * navigation is not awaited.
		 */
		onpick?: (platform: Platform) => void;
	} = $props();

	const badges = $derived(storeChoices(order));

	/**
	 * Store-native two-line label. `word` is the STORE, never our app name — that
	 * is what makes the plaque read as a badge instead of a button. `caps` tracks
	 * the eyebrow in uppercase the way Google's badge does; Apple's is sentence
	 * case, so the two are not styled from one rule.
	 */
	const COPY: Record<Platform, { eyebrow: string; word: string; caps: boolean }> = {
		android: { eyebrow: 'Get it on', word: 'Google Play', caps: true },
		ios: { eyebrow: 'Join the beta on', word: 'TestFlight', caps: false }
	};

	function handle(event: MouseEvent, platform: Platform) {
		if (locked) {
			event.preventDefault();
			return;
		}
		onpick?.(platform);
	}
</script>

<div class="badges">
	{#each badges as b (b.platform)}
		<a
			class="badge"
			class:locked
			href={b.url}
			target="_blank"
			rel="noreferrer"
			aria-disabled={locked}
			title={locked ? lockedLabel : b.label}
			onclick={(e) => handle(e, b.platform)}
		>
			<span class="glyph" aria-hidden="true">
				{#if b.platform === 'ios'}
					<svg viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
						/>
					</svg>
				{:else}
					<!-- The Play mark: four triangles meeting at one interior point.
					     Drawn from explicit geometry (spine x=3, tip at 21,12, hinge at
					     13.4,12) rather than traced, so it stays crisp at any size. -->
					<svg viewBox="0 0 24 24">
						<path d="M3 2.2 13.4 12H3z" fill="#34A853" />
						<path d="M3 2.2 21 12h-7.6z" fill="#EA4335" />
						<path d="M3 21.8 13.4 12H3z" fill="#4285F4" />
						<path d="M3 21.8 21 12h-7.6z" fill="#FBBC04" />
					</svg>
				{/if}
			</span>
			<span class="txt">
				<small class:caps={COPY[b.platform].caps}>{COPY[b.platform].eyebrow}</small>
				<strong>{COPY[b.platform].word}</strong>
			</span>
		</a>
	{/each}
</div>

<style>
	.badges {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	/* The store plaque. It sets its own font stack on purpose: this is a piece of
	   Apple's and Google's UI quoted inside ours, so it must not inherit our brand
	   face — a badge in Gabarito is a badge that looks counterfeit. */
	.badge {
		display: flex;
		align-items: center;
		gap: 11px;
		padding: 9px 16px;
		min-height: 52px;
		box-sizing: border-box;
		border: 1px solid rgba(255, 255, 255, 0.32);
		border-radius: 11px;
		background: #000;
		color: #fff;
		text-decoration: none;
		/* Both lines are flush left against the mark, always. Without this, a host
		   that centres its column (the web Coming Soon screen) inherits down and
		   centres "GET IT ON" over "Google Play" — a badge no store ever shipped. */
		text-align: left;
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
		box-shadow: 0 6px 16px -10px rgba(0, 0, 0, 0.6);
		transition:
			transform 160ms ease,
			box-shadow 160ms ease;
	}

	.badge:hover {
		transform: translateY(-1px);
		box-shadow: 0 10px 22px -12px rgba(0, 0, 0, 0.65);
	}

	.badge:active {
		transform: translateY(0);
	}

	/* Pre-gate state. Still legible — the point is to show what is coming, not to
	   hide it — and the caller explains what unlocks it. Dimmed only to 0.7 and
	   desaturated rather than faded hard: at 0.45 the black plaque washed out to a
	   grey slab on the cream /beta card and stopped reading as a store badge at
	   all. Greyscale is what carries "not yet" — it drains the Play mark's four
	   colours, which is the first thing anyone notices going live. */
	.badge.locked {
		opacity: 0.7;
		filter: grayscale(1);
		cursor: not-allowed;
		box-shadow: none;
	}

	.badge.locked:hover {
		transform: none;
		box-shadow: none;
	}

	.glyph {
		flex: none;
		display: grid;
		place-items: center;
		width: 27px;
		height: 27px;
	}

	.glyph svg {
		width: 100%;
		height: 100%;
		display: block;
	}

	.txt {
		display: block;
		min-width: 0;
	}

	/* Eyebrow-to-wordmark proportions follow the real badges: about half the size,
	   regular weight, sitting tight above the wordmark. */
	.txt small {
		display: block;
		font-size: 10px;
		line-height: 1;
		font-weight: 400;
		color: #fff;
		margin-bottom: 2px;
	}

	.txt small.caps {
		font-size: 9.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.txt strong {
		display: block;
		font-size: 19px;
		line-height: 1.05;
		font-weight: 500;
		letter-spacing: -0.005em;
		white-space: nowrap;
	}
</style>
