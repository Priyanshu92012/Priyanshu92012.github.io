import { test, expect } from '@playwright/test';
import { ROUTES, guard, noHorizontalOverflow } from './helpers';

for (const route of ROUTES) {
  test(`${route} renders cleanly with complete metadata`, async ({ page }) => {
    const problems = await guard(page);
    const res = await page.goto(route, { waitUntil: 'networkidle' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    expect(await page.title()).toMatch(/PRIYANSHU\.EXE/);
    expect(await page.locator('meta[name="description"]').getAttribute('content')).toBeTruthy();
    expect(await page.locator('meta[property="og:image"]').getAttribute('content')).toMatch(/\/og\.png$/);
    expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toMatch(/^https:\/\/priyanshu92012\.github\.io\//);
    await noHorizontalOverflow(page);
    expect(problems).toEqual([]);
  });
}

for (const width of [320, 390]) {
  for (const route of ROUTES) {
    test(`${route} reflows at ${width}px (WCAG 1.4.10)`, async ({ page }) => {
      await guard(page);
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${route}${route.includes('?') ? '&' : '?'}3d=0`, { waitUntil: 'networkidle' });
      await noHorizontalOverflow(page);
    });
  }
}

test('legacy URLs still resolve', async ({ page }) => {
  for (const url of ['/gmre_architecture_v3.html', '/v1/', '/og.png', '/robots.txt', '/sitemap-index.xml']) {
    const res = await page.request.get(url);
    expect(res.status(), url).toBe(200);
  }
});

test('the V3 design lab is never part of the production build', async ({ page }) => {
  for (const url of ['/design-lab/', '/design-lab/monolith/', '/design-lab/orbit/', '/design-lab/signal/']) {
    expect((await page.request.get(url)).status(), url).toBe(404);
  }
  expect(await (await page.request.get('/sitemap-0.xml')).text()).not.toContain('design-lab');
});

test('unknown routes get the custom 404 page', async ({ page }) => {
  await guard(page);
  const res = await page.goto('/this-does-not-exist/');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('no valid state');
});
