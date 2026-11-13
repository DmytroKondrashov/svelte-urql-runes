<script lang="ts">
	import { setContextClient } from '../lib/index.js';

	let { data, children } = $props();
	setContextClient(() => data.client);
</script>

<main>
	{@render children()}
</main>

<style>
	main {
		max-width: 40rem;
		margin: 2rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}
</style>
