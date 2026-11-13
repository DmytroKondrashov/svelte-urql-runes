<script lang="ts">
	import { createMutation, createQuery } from '../lib/index.js';
	import { AddTodo, TodoQuery, TodosQuery } from './graphql.js';

	const todos = createQuery({ query: TodosQuery });
	const addTodo = createMutation(AddTodo);

	let selected = $state<string | undefined>();
	// Reactive: re-runs whenever `selected` changes, paused until something is picked.
	const detail = createQuery(() => ({
		query: TodoQuery,
		variables: { id: selected ?? '' },
		pause: !selected
	}));

	let title = $state('');

	async function add(event: SubmitEvent) {
		event.preventDefault();
		const result = await addTodo.execute({ title });
		if (!result.error) {
			title = '';
			await todos.refetch();
		}
	}
</script>

<h1>svelte-urql-runes demo</h1>

{#if todos.fetching}
	<p>Loading…</p>
{:else if todos.error}
	<p role="alert">{todos.error.message}</p>
{:else}
	<ul data-testid="todos">
		{#each todos.data?.todos ?? [] as todo (todo.id)}
			<li>
				<button onclick={() => (selected = todo.id)}>{todo.title}</button>
				{todo.done ? '✓' : ''}
			</li>
		{/each}
	</ul>
{/if}

<form onsubmit={add}>
	<input name="title" bind:value={title} placeholder="New todo" required />
	<button disabled={addTodo.fetching}>{addTodo.fetching ? 'Adding…' : 'Add'}</button>
</form>

<section data-testid="detail">
	{#if !selected}
		<p>Pick a todo to load its details.</p>
	{:else if detail.fetching}
		<p>Loading todo {selected}…</p>
	{:else if detail.data?.todo}
		<p>#{detail.data.todo.id}: {detail.data.todo.title} ({detail.data.todo.done ? 'done' : 'open'})</p>
	{/if}
</section>
