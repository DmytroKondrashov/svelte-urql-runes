import { TodosQuery } from './graphql.js';
import type { PageLoad } from './$types';

// Prefetch into the layout's client. The component below then renders the todos during
// SSR, and hydrates without requesting them again.
export const load: PageLoad = async ({ parent }) => {
	const { client } = await parent();
	await client.query(TodosQuery, {}).toPromise();
};
