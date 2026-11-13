import type {
	AnyVariables,
	Client,
	CombinedError,
	GraphQLRequest,
	Operation,
	OperationContext,
	OperationResult
} from '@urql/core';

export type MaybeGetter<T> = T | (() => T);

export function toGetter<T>(value: MaybeGetter<T>): () => T {
	return typeof value === 'function' ? (value as () => T) : () => value;
}

/** The serialisable part of an operation result that the bindings expose. */
export interface ResultSnapshot<Data, Variables extends AnyVariables> {
	data: Data | undefined;
	error: CombinedError | undefined;
	extensions: Record<string, any> | undefined;
	stale: boolean;
	hasNext: boolean;
	operation: Operation<Data, Variables> | undefined;
}

export function emptySnapshot<Data, Variables extends AnyVariables>(): ResultSnapshot<Data, Variables> {
	return {
		data: undefined,
		error: undefined,
		extensions: undefined,
		stale: false,
		hasNext: false,
		operation: undefined
	};
}

export function toSnapshot<Data, Variables extends AnyVariables>(
	result: OperationResult<Data, Variables>
): ResultSnapshot<Data, Variables> {
	return {
		data: result.data,
		error: result.error,
		extensions: result.extensions,
		stale: !!result.stale,
		hasNext: !!result.hasNext,
		operation: result.operation
	};
}

/** A request plus everything that decides whether it must be re-executed. */
export interface Prepared<Data, Variables extends AnyVariables> {
	request: GraphQLRequest<Data, Variables>;
	context: Partial<OperationContext>;
	pause: boolean;
}

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
	const keys = Object.keys(a);
	if (keys.length !== Object.keys(b).length) return false;
	return keys.every((key) => Object.is(a[key], b[key]));
}

export function samePrepared(a: Prepared<any, any>, b: Prepared<any, any>): boolean {
	return (
		a.request.key === b.request.key &&
		a.pause === b.pause &&
		shallowEqual(a.context as Record<string, unknown>, b.context as Record<string, unknown>)
	);
}

/**
 * Wraps `prepare` so it returns the previous object while nothing relevant changed.
 * Used inside `$derived`, this keeps effects from re-subscribing when a getter
 * re-runs but produces the same request.
 */
export function memoPrepared<Data, Variables extends AnyVariables>(
	prepare: () => Prepared<Data, Variables>
): () => Prepared<Data, Variables> {
	let previous: Prepared<Data, Variables> | undefined;
	return () => {
		const next = prepare();
		if (previous && samePrepared(previous, next)) return previous;
		return (previous = next);
	};
}

/**
 * Reads a query result from the cache without touching the network. Unlike
 * `client.readQuery` with the default policy, a cache miss never starts (and then
 * aborts) a request.
 */
export function readCached<Data, Variables extends AnyVariables>(
	client: Client,
	prepared: Prepared<Data, Variables>
): OperationResult<Data, Variables> | null {
	const { request, context } = prepared;
	const result = client.readQuery<Data, Variables>(request.query, request.variables, {
		...context,
		requestPolicy: 'cache-only'
	});
	return result && (result.data != null || result.error) ? result : null;
}
