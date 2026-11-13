import { flushSync } from 'svelte';
import { describe, expect, it } from 'vitest';
import { createSubscription } from '../src/lib/index.js';
import { createTestClient, OnTick } from './helpers/client.js';
import { withRoot } from './helpers/root.svelte.js';

describe('createSubscription', () => {
	it('exposes the latest event without a handler', () => {
		const t = createTestClient();
		const { value: s } = withRoot(() =>
			createSubscription({ query: OnTick, variables: { channel: 'a' } }, undefined, t.client)
		);
		expect(s.fetching).toBe(true);
		const op = t.last('subscription');

		t.respond(op, { tick: 1 });
		t.respond(op, { tick: 2 });
		expect(s.data).toEqual({ tick: 2 });
		expect(s.fetching).toBe(true);
	});

	it('accumulates events with a handler', () => {
		const t = createTestClient();
		const { value: s } = withRoot(() =>
			createSubscription(
				{ query: OnTick, variables: { channel: 'a' } },
				(ticks: number[] = [], event) => [...ticks, event.tick],
				t.client
			)
		);
		const op = t.last('subscription');
		t.respond(op, { tick: 1 });
		t.respond(op, { tick: 2 });
		expect(s.data).toEqual([1, 2]);
	});

	it('resubscribes and resets accumulated data when variables change', () => {
		const t = createTestClient();
		let channel = $state('a');
		const { value: s } = withRoot(() =>
			createSubscription(
				() => ({ query: OnTick, variables: { channel } }),
				(ticks: number[] = [], event) => [...ticks, event.tick],
				t.client
			)
		);
		const first = t.last('subscription');
		t.respond(first, { tick: 1 });

		channel = 'b';
		flushSync();
		expect(t.teardowns).toContain(first.key);
		expect(t.last('subscription').variables).toEqual({ channel: 'b' });
		expect(s.data).toBeUndefined();

		t.respond(t.last('subscription'), { tick: 5 });
		expect(s.data).toEqual([5]);
	});

	it('closes while paused and keeps accumulated data', () => {
		const t = createTestClient();
		let pause = $state(false);
		const { value: s } = withRoot(() =>
			createSubscription(
				() => ({ query: OnTick, variables: { channel: 'a' }, pause }),
				(ticks: number[] = [], event) => [...ticks, event.tick],
				t.client
			)
		);
		t.respond(t.last('subscription'), { tick: 1 });

		pause = true;
		flushSync();
		expect(t.teardowns).toContain(t.last('subscription').key);
		expect(s.fetching).toBe(false);
		expect(s.data).toEqual([1]);

		pause = false;
		flushSync();
		t.respond(t.last('subscription'), { tick: 2 });
		expect(s.data).toEqual([1, 2]);
	});

	it('closes when destroyed', () => {
		const t = createTestClient();
		const { value: s, destroy } = withRoot(() =>
			createSubscription({ query: OnTick, variables: { channel: 'a' } }, undefined, t.client)
		);
		const key = t.last('subscription').key;
		destroy();
		expect(t.teardowns).toContain(key);
		expect(s.fetching).toBe(false);
	});
});
