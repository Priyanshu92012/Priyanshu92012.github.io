import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ROUTES, guard } from './helpers';

for (const theme of ['dark', 'paper'] as const) {
  for (const route of ROUTES) {
    test(`axe: ${route} (${theme})`, async ({ page }) => {
      await guard(page);
      await page.goto(`${route}?theme=${theme}&3d=0&motion=reduce`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-in')));
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .exclude('.lab-canvas').exclude('.cst-canvas')
        .analyze();
      const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
      expect(serious.map((v) => `${v.id}: ${v.nodes.slice(0, 6).map((n) => n.target.join(" ")).join(" | ")} :: ${v.nodes[0]?.failureSummary?.split("\n").slice(-1)[0] ?? ""}`)).toEqual([]);
    });
  }
}

test('skip link moves focus to the main content', async ({ page }) => {
  await guard(page);
  await page.goto('/about/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});
