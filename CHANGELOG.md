# Changelog

## 0.1.0 (unreleased)

First release.

- `createQuery`: reactive, getter-based queries with `pause`, `refetch`, `stale` and `hasNext`. Synchronous cache reads, so cached results are there on the first render.
- `createMutation`: reactive mutation state; `execute` resolves with the result and never rejects.
- `createSubscription`: optional accumulating handler; resets when the variables change.
- `setContextClient` / `getContextClient`, accepting a client or a getter. Bindings follow the getter, so mounted queries and subscriptions move to a new client (for example after logout).
- `svelte-urql-runes/kit`: `createKitClient`, `graphqlResponseHeaders` and `resetKitClient` for SvelteKit SSR with hydration that does not refetch.
