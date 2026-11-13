import { describe, expect, it } from 'vitest';
import { createMutation } from '../src/lib/index.js';
import { AddTodo, createTestClient } from './helpers/client.js';
import { withRoot } from './helpers/root.svelte.js';

describe('createMutation', () => {
	it('does nothing until executed', () => {
		const t = createTestClient();
		const { value: m } = withRoot(() => createMutation(AddTodo, t.client));
		expect(t.operations).toHaveLength(0);
		expect(m.fetching).toBe(false);
		expect(m.data).toBeUndefined();
	});

	it('executes and resolves with the result', async () => {
		const t = createTestClient();
		const { value: m } = withRoot(() => createMutation(AddTodo, t.client));

		const pending = m.execute({ title: 'Milk' }, { fetchOptions: { headers: { 'x-test': '1' } } });
		expect(m.fetching).toBe(true);
		const op = t.last('mutation');
		expect(op.variables).toEqual({ title: 'Milk' });
		expect(op.context.fetchOptions).toEqual({ headers: { 'x-test': '1' } });

		t.respond(op, { addTodo: { __typename: 'Todo', id: '7' } });
		const result = await pending;
		expect(result.data?.addTodo.id).toBe('7');
		expect(m.fetching).toBe(false);
		expect(m.data?.addTodo.id).toBe('7');
	});

	it('reports errors on the result instead of rejecting', async () => {
		const t = createTestClient();
		const { value: m } = withRoot(() => createMutation(AddTodo, t.client));
		const pending = m.execute({ title: 'Milk' });
		t.fail(t.last('mutation'), 'Forbidden');
		const result = await pending;
		expect(result.error?.message).toContain('Forbidden');
		expect(m.error?.message).toContain('Forbidden');
	});

	it('keeps the state of the most recent call when calls overlap', async () => {
		const t = createTestClient();
		const { value: m } = withRoot(() => createMutation(AddTodo, t.client));

		const first = m.execute({ title: 'first' });
		const firstOp = t.last('mutation');
		const second = m.execute({ title: 'second' });
		const secondOp = t.last('mutation');

		t.respond(secondOp, { addTodo: { __typename: 'Todo', id: '2' } });
		await second;
		t.respond(firstOp, { addTodo: { __typename: 'Todo', id: '1' } });
		await first;

		expect(m.data?.addTodo.id).toBe('2');
		expect(m.fetching).toBe(false);
	});
});
