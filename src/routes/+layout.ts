import { cacheExchange, fetchExchange } from '@urql/core';
import { createKitClient } from '../lib/kit.js';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = (event) => ({
	client: createKitClient(event, {
		url: '/api/graphql',
		exchanges: [cacheExchange, fetchExchange]
	})
});
