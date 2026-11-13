<script lang="ts">
	import type { Client } from '@urql/core';
	import { setContextClient } from '../../src/lib/index.js';
	import SwapProbe from './SwapProbe.svelte';

	let { client }: { client: Client } = $props();
	setContextClient(() => client);
</script>

<SwapProbe />
