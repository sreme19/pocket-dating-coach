<script lang="ts">
	import { Download } from 'lucide-svelte';
	import type { MaleProfile } from '$lib/types';

	interface Props {
		profile: MaleProfile;
	}

	let { profile }: Props = $props();

	let cardElement: HTMLDivElement;

	async function downloadCard() {
		if (!cardElement) return;

		try {
			const canvas = await html2canvas(cardElement, {
				backgroundColor: '#0f172a',
				scale: 2,
				logging: false
			});

			const link = document.createElement('a');
			link.href = canvas.toDataURL('image/png');
			link.download = `pocket-dating-coach-profile.png`;
			link.click();
		} catch (err) {
			console.error('Failed to download card:', err);
			alert('Failed to download card. Try taking a screenshot instead.');
		}
	}

	// Simple html2canvas polyfill - use Canvas API directly
	async function html2canvas(el: HTMLElement, opts: any) {
		const canvas = document.createElement('canvas');
		const width = el.offsetWidth;
		const height = el.offsetHeight;

		canvas.width = width * 2;
		canvas.height = height * 2;

		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Could not get canvas context');

		ctx.scale(2, 2);
		ctx.fillStyle = opts.backgroundColor || '#fff';
		ctx.fillRect(0, 0, width, height);

		// Use SVG to render the card
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('width', String(width));
		svg.setAttribute('height', String(height));

		const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
		foreignObject.setAttribute('width', String(width));
		foreignObject.setAttribute('height', String(height));

		const clone = el.cloneNode(true) as HTMLElement;
		foreignObject.appendChild(clone);
		svg.appendChild(foreignObject);

		const data = new XMLSerializer().serializeToString(svg);
		const img = new Image();

		return new Promise<HTMLCanvasElement>((resolve, reject) => {
			img.onload = () => {
				ctx.drawImage(img, 0, 0);
				resolve(canvas);
			};
			img.onerror = reject;
			img.src = 'data:image/svg+xml;base64,' + btoa(data);
		});
	}
</script>

<div class="space-y-4">
	<!-- Card Preview -->
	<div
		bind:this={cardElement}
		class="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 border border-slate-700 min-h-96"
	>
		<!-- Header -->
		<div class="mb-6 pb-6 border-b border-slate-700">
			<p class="text-xs uppercase tracking-wider text-slate-500 mb-2">Pocket Dating Coach</p>
			<h2 class="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-amber-400 leading-tight">
				{profile.headline}
			</h2>
		</div>

		<!-- Body -->
		<div class="space-y-6">
			<!-- Elevator Pitch -->
			<div>
				<p class="text-sm text-slate-400 mb-2">About</p>
				<p class="text-lg leading-relaxed text-slate-200">{profile.elevatorPitch}</p>
			</div>

			<!-- Compatibility Signals -->
			<div>
				<p class="text-sm text-slate-400 mb-3">What Works</p>
				<div class="space-y-2">
					{#each profile.compatibilitySignals.slice(0, 3) as signal}
						<div class="flex items-start gap-3">
							<span class="text-rose-400 text-lg">→</span>
							<span class="text-slate-300">{signal}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Footer -->
		<div class="mt-8 pt-6 border-t border-slate-700 text-center">
			<p class="text-xs text-slate-500">Built with Pocket Dating Coach</p>
		</div>
	</div>

	<!-- Download Button -->
	<button
		id="download-btn"
		onclick={downloadCard}
		class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 rounded-lg font-medium transition-colors"
	>
		<Download class="w-4 h-4" />
		Download Card
	</button>

	<p class="text-xs text-slate-500 text-center">
		Tip: If download doesn't work, take a screenshot of the card above
	</p>
</div>

<style>
	:global(.profile-card-preview) {
		position: relative;
	}
</style>
