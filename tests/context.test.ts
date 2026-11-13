import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Probe from './fixtures/Probe.svelte';
import Provider from './fixtures/Provider.svelte';
import SwapProvider from './fixtures/SwapProvider.svelte';
import { createTestClient } from './helpers/client.js';

describe('context client', () => {
	it('lets components use the client from context, reacting to props', async () => {
		const t = createTestClient();
		const screen = await render(Provider, { client: t.client, id: '1' });

		await expect.element(screen.getByText('Loading…')).toBeInTheDocument();
		t.respond(t.last(), { todo: { __typename: 'Todo', id: '1', title: 'Buy milk' } });
		await expect.element(screen.getByText('Buy milk')).toBeInTheDocument();

		await screen.rerender({ id: '2' });
		await expect.element(screen.getByText('Loading…')).toBeInTheDocument();
		expect(t.last().variables).toEqual({ id: '2' });
	});

	it('moves mounted bindings to a new context client and drops the old results', async () => {
		const before = createTestClient();
		const screen = await render(SwapProvider, { client: before.client });
		before.respond(before.last(), { todo: { __typename: 'Todo', id: '1', title: 'Old user' } });
		before.respond(before.last('subscription'), { tick: 1 });
		await expect.element(screen.getByText('todo: Old user')).toBeInTheDocument();
		await expect.element(screen.getByText('tick: 1')).toBeInTheDocument();

		const after = createTestClient();
		await screen.rerender({ client: after.client });

		await expect.element(screen.getByText('todo: loading')).toBeInTheDocument();
		await expect.element(screen.getByText('tick: none')).toBeInTheDocument();
		expect(after.count()).toBe(1);
		expect(after.count('subscription')).toBe(1);
		expect(before.teardowns).toContain(before.last().key);
		expect(before.teardowns).toContain(before.last('subscription').key);

		await screen.getByRole('button', { name: 'Add' }).click();
		expect(after.count('mutation')).toBe(1);
		expect(before.count('mutation')).toBe(0);
	});

	it('throws a helpful error when no client is provided', async () => {
		await expect(async () => render(Probe, { id: '1' })).rejects.toThrow(/setContextClient/);
	});
});
