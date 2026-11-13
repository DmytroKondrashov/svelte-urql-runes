import { Client, type ClientOptions } from '@urql/core';
import { BROWSER } from 'esm-env';

/** Anything with SvelteKit's `fetch`, such as a `load` event. */
export interface FetchEvent {
	fetch: typeof fetch;
}

let browserClient: Client | undefined;
let currentFetch: typeof fetch | undefined;

/**
 * Returns an urql client wired to SvelteKit's `fetch`. Call it in a universal
 * `+layout.ts` load and return the client as page data:
 *
 * ```ts
 * export const load = (event) => ({
 *   client: createKitClient(event, { url: '/graphql', exchanges: [cacheExchange, fetchExchange] })
 * });
 * ```
 *
 * - **On the server** it creates a new client for each call, so cached data is never
 *   shared between users. Load functions on the same request should reuse the
 *   layout's client through `await parent()` instead of calling this again.
 * - **In the browser** it returns one long-lived client. Its requests go through the
 *   latest `event.fetch`, so responses fetched during SSR are replayed from the page
 *   during hydration instead of being requested again.
 *
 * Any `fetch` in `options` is ignored.
 */
export function createKitClient(event: FetchEvent, options: ClientOptions): Client {
	if (!BROWSER) {
		return new Client({ ...options, fetch: event.fetch });
	}
	currentFetch = event.fetch;
	browserClient ??= new Client({
		...options,
		fetch: (input, init) => (currentFetch ?? fetch)(input, init)
	});
	return browserClient;
}

/**
 * Pass to `resolve` in `hooks.server.ts` so SvelteKit keeps the `content-type` header
 * of GraphQL responses fetched during SSR. urql needs it to read the response, both on
 * the server and when the response is replayed during hydration:
 *
 * ```ts
 * export const handle = ({ event, resolve }) =>
 *   resolve(event, { filterSerializedResponseHeaders: graphqlResponseHeaders });
 * ```
 */
export function graphqlResponseHeaders(name: string): boolean {
	return name.toLowerCase() === 'content-type';
}

/**
 * Drops the browser client so the next `createKitClient` call builds a fresh one
 * with an empty cache. Call it on logout, then `invalidateAll()`.
 */
export function resetKitClient(): void {
	browserClient = undefined;
}
