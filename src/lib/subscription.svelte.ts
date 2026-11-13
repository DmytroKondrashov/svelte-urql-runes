import {
	createRequest,
	type AnyVariables,
	type Client,
	type CombinedError,
	type GraphQLRequestParams,
	type Operation,
	type OperationContext
} from '@urql/core';
import { untrack } from 'svelte';
import { onEnd, pipe, subscribe } from 'wonka';
import { resolveClient } from './context.js';
import { memoPrepared, toGetter, type MaybeGetter, type Prepared } from './internal.js';

export type SubscriptionOptions<Data = any, Variables extends AnyVariables = AnyVariables> = GraphQLRequestParams<
	Data,
	Variables
> & {
	context?: Partial<OperationContext>;
	/** While `true`, the subscription is closed. Accumulated data is kept. */
	pause?: boolean;
};

/** Combines the previous accumulated value with each incoming event. */
export type SubscriptionHandler<Data, Result> = (previous: Result | undefined, data: Data) => Result;

export interface SubscriptionState<Result = any, Data = any, Variables extends AnyVariables = AnyVariables> {
	/** The latest event, or the value accumulated by the handler. */
	readonly data: Result | undefined;
	readonly error: CombinedError | undefined;
	readonly extensions: Record<string, any> | undefined;
	/** `true` while the subscription is open. */
	readonly fetching: boolean;
	readonly operation: Operation<Data, Variables> | undefined;
}

/**
 * Opens a GraphQL subscription while the component is mounted. Subscriptions only
 * run in the browser; during SSR the state stays empty.
 *
 * With a `handler`, `data` holds whatever the handler returns, which makes it easy to
 * accumulate events:
 *
 * ```ts
 * const messages = createSubscription(
 *   () => ({ query: OnMessage, variables: { room } }),
 *   (list: Message[] = [], event) => [...list, event.message]
 * );
 * ```
 *
 * The accumulated value resets when the variables change.
 */
export function createSubscription<
	Data = any,
	Result = Data,
	Variables extends AnyVariables = AnyVariables
>(
	options: MaybeGetter<SubscriptionOptions<Data, Variables>>,
	handler?: SubscriptionHandler<Data, Result>,
	client?: Client
): SubscriptionState<Result, Data, Variables> {
	const getClient = resolveClient(client);
	const urql = $derived(getClient());
	const getOptions = toGetter(options);

	const prepared = $derived.by(
		memoPrepared<Data, Variables>(() => {
			const { query, variables, context, pause } = getOptions();
			return {
				request: createRequest(query, (variables ?? {}) as Variables),
				context: { ...context },
				pause: !!pause
			};
		})
	);

	let data = $state.raw<Result | undefined>(undefined);
	let error = $state.raw<CombinedError | undefined>(undefined);
	let extensions = $state.raw<Record<string, any> | undefined>(undefined);
	let operation = $state.raw<Operation<Data, Variables> | undefined>(undefined);
	let fetching = $state(false);
	let lastKey: number | undefined;
	let lastClient: Client | undefined;

	$effect(() => {
		const current: Prepared<Data, Variables> = prepared;
		const active = urql;

		// A new client (e.g. after logout) must not show the old client's events.
		if (lastClient !== undefined && lastClient !== active) {
			data = undefined;
			error = undefined;
			extensions = undefined;
			operation = undefined;
		}
		lastClient = active;

		if (current.pause) {
			fetching = false;
			return;
		}

		if (lastKey !== undefined && lastKey !== current.request.key) {
			data = undefined;
			error = undefined;
			extensions = undefined;
		}
		lastKey = current.request.key;
		fetching = true;

		// Untracked: the effect writes `data`, so it must not depend on it.
		let accumulated = untrack(() => data);
		const { unsubscribe } = pipe(
			active.executeSubscription<Data, Variables>(current.request, current.context),
			onEnd(() => {
				fetching = false;
			}),
			subscribe((result) => {
				error = result.error;
				extensions = result.extensions;
				operation = result.operation;
				if (result.data !== undefined) {
					accumulated = handler
						? handler(accumulated, result.data)
						: (result.data as unknown as Result);
					data = accumulated;
				}
			})
		);
		return () => {
			unsubscribe();
			fetching = false;
		};
	});

	return {
		get data() {
			return data;
		},
		get error() {
			return error;
		},
		get extensions() {
			return extensions;
		},
		get fetching() {
			return fetching;
		},
		get operation() {
			return operation;
		}
	};
}
