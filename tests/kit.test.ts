import { cacheExchange, fetchExchange, gql } from '@urql/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createKitClient, resetKitClient } from '../src/lib/kit.js';

const Hello = gql<{ hello: string }>`
	query Hello {
		hello
	}
`;

const options = { url: 'http://test.local/graphql', exchanges: [cacheExchange, fetchExchange] };

function fakeFetch() {
	return vi.fn(async () =>
		Response.json({ data: { hello: 'world' } }, { headers: { 'content-type': 'application/json' } })
	);
}

afterEach(() => resetKitClient());

describe('createKitClient (browser)', () => {
	it('returns one long-lived client', () => {
		const first = createKitClient({ fetch: fakeFetch() }, options);
		const second = createKitClient({ fetch: fakeFetch() }, options);
		expect(second).toBe(first);
	});

	it('sends requests through the latest event.fetch', async () => {
		const early = fakeFetch();
		const latest = fakeFetch();
		const client = createKitClient({ fetch: early }, options);
		createKitClient({ fetch: latest }, options);

		const result = await client.query(Hello, {}).toPromise();
		expect(result.data).toEqual({ hello: 'world' });
		expect(latest).toHaveBeenCalledTimes(1);
		expect(early).not.toHaveBeenCalled();
	});

	it('builds a fresh client after resetKitClient', () => {
		const first = createKitClient({ fetch: fakeFetch() }, options);
		resetKitClient();
		expect(createKitClient({ fetch: fakeFetch() }, options)).not.toBe(first);
	});
});
