<script lang="ts">
	import { createMutation, createQuery, createSubscription } from '../../src/lib/index.js';
	import { AddTodo, OnTick, TodoQuery } from '../helpers/client.js';

	const todo = createQuery({ query: TodoQuery, variables: { id: '1' } });
	const ticks = createSubscription({ query: OnTick, variables: { channel: 'a' } });
	const addTodo = createMutation(AddTodo);
</script>

<p>todo: {todo.fetching ? 'loading' : (todo.data?.todo.title ?? 'none')}</p>
<p>tick: {ticks.data?.tick ?? 'none'}</p>
<button onclick={() => addTodo.execute({ title: 'Milk' })}>Add</button>
