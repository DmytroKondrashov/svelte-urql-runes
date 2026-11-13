<script lang="ts">
	import { createQuery } from '../../src/lib/index.js';
	import { TodoQuery } from '../helpers/client.js';

	let { id }: { id: string } = $props();
	const todo = createQuery(() => ({ query: TodoQuery, variables: { id } }));
</script>

{#if todo.fetching}
	<p>Loading…</p>
{:else if todo.data}
	<p>{todo.data.todo.title}</p>
{/if}
