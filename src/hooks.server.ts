import type { Handle } from '@sveltejs/kit/hooks';
import { graphqlResponseHeaders } from './lib/kit.js';

export const handle: Handle = ({ event, resolve }) =>
	resolve(event, { filterSerializedResponseHeaders: graphqlResponseHeaders });
