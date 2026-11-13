import { flushSync } from 'svelte';
import { describe, expect, it } from 'vitest';
import { createQuery } from '../src/lib/index.js';
import { createTestClient, TodoQuery } from './helpers/client.js';
import { withRoot } from './helpers/root.svelte.js';

const todo = (id: string) => ({ todo: { __typename: 'Todo', id, title: `Todo ${id}` } });

describe('createQuery', () => {
	it('executes on mount and exposes the result', () => {
		const t = createTestClient();
		const { value: q } = withRoot(() => createQuery({ query: TodoQuery, variables: { id: '1' } }, t.client));

		expect(q.fetching).toBe(true);
		expect(q.data).toBeUndefined();
		expect(t.last().variables).toEqual({ id: '1' });

		t.respond(t.last(), todo('1'));
		expect(q.fetching).toBe(false);
		expect(q.data).toEqual(todo('1'));
		expect(q.error).toBeUndefined();
		expect(q.operation?.key).toBe(t.last().key);
	});

	it('exposes errors', () => {
		const t = createTestClient();
		const { value: q } = withRoot(() => createQuery({ query: TodoQuery, variables: { id: '1' } }, t.client));

		t.fail(t.last(), 'Network down');
		expect(q.fetching).toBe(false);
		expect(q.error?.message).toContain('Network down');
	});

	it('reads cached results synchronously without hitting the network', () => {
		const t = createTestClient();
		withRoot(() => createQuery({ query: TodoQuery, variables: { id: '1' } }, t.client));
		t.respond(t.last(), todo('1'));
		expect(t.count()).toBe(1);

		const { value: second } = withRoot(() =>
			createQuery({ query: TodoQuery, variables: { id: '1' } }, t.client)
		);
		expect(second.fetching).toBe(false);
		expect(second.data).toEqual(todo('1'));
		expect(t.count()).toBe(1);
	});

	it('shares an in-flight request without disturbing the first query', () => {
		const t = createTestClient();
		const { value: first } = withRoot(() => createQuery({ query: TodoQuery, variables: { id: '1' } }, t.client));
		const { value: second } = withRoot(() =>
			createQuery({ query: TodoQuery, variables: { id: '1' } }, t.client)
		);

		expect(first.fetching).toBe(true);
		expect(first.data).toBeUndefined();
		expect(second.fetching).toBe(true);

		t.respond(t.last(), todo('1'));
		expect(first.data).toEqual(todo('1'));
		expect(second.data).toEqual(todo('1'));
		expect(new Set(t.operations.map((o) => o.key)).size).toBe(1);
	});

	it('re-executes when reactive variables change and drops the old data', () => {
		const t = createTestClient();
		let id = $state('1');
		const { value: q } = withRoot(() => createQuery(() => ({ query: TodoQuery, variables: { id } }), t.client));
		const first = t.last();
		t.respond(first, todo('1'));

		id = '2';
		flushSync();

		expect(t.count()).toBe(2);
		expect(t.last().variables).toEqual({ id: '2' });
		expect(t.teardowns).toContain(first.key);
		expect(q.fetching).toBe(true);
		expect(q.data).toBeUndefined();

		t.respond(t.last(), todo('2'));
		expect(q.data).toEqual(todo('2'));
	});

	it('ignores getter re-runs that produce the same request', () => {
		const t = createTestClient();
		let id = $state('1');
		let unrelated = $state(0);
		withRoot(() =>
			createQuery(() => {
				unrelated;
				return { query: TodoQuery, variables: { id } };
			}, t.client)
		);

		unrelated++;
		flushSync();
		expect(t.count()).toBe(1);
		expect(t.teardowns).toEqual([]);
	});

	it('does not execute while paused and keeps previous data', () => {
		const t = createTestClient();
		let pause = $state(true);
		const { value: q } = withRoot(() =>
			createQuery(() => ({ query: TodoQuery, variables: { id: '1' }, pause }), t.client)
		);
		expect(t.count()).toBe(0);
		expect(q.fetching).toBe(false);

		pause = false;
		flushSync();
		expect(t.count()).toBe(1);
		t.respond(t.last(), todo('1'));

		pause = true;
		flushSync();
		expect(t.teardowns).toContain(t.last().key);
		expect(q.data).toEqual(todo('1'));
		expect(q.fetching).toBe(false);
	});

	it('passes the request policy and context to the operation', () => {
		const t = createTestClient();
		withRoot(() =>
			createQuery(
				{
					query: TodoQuery,
					variables: { id: '1' },
					requestPolicy: 'network-only',
					context: { fetchOptions: { headers: { 'x-test': '1' } } }
				},
				t.client
			)
		);
		expect(t.last().context.requestPolicy).toBe('network-only');
		expect(t.last().context.fetchOptions).toEqual({ headers: { 'x-test': '1' } });
	});

	it('refetch bypasses the cache and resolves with the next result', async () => {
		const t = createTestClient();
		const { value: q } = withRoot(() => createQuery({ query: TodoQuery, variables: { id: '1' } }, t.client));
		t.respond(t.last(), todo('1'));

		const pending = q.refetch();
		flushSync();
		expect(t.count()).toBe(2);
		expect(t.last().context.requestPolicy).toBe('network-only');

		const fresh = { todo: { __typename: 'Todo', id: '1', title: 'Renamed' } };
		t.respond(t.last(), fresh);
		await expect(pending).resolves.toMatchObject({ data: fresh });
		expect(q.data).toEqual(fresh);
	});

	it('refetch runs once even while paused', async () => {
		const t = createTestClient();
		const { value: q } = withRoot(() =>
			createQuery({ query: TodoQuery, variables: { id: '1' }, pause: true }, t.client)
		);
		expect(t.count()).toBe(0);

		const pending = q.refetch();
		flushSync();
		expect(t.count()).toBe(1);
		t.respond(t.last(), todo('1'));
		await expect(pending).resolves.toMatchObject({ data: todo('1') });
	});

	it('reports stale results and resolves refetch only on a fresh one', async () => {
		const t = createTestClient();
		const { value: q } = withRoot(() => createQuery({ query: TodoQuery, variables: { id: '1' } }, t.client));
		const pending = q.refetch();
		flushSync();

		t.respond(t.last(), todo('1'), { stale: true });
		expect(q.stale).toBe(true);
		let settled = false;
		pending.then(() => (settled = true));
		await Promise.resolve();
		expect(settled).toBe(false);

		t.respond(t.last(), todo('1'));
		await pending;
		expect(q.stale).toBe(false);
	});

	it('tears the operation down when destroyed', () => {
		const t = createTestClient();
		const { destroy } = withRoot(() => createQuery({ query: TodoQuery, variables: { id: '1' } }, t.client));
		const key = t.last().key;
		destroy();
		expect(t.teardowns).toContain(key);
	});
});
