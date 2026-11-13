import { flushSync } from 'svelte';
import { afterEach } from 'vitest';

const cleanups: Array<() => void> = [];

afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

/** Runs `fn` inside an effect root (as if in a component) and flushes its effects. */
export function withRoot<T>(fn: () => T): { value: T; destroy: () => void } {
	let value!: T;
	const destroy = $effect.root(() => {
		value = fn();
	});
	cleanups.push(destroy);
	flushSync();
	return { value, destroy };
}
