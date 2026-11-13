import { expect, test, type Page } from '@playwright/test';

/** Records every request the browser sends to the GraphQL endpoint. */
function trackGraphQL(page: Page) {
	const requests: string[] = [];
	page.on('request', (request) => {
		if (new URL(request.url()).pathname === '/api/graphql') requests.push(request.url());
	});
	return requests;
}

test('renders prefetched query data during SSR', async ({ request }) => {
	const html = await (await request.get('/')).text();
	expect(html).toContain('Write the README');
	expect(html).toContain('Publish to npm');
	expect(html).not.toContain('Loading…');
});

test('hydrates from the SSR response without refetching', async ({ page }) => {
	const requests = trackGraphQL(page);
	const errors: string[] = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error' || msg.type() === 'warning') errors.push(msg.text());
	});

	await page.goto('/');
	await expect(page.getByRole('button', { name: 'Write the README' })).toBeVisible();
	await page.waitForLoadState('networkidle');

	expect(requests).toEqual([]);
	expect(errors).toEqual([]);
});

test('reactive queries re-run in the browser when their variables change', async ({ page }) => {
	const requests = trackGraphQL(page);
	await page.goto('/');
	await page.waitForLoadState('networkidle');

	await page.getByRole('button', { name: 'Publish to npm' }).click();
	await expect(page.getByTestId('detail')).toContainText('#2: Publish to npm (open)');

	await page.getByRole('button', { name: 'Write the README' }).click();
	await expect(page.getByTestId('detail')).toContainText('#1: Write the README (done)');
	expect(requests).toHaveLength(2);

	// Going back to a todo that was already loaded is served from the cache.
	await page.getByRole('button', { name: 'Publish to npm' }).click();
	await expect(page.getByTestId('detail')).toContainText('#2: Publish to npm');
	expect(requests).toHaveLength(2);
});

test('mutations run and refetch updates the list', async ({ page }) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');

	const title = `Todo ${Date.now()}`;
	await page.getByPlaceholder('New todo').fill(title);
	await page.getByRole('button', { name: 'Add' }).click();

	await expect(page.getByTestId('todos')).toContainText(title);
	await expect(page.getByPlaceholder('New todo')).toHaveValue('');
});
