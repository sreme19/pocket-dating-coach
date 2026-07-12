<script lang="ts">
	import '../test-suite/test-suite.css';
	import Icon from '../test-suite/Icon.svelte';
	import PhotosReview from '../test-suite/PhotosReview.svelte';
</script>

<svelte:head>
	<link
		href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="ts-root">
	<main class="page">
		<div class="page-head">
			<div class="page-title-wrap">
				<h1 class="page-title"><Icon name="spark" size={22} color="var(--emerald)" />AI Photos</h1>
				<p class="page-sub">
					Human review &amp; tagging of AI-generated profile photos at <code>/admin/photos</code>.
					Browse everything already generated, or generate fresh on the bench, and tag each image for
					<strong style="color:var(--text-2)">identity fidelity</strong>, artifacts &amp; quality.
				</p>
			</div>
		</div>

		<PhotosReview />
	</main>
</div>
