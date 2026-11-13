<script lang="ts">
	import type { Client } from '@urql/core';
	import { setContextClient } from '../../src/lib/index.js';
	import Probe from './Probe.svelte';

	let { client, id }: { client: Client; id: string } = $props();
	setContextClient(() => client);
</script>

<Probe {id} />
