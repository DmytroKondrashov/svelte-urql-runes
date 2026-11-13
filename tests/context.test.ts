import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Probe from './fixtures/Probe.svelte';
import Provider from './fixtures/Provider.svelte';
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

	it('throws a helpful error when no client is provided', async () => {
		await expect(async () => render(Probe, { id: '1' })).rejects.toThrow(/setContextClient/);
	});
});
