<script lang="ts">
	import { onMount } from 'svelte';
	import { ImageOptimizer } from '../services/performance';

	interface Props {
		src: string;
		alt: string;
		width?: number;
		height?: number;
		class?: string;
		placeholder?: string;
		quality?: number;
		onLoad?: () => void;
		onError?: (error: Error) => void;
	}

	let {
		src,
		alt,
		width,
		height,
		class: className = '',
		placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f0f0f0" width="400" height="300"/%3E%3C/svg%3E',
		quality = 0.8,
		onLoad,
		onError
	}: Props = $props();

	let isLoaded = $state(false);
	let currentSrc = $state(placeholder);
	let error = $state<Error | null>(null);

	onMount(() => {
		// Use Intersection Observer for lazy loading
		if ('IntersectionObserver' in window) {
			const observer = new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						if (entry.isIntersecting) {
							loadImage();
							observer.unobserve(entry.target);
						}
					});
				},
				{
					rootMargin: '50px'
				}
			);

			const img = document.querySelector(`img[data-src="${src}"]`);
			if (img) {
				observer.observe(img);
			}

			return () => observer.disconnect();
		} else {
			// Fallback for browsers without IntersectionObserver
			loadImage();
		}
	});

	function loadImage(): void {
		const img = new Image();

		img.onload = () => {
			currentSrc = src;
			isLoaded = true;
			onLoad?.();
		};

		img.onerror = () => {
			const err = new Error(`Failed to load image: ${src}`);
			error = err;
			onError?.(err);
		};

		img.src = src;
	}

	function handleError(): void {
		const err = new Error(`Failed to load image: ${src}`);
		error = err;
		onError?.(err);
	}
</script>

<img
	{src: currentSrc}
	{alt}
	{width}
	{height}
	data-src={src}
	class={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-50'} ${className}`}
	on:error={handleError}
	loading="lazy"
/>

<style>
	img {
		display: block;
		max-width: 100%;
		height: auto;
	}
</style>
