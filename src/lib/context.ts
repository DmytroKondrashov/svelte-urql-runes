import type { Client } from '@urql/core';
import { getContext, hasContext, setContext } from 'svelte';

const CLIENT_KEY = Symbol('svelte-urql-runes/client');

/**
 * Makes `client` available to `createQuery`, `createMutation` and `createSubscription`
 * in this component and its descendants. Call it during component initialisation,
 * typically in the root `+layout.svelte`.
 *
 * Pass a getter when the client comes from props, e.g. `setContextClient(() => data.client)`.
 * Each binding reads it once, when it is created.
 */
export function setContextClient(client: Client | (() => Client)): void {
	setContext(CLIENT_KEY, typeof client === 'function' ? client : () => client);
}

/**
 * Reads the client set by the nearest `setContextClient`. Must be called during
 * component initialisation.
 */
export function getContextClient(): Client {
	if (!hasContext(CLIENT_KEY)) {
		throw new Error(
			'svelte-urql-runes: no urql client found in context. Call setContextClient(client) in a parent component, or pass a client explicitly.'
		);
	}
	return getContext<() => Client>(CLIENT_KEY)();
}

/** Uses the given client, falling back to the context client. */
export function resolveClient(client: Client | undefined): Client {
	return client ?? getContextClient();
}
