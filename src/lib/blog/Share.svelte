<script lang="ts">
	/**
	 * Share row for a post, plus the invitation to reply.
	 *
	 * Every destination is a plain link to a URL the network already understands
	 * — no SDKs, no iframes, no third-party script. That keeps the promise the
	 * rest of this blog makes (a reading surface that loads nothing it does not
	 * need) and means these buttons cannot report a reader's visit back to
	 * LinkedIn or Meta merely by being on the page. Nothing is sent anywhere
	 * until someone actually clicks.
	 *
	 * The copy button is the only interactive piece. `navigator.clipboard` needs
	 * a secure context, which the live site has and a plain-http preview may
	 * not, so a failure falls back to selecting the URL rather than pretending
	 * it worked.
	 */
	import { BLOG_LINKEDIN, absolute } from '$lib/blog/site';

	let { path, title }: { path: string; title: string } = $props();

	let url = $derived(absolute(path));
	let copied = $state(false);
	let failed = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const enc = (s: string) => encodeURIComponent(s);

	let linkedIn = $derived(`https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`);
	// WhatsApp takes one text field, so the title has to carry the context.
	let whatsapp = $derived(`https://wa.me/?text=${enc(`${title} — ${url}`)}`);
	let x = $derived(`https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}`);

	async function copy() {
		clearTimeout(timer);
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			failed = false;
		} catch {
			// No clipboard permission or an insecure origin — show the URL so it
			// can still be copied by hand instead of silently doing nothing.
			copied = false;
			failed = true;
		}
		timer = setTimeout(() => {
			copied = false;
			failed = false;
		}, 2600);
	}
</script>

<div class="share">
	<span class="share__label">Share</span>

	<div class="share__row">
		<button class="share__btn" type="button" onclick={copy} aria-live="polite">
			{copied ? 'Link copied' : 'Copy link'}
		</button>

		<a class="share__btn" href={linkedIn} target="_blank" rel="noopener noreferrer">LinkedIn</a>
		<a class="share__btn" href={whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>
		<a class="share__btn" href={x} target="_blank" rel="noopener noreferrer">X</a>
	</div>

	{#if failed}
		<p class="share__fallback">
			Couldn't reach the clipboard — here's the link:
			<input class="share__url" type="text" readonly value={url} onfocus={(e) => e.currentTarget.select()} />
		</p>
	{/if}

	<p class="share__reply">
		No comments here, by design. If you have a correction or a better answer,
		<a href={BLOG_LINKEDIN} target="_blank" rel="noopener noreferrer">reply on LinkedIn</a> —
		I read everything.
	</p>
</div>
