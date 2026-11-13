import {
	createRequest,
	type AnyVariables,
	type Client,
	type CombinedError,
	type GraphQLRequestParams,
	type Operation,
	type OperationContext,
	type OperationResult,
	type RequestPolicy
} from '@urql/core';
import { BROWSER } from 'esm-env';
import { untrack } from 'svelte';
import { pipe, subscribe } from 'wonka';
import { resolveClient } from './context.js';
import {
	emptySnapshot,
	memoPrepared,
	readCached,
	toGetter,
	toSnapshot,
	type MaybeGetter,
	type Prepared,
	type ResultSnapshot
} from './internal.js';

export type QueryOptions<Data = any, Variables extends AnyVariables = AnyVariables> = GraphQLRequestParams<
	Data,
	Variables
> & {
	/** Overrides the client's default request policy for this query. */
	requestPolicy?: RequestPolicy;
	/** Extra operation context, merged over the client's defaults. */
	context?: Partial<OperationContext>;
	/** While `true`, the query is not executed. Previous data is kept. */
	pause?: boolean;
};

export interface QueryState<Data = any, Variables extends AnyVariables = AnyVariables> {
	/** The latest result data, or `undefined` before the first result. */
	readonly data: Data | undefined;
	readonly error: CombinedError | undefined;
	readonly extensions: Record<string, any> | undefined;
	/** `true` while waiting for the first result of the current request. */
	readonly fetching: boolean;
	/** `true` when `data` came from the cache and a refresh is in flight. */
	readonly stale: boolean;
	/** `true` while more incremental (`@defer`/`@stream`) payloads are expected. */
	readonly hasNext: boolean;
	readonly operation: Operation<Data, Variables> | undefined;
	/**
	 * Re-executes the query, by default with the `network-only` policy. Runs even
	 * while the query is paused. Resolves with the next complete result.
	 */
	refetch(context?: Partial<OperationContext>): Promise<OperationResult<Data, Variables>>;
}

/**
 * Runs a GraphQL query and exposes its result as reactive state.
 *
 * Pass a getter to make the query reactive: whenever the variables, policy, context
 * or `pause` it returns change, the query re-executes. Call it during component
 * initialisation (or inside `$effect.root`).
 *
 * During SSR nothing is fetched, but results already in the client's cache (for
 * example from a `load` function) are rendered immediately.
 *
 * ```svelte
 * <script lang="ts">
 *   let { id } = $props();
 *   const todo = createQuery(() => ({ query: TodoQuery, variables: { id } }));
 * </script>
 *
 * {#if todo.fetching}Loading…{:else if todo.error}{todo.error.message}{:else}{todo.data?.todo.title}{/if}
 * ```
 */
export function createQuery<Data = any, Variables extends AnyVariables = AnyVariables>(
	options: MaybeGetter<QueryOptions<Data, Variables>>,
	client?: Client
): QueryState<Data, Variables> {
	const urql = resolveClient(client);
	const getOptions = toGetter(options);

	const prepared = $derived.by(
		memoPrepared<Data, Variables>(() => {
			const { query, variables, requestPolicy, context, pause } = getOptions();
			return {
				request: createRequest(query, (variables ?? {}) as Variables),
				context: requestPolicy ? { ...context, requestPolicy } : { ...context },
				pause: !!pause
			};
		})
	);

	let snapshot = $state.raw<ResultSnapshot<Data, Variables>>(emptySnapshot());
	let fetching = $state(false);

	// Bumped by `refetch` to force the effect below to run again.
	let refetches = $state(0);
	let override: Partial<OperationContext> | undefined;
	let waiters: Array<(result: OperationResult<Data, Variables>) => void> = [];
	let lastKey: number | undefined;

	function execute(current: Prepared<Data, Variables>, forced?: Partial<OperationContext>) {
		if (lastKey !== undefined && lastKey !== current.request.key) {
			snapshot = emptySnapshot();
		}
		lastKey = current.request.key;
		fetching = true;

		return pipe(
			urql.executeQuery<Data, Variables>(current.request, { ...current.context, ...forced }),
			subscribe((result) => {
				snapshot = toSnapshot(result);
				fetching = false;
				if (!result.stale && !result.hasNext && waiters.length) {
					const pending = waiters;
					waiters = [];
					for (const resolve of pending) resolve(result);
				}
			})
		).unsubscribe;
	}

	const initial = untrack(() => prepared);
	// In the browser, subscribe right away so a cached result is there for the first
	// render (and matches the SSR markup during hydration). The effect adopts this
	// subscription when it first runs.
	let eager: (() => void) | undefined;
	if (BROWSER) {
		if (!initial.pause) eager = execute(initial);
	} else {
		// During SSR effects never run: render whatever a load function put in the cache.
		const cached = initial.pause ? null : readCached(urql, initial);
		if (cached) snapshot = toSnapshot(cached);
		fetching = !cached && !initial.pause;
	}

	$effect(() => {
		refetches;
		const current: Prepared<Data, Variables> = prepared;
		const forced = override;
		override = undefined;

		if (eager) {
			const adopted = eager;
			eager = undefined;
			if (current === initial && !forced) return adopted;
			adopted();
		}

		if (current.pause && !forced) {
			fetching = false;
			return;
		}
		return execute(current, forced);
	});

	return {
		get data() {
			return snapshot.data;
		},
		get error() {
			return snapshot.error;
		},
		get extensions() {
			return snapshot.extensions;
		},
		get fetching() {
			return fetching;
		},
		get stale() {
			return snapshot.stale;
		},
		get hasNext() {
			return snapshot.hasNext;
		},
		get operation() {
			return snapshot.operation;
		},
		refetch(context) {
			override = { requestPolicy: 'network-only', ...context };
			refetches++;
			return new Promise((resolve) => waiters.push(resolve));
		}
	};
}
