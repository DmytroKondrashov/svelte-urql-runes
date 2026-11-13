import {
	createRequest,
	type AnyVariables,
	type Client,
	type CombinedError,
	type DocumentInput,
	type Operation,
	type OperationContext,
	type OperationResult
} from '@urql/core';
import { pipe, toPromise } from 'wonka';
import { resolveClient } from './context.js';
import { emptySnapshot, toSnapshot, type ResultSnapshot } from './internal.js';

export interface MutationState<Data = any, Variables extends AnyVariables = AnyVariables> {
	/** Data from the most recent `execute` call to finish. */
	readonly data: Data | undefined;
	readonly error: CombinedError | undefined;
	readonly extensions: Record<string, any> | undefined;
	/** `true` while the most recent `execute` call is in flight. */
	readonly fetching: boolean;
	readonly operation: Operation<Data, Variables> | undefined;
	/**
	 * Runs the mutation. Resolves with the result; GraphQL and network errors are
	 * reported on `result.error` rather than by rejecting.
	 */
	execute(variables: Variables, context?: Partial<OperationContext>): Promise<OperationResult<Data, Variables>>;
}

/**
 * Prepares a GraphQL mutation. Nothing runs until `execute` is called. When calls
 * overlap, the state reflects the most recent one.
 *
 * ```svelte
 * <script lang="ts">
 *   const addTodo = createMutation(AddTodo);
 * </script>
 *
 * <button disabled={addTodo.fetching} onclick={() => addTodo.execute({ title: 'Milk' })}>Add</button>
 * ```
 */
export function createMutation<Data = any, Variables extends AnyVariables = AnyVariables>(
	query: DocumentInput<Data, Variables>,
	client?: Client
): MutationState<Data, Variables> {
	const urql = resolveClient(client);
	let snapshot = $state.raw<ResultSnapshot<Data, Variables>>(emptySnapshot());
	let fetching = $state(false);
	let latest = 0;

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
		get operation() {
			return snapshot.operation;
		},
		async execute(variables, context) {
			const call = ++latest;
			fetching = true;
			const result = await pipe(
				urql.executeMutation<Data, Variables>(createRequest(query, variables), context ?? {}),
				toPromise
			);
			if (call === latest) {
				snapshot = toSnapshot(result);
				fetching = false;
			}
			return result;
		}
	};
}
