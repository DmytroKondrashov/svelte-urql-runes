# svelte-urql-runes

Runes-native [urql](https://commerce.nearform.com/open-source/urql/) bindings for **Svelte 5**: reactive queries, mutations and subscriptions as plain objects you read like `$state`. Includes SvelteKit helpers that render queries during SSR and hydrate without fetching again.

```svelte
<script lang="ts">
	import { createQuery } from 'svelte-urql-runes';

	let { id } = $props();
	const todo = createQuery(() => ({ query: TodoQuery, variables: { id } }));
</script>

{#if todo.fetching}
	Loading…
{:else if todo.error}
	{todo.error.message}
{:else}
	{todo.data?.todo?.title}
{/if}
```

No `$` prefixes and no stores. The query re-runs when `id` changes.

## Why

The official `@urql/svelte` is built on `svelte/store`. That still works in Svelte 5, but it doesn't fit runes. You end up subscribing to stores with `$store`, and passing reactive variables means wiring `derived` stores by hand. This package uses the same `@urql/core` client and exchanges, so caching, `graphcache`, auth exchanges and the rest work unchanged. Only the Svelte layer is different:

- **Getter-based reactivity.** Pass `() => ({ ...options })`. Any `$state`, `$derived` or prop read inside the getter re-runs the query when it changes. It works the same way as TanStack Query for Svelte 5.
- **Fully typed** with [gql.tada](https://gql-tada.0no.co/) or GraphQL Code Generator's `TypedDocumentNode`. Required variables are enforced.
- **SvelteKit SSR that just works.** Prefetch in `load`, render during SSR, and hydrate from the inlined response with no second request.
- **Small.** Three functions plus a context helper. It depends only on `@urql/core`, `wonka` and `esm-env`.

## Install

```sh
npm install svelte-urql-runes @urql/core
```

Requires Svelte 5 and `@urql/core` 6.

## Usage

### Provide a client

```svelte
<!-- +layout.svelte -->
<script lang="ts">
	import { Client, cacheExchange, fetchExchange } from '@urql/core';
	import { setContextClient } from 'svelte-urql-runes';

	setContextClient(new Client({ url: '/graphql', exchanges: [cacheExchange, fetchExchange] }));
</script>
```

Every function also accepts an explicit `client` as its last argument.

In SvelteKit, use `createKitClient` instead (see [SvelteKit](#sveltekit)) so each server request gets its own cache.

### `createQuery(options, client?)`

```ts
const todos = createQuery(() => ({
	query: TodosQuery,
	variables: { first: pageSize, after: cursor },
	requestPolicy: 'cache-and-network', // optional
	context: { fetchOptions: { headers } }, // optional
	pause: !loggedIn // optional
}));
```

Options can be a plain object if nothing in them is reactive: `createQuery({ query: TodosQuery })`.

| Property | |
|---|---|
| `data` | The latest result data, or `undefined` |
| `error` | `CombinedError` covering both network and GraphQL errors |
| `fetching` | `true` while waiting for the first result of the current request |
| `stale` | `true` when `data` is cached and a refresh is in flight |
| `hasNext` | `true` while more `@defer`/`@stream` payloads are expected |
| `extensions`, `operation` | As in urql |
| `refetch(context?)` | Re-executes with `network-only` by default (it runs even while paused). Returns a promise for the next complete result |

Notes:

- When the variables change, `data` resets to the cached result for the new variables, or to `undefined`.
- When `pause` becomes `true`, the operation is torn down and the last `data` is kept.
- Re-running the getter with an identical request does nothing.
- Results are stored with `$state.raw`. They are replaced as a whole on each result, never deeply proxied, so object identity is preserved and large results stay cheap.

### `createMutation(query, client?)`

```svelte
<script lang="ts">
	const addTodo = createMutation(AddTodo);

	async function add() {
		const result = await addTodo.execute({ title });
		if (!result.error) await todos.refetch();
	}
</script>

<button disabled={addTodo.fetching} onclick={add}>Add</button>
```

`execute` resolves with the `OperationResult` and never rejects. Check `result.error`. If calls overlap, the reactive state follows the most recent call.

### `createSubscription(options, handler?, client?)`

```ts
const messages = createSubscription(
	() => ({ query: OnMessage, variables: { room } }),
	(list: Message[] = [], event) => [...list, event.message]
);
// messages.data is Message[]
```

Without a handler, `data` is the latest event. With one, `data` is the value the handler accumulates. That value resets when the variables change and is kept while paused. Subscriptions only run in the browser.

### Where to call them

Like any rune-based code, call these functions **during component initialisation**, or inside `$effect.root` if you manage the lifetime yourself. The operation is torn down when the component is destroyed.

## SvelteKit

Four steps. The [demo app](./src/routes) in this repository is a complete working example.

**1. Create the client in a universal layout load.** On the server, `createKitClient` creates a client per request, so cached data is never shared between users. In the browser it returns one long-lived client. It always sends requests through SvelteKit's `fetch`.

```ts
// src/routes/+layout.ts
import { cacheExchange, fetchExchange } from '@urql/core';
import { createKitClient } from 'svelte-urql-runes/kit';

export const load = (event) => ({
	client: createKitClient(event, { url: '/graphql', exchanges: [cacheExchange, fetchExchange] })
});
```

**2. Put it in context.**

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import { setContextClient } from 'svelte-urql-runes';
	let { data, children } = $props();
	setContextClient(() => data.client);
</script>

{@render children()}
```

**3. Keep the `content-type` header of SSR responses.** SvelteKit drops response headers from `load` fetches unless you allow them, and urql needs this one.

```ts
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit/hooks'; // from '@sveltejs/kit' in SvelteKit 2
import { graphqlResponseHeaders } from 'svelte-urql-runes/kit';

export const handle: Handle = ({ event, resolve }) =>
	resolve(event, { filterSerializedResponseHeaders: graphqlResponseHeaders });
```

**4. Optional: prefetch in `load` so the data is in the SSR HTML.** Reuse the layout's client. Don't create another one.

```ts
// src/routes/todos/+page.ts
export const load = async ({ parent }) => {
	const { client } = await parent();
	await client.query(TodosQuery, {}).toPromise();
};
```

Then call `createQuery({ query: TodosQuery })` in the page as usual. During SSR it renders the prefetched data from the cache. During hydration, SvelteKit replays the inlined response, so the browser sends **no** GraphQL request. Queries you don't prefetch render their loading state on the server and fetch in the browser.

On logout, call `resetKitClient()` and then `invalidateAll()` to start over with an empty cache. Queries and subscriptions that are already mounted switch to the new client, drop the old client's results and re-execute.

## Typing

Any `TypedDocumentNode` works. With gql.tada:

```ts
import { graphql } from 'gql.tada';

const TodoQuery = graphql(`
	query Todo($id: ID!) {
		todo(id: $id) { id title }
	}
`);

createQuery({ query: TodoQuery }); // ✗ type error: `variables` is required
createQuery({ query: TodoQuery, variables: { id: '1' } }); // ✓ data is typed
```

## Testing components that use it

Pass a client with a custom exchange, or put one in context. [`tests/helpers/client.ts`](./tests/helpers/client.ts) shows a client whose responses the test drives by hand. For SvelteKit `$app/*` mocks in component tests, see [sveltekit-test-kit](https://github.com/DmytroKondrashov/sveltekit-test-kit).

## Coming from `@urql/svelte`

| `@urql/svelte` | `svelte-urql-runes` |
|---|---|
| `queryStore({ client, query, variables })` | `createQuery(() => ({ query, variables }))` |
| `$todos.data` | `todos.data` |
| `mutationStore(...)` / `client.mutation(...)` | `createMutation(query).execute(variables)` |
| `subscriptionStore(args, handler)` | `createSubscription(() => args, handler)` |
| `setContextClient` / `getContextClient` | same names |

## Status

`0.x`: the API may still change before 1.0. Not yet supported:

- keeping previous data while new variables load (`keepPreviousData`)
- Suspense-style `await` integration (Svelte's async components)

Issues and PRs are welcome.

## License

MIT
