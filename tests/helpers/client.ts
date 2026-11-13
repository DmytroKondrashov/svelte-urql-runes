import {
	Client,
	cacheExchange,
	gql,
	makeErrorResult,
	makeResult,
	type Exchange,
	type Operation,
	type OperationResult,
	type OperationType
} from '@urql/core';
import { filter, makeSubject, merge, pipe } from 'wonka';

export const TodoQuery = gql<{ todo: { id: string; title: string } }, { id: string }>`
	query Todo($id: ID!) {
		todo(id: $id) {
			id
			title
		}
	}
`;

export const AddTodo = gql<{ addTodo: { id: string } }, { title: string }>`
	mutation AddTodo($title: String!) {
		addTodo(title: $title) {
			id
		}
	}
`;

export const OnTick = gql<{ tick: number }, { channel: string }>`
	subscription OnTick($channel: String!) {
		tick(channel: $channel)
	}
`;

/**
 * An urql client whose network layer is driven by the test: every operation that
 * reaches the network is recorded, and nothing comes back until `respond` is called.
 */
export function createTestClient() {
	const results = makeSubject<OperationResult>();
	const operations: Operation[] = [];
	const teardowns: number[] = [];

	const exchange: Exchange = () => (ops$) =>
		merge([
			pipe(
				ops$,
				filter((op) => {
					if (op.kind === 'teardown') teardowns.push(op.key);
					else operations.push(op);
					return false;
				})
			) as unknown as typeof results.source,
			results.source
		]);

	const client = new Client({ url: 'http://test.local/graphql', exchanges: [cacheExchange, exchange] });

	function last(kind: OperationType = 'query'): Operation {
		const op = operations.findLast((o) => o.kind === kind);
		if (!op) throw new Error(`no ${kind} operation was sent`);
		return op;
	}

	return {
		client,
		operations,
		teardowns,
		last,
		count: (kind: OperationType = 'query') => operations.filter((o) => o.kind === kind).length,
		respond(op: Operation, data: unknown, extra: Partial<OperationResult> = {}) {
			results.next({ ...makeResult(op, { data: data as Record<string, any> }), ...extra });
		},
		fail(op: Operation, message = 'boom') {
			results.next(makeErrorResult(op, new Error(message)));
		}
	};
}
