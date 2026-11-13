import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './graphql-env.d.ts';

export const graphql = initGraphQLTada<{ introspection: introspection }>();

export const TodosQuery = graphql(`
	query Todos {
		todos {
			id
			title
			done
		}
	}
`);

export const TodoQuery = graphql(`
	query Todo($id: ID!) {
		todo(id: $id) {
			id
			title
			done
		}
	}
`);

export const AddTodo = graphql(`
	mutation AddTodo($title: String!) {
		addTodo(title: $title) {
			id
			title
			done
		}
	}
`);
