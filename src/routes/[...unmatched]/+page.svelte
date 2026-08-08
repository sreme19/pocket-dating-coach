<script lang="ts">
	// Never rendered: the load in +page.server.ts always throws a 404, and on a
	// blog host `reroute` sends the match to the real blog route before this
	// route is reached. SvelteKit requires a component to accompany a
	// +page.server.ts, so this is that component and nothing more.
</script>
