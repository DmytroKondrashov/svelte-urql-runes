import { expectTypeOf, it } from 'vitest';
import { createQuery } from '../src/lib/index.js';
import { TodoQuery, TodosQuery } from '../src/routes/graphql.js';

// Type-level checks (svelte-check / tsc). The callbacks never run.
it('types results and enforces required variables', () => {
	() => {
		// @ts-expect-error `variables` is required for a query with required variables
		createQuery({ query: TodoQuery });

		const todo = createQuery({ query: TodoQuery, variables: { id: '1' } });
		expectTypeOf(todo.data).toEqualTypeOf<
			{ todo: { id: string; title: string; done: boolean } | null } | undefined
		>();

		// No variables needed.
		createQuery({ query: TodosQuery });
	};
});
