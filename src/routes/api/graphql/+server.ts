import { error, json } from '@sveltejs/kit';
import { buildSchema, graphql } from 'graphql';
import source from './schema.graphql?raw';
import type { RequestHandler } from './$types';

// A tiny in-memory GraphQL API for the demo app and the e2e tests.
const schema = buildSchema(source);

type Todo = { id: string; title: string; done: boolean };
const todos: Todo[] = [
	{ id: '1', title: 'Write the README', done: true },
	{ id: '2', title: 'Publish to npm', done: false }
];

const rootValue = {
	todos: () => todos,
	todo: ({ id }: { id: string }) => todos.find((t) => t.id === id) ?? null,
	addTodo: ({ title }: { title: string }) => {
		const todo = { id: String(todos.length + 1), title, done: false };
		todos.push(todo);
		return todo;
	},
	toggleTodo: ({ id }: { id: string }) => {
		const todo = todos.find((t) => t.id === id);
		if (todo) todo.done = !todo.done;
		return todo ?? null;
	}
};

async function execute(body: { query?: string; variables?: Record<string, unknown> | null }) {
	if (!body.query) error(400, 'Missing query');
	return json(await graphql({ schema, source: body.query, variableValues: body.variables, rootValue }));
}

export const GET: RequestHandler = ({ url }) => {
	const variables = url.searchParams.get('variables');
	return execute({
		query: url.searchParams.get('query') ?? undefined,
		variables: variables ? JSON.parse(variables) : null
	});
};

export const POST: RequestHandler = async ({ request }) => execute(await request.json());
