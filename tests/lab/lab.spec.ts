// V3 design lab: three concepts + gallery. Layout at 1440/820/390/320, the pet bot, progressive
// disclosure, accessibility, no-JS and reduced motion. Every test also fails on console errors and
// on any request to another host (guard()).
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { guard, noHorizontalOverflow } from '../e2e/helpers';

const CONCEPTS = [
  { id: 'monolith', path: '/design-lab/monolith/' },
  { id: 'orbit', path: '/design-lab/orbit/' },
  { id: 'signal', path: '/design-lab/signal/' },
] as const;
const FLAGSHIPS = ['test-resource-scheduler', 'securemed', 'finbert-xai'];
const QUESTIONS: [string, string][] = [
  ['Who is Priyanshu?', 'who'], ['What does he do at Nokia?', 'nokia'], ['What are his coolest projects?', 'best'],
  ['What AI experience does he have?', 'ai'], ['What cybersecurity work has he done?', 'security'], ['What technologies does he use?', 'tech'],
  ['Tell me about his education.', 'education'], ['Why should I hire him?', 'interesting'], ['How can I contact him?', 'contact'],
];

async function hydrated(page: Page) {
  await page.waitForFunction(() => { const i = document.querySelector('astro-island[component-url*="PetBot"]'); return !!i && !i.hasAttribute('ssr'); });
}

for (const c of CONCEPTS) {
  test.describe(c.id, () => {
    for (const width of [1440, 820, 390, 320]) {
      test(`renders cleanly at ${width}px`, async ({ page }) => {
        const problems = await guard(page);
        await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
        const res = await page.goto(c.path, { waitUntil: 'networkidle' });
        expect(res?.status()).toBe(200);
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('h1')).toContainText('Priyanshu');
        expect(await page.locator('meta[name="robots"]').getAttribute('content')).toBe('noindex');
        await expect(page.locator('img[alt^="Portrait of Priyanshu"]')).toHaveCount(1);
        expect(await page.locator('[data-fs]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.fs))).toEqual(FLAGSHIPS);
        await expect(page.locator('a[href="/work/"]', { hasText: /Explore All Projects/ })).toHaveCount(1);
        await expect(page.locator('.pb-btn')).toBeVisible();
        await noHorizontalOverflow(page);
        expect(problems).toEqual([]);
      });
    }

    test('pet bot greets once, answers the nine questions, and closes with Escape', async ({ page }) => {
      const problems = await guard(page);
      await page.goto(c.path);
      await hydrated(page);
      const greet = page.locator('.pb-bubble--greet');
      await expect(greet).toContainText('I’m Priyanshu’s pet bot', { timeout: 6000 });

      await greet.getByRole('button', { name: /Ask me something/ }).click();
      const dialog = page.getByRole('dialog', { name: /Pet Bot/ });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('Hey there! I’m here to help you discover Priyanshu’s work.');
      for (const [q, intent] of QUESTIONS) {
        const back = dialog.getByRole('button', { name: 'All questions' });
        if (await back.isVisible()) await back.click();
        await dialog.getByRole('button', { name: q }).click();
        await expect(dialog.locator('.pbp-answer').last()).toHaveAttribute('data-intent', intent);
        await expect(dialog.locator('.pbp-answer').last().locator('.pbp-link').first()).toBeVisible();
      }
      // free text, with an honest fallback
      await dialog.getByLabel('Ask the pet bot').fill('What is his favourite pizza?');
      await dialog.getByLabel('Ask the pet bot').press('Enter');
      await expect(dialog.locator('.pbp-answer').last()).toHaveAttribute('data-intent', 'unknown');

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(page.locator('.pb-btn')).toBeFocused();
      await expect(page.locator('.pb-bubble--farewell')).toBeVisible();

      // the greeting never repeats in the same session; '/' still opens the bot
      await page.reload();
      await hydrated(page);
      await page.waitForTimeout(2200);
      await expect(page.locator('.pb-bubble--greet')).toHaveCount(0);
      await page.locator('body').press('/');
      await expect(page.getByRole('dialog', { name: /Pet Bot/ })).toBeVisible();
      expect(problems).toEqual([]);
    });

    test('pet bot is keyboard operable and traps focus while open', async ({ page }) => {
      await guard(page);
      await page.goto(c.path);
      await hydrated(page);
      await page.locator('.pb-btn').focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: /Pet Bot/ });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('.pbp-q').first()).toBeFocused();
      for (let i = 0; i < 16; i++) {
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => !!document.activeElement?.closest('.pbp'))).toBe(true);
      }
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });

    test('flagship details open on demand, with case-study and lab links', async ({ page }) => {
      const problems = await guard(page);
      await page.goto(c.path);
      await hydrated(page);
      const first = page.locator('[data-fs="test-resource-scheduler"]');
      const toggle = first.locator('[data-fs-toggle]');
      await toggle.scrollIntoViewIfNeeded();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      const region = page.locator(`#${await toggle.getAttribute('aria-controls')}`);
      await expect(region.locator('a[href="/work/test-resource-scheduler/"]')).toBeVisible();
      await expect(region.locator('a[href="/work/test-resource-scheduler/#demo"]')).toBeVisible();
      // every showcase states what is real and what is a demo
      await expect(page.locator('[data-fs="finbert-xai"]')).toContainText('NOT FinBERT');
      await expect(page.locator('[data-fs="securemed"]')).toContainText('not the course application');
      expect(problems).toEqual([]);
    });

    test('axe WCAG 2.2 AA: no serious or critical issues (reduced motion)', async ({ page }) => {
      await guard(page);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`${c.path}?motion=reduce&3d=0`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.querySelectorAll('[data-rv]').forEach((e) => e.classList.add('in')));
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).exclude('canvas').analyze();
      const serious = r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
      expect(serious.map((v) => `${v.id}: ${v.nodes.slice(0, 5).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });

    test('reduced motion: nothing loops, no WebGL', async ({ page }) => {
      await guard(page);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(c.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2500);
      expect(await page.locator('canvas').count()).toBe(0);
      const looping = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity).length);
      expect(looping).toBe(0);
    });

    test('works without JavaScript', async ({ browser }) => {
      const ctx = await browser.newContext({ javaScriptEnabled: false });
      const page = await ctx.newPage();
      await page.goto(c.path);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('img[alt^="Portrait of Priyanshu"]')).toBeVisible();
      for (const slug of FLAGSHIPS) await expect(page.locator(`[data-fs="${slug}"] a[href="/work/${slug}/#demo"]`)).toBeVisible();
      await expect(page.locator('a[href="/work/"]', { hasText: /Explore All Projects/ })).toBeVisible();
      await ctx.close();
    });
  });
}

test('orbit: selecting an orbit reveals its project; Escape releases it', async ({ page }) => {
  const problems = await guard(page);
  await page.goto('/design-lab/orbit/?3d=0');
  await page.waitForFunction(() => { const i = document.querySelector('astro-island[component-url*="OrbitHero"]'); return !!i && !i.hasAttribute('ssr'); });
  const btn = page.getByRole('button', { name: /SecureMed/ }).first();
  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#o-panel')).toContainText('SecureMed');
  await expect(page.locator('#o-panel a[href="/work/securemed/#demo"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  expect(problems).toEqual([]);
});

test('orbit: the WebGL gyroscope starts on desktop and replaces the SVG rings', async ({ page }) => {
  const problems = await guard(page);
  await page.goto('/design-lab/orbit/');
  await expect(page.locator('.o-stage.is-3d')).toHaveCount(1, { timeout: 15000 });
  await expect(page.locator('.o-canvas canvas')).toHaveCount(1);
  expect(problems).toEqual([]);
});

test('monolith: the WebGL sculpture starts on desktop and falls back without WebGL', async ({ page }) => {
  const problems = await guard(page);
  await page.goto('/design-lab/monolith/');
  await expect(page.locator('.mono-stage.is-3d')).toHaveCount(1, { timeout: 15000 });
  await page.goto('/design-lab/monolith/?webgl=0');
  await page.waitForTimeout(2000);
  await expect(page.locator('.mono-poster')).toBeVisible();
  expect(await page.locator('canvas').count()).toBe(0);
  expect(problems).toEqual([]);
});

test('gallery lists A–D with full-screen links', async ({ page }) => {
  const problems = await guard(page);
  await page.goto('/design-lab/', { waitUntil: 'networkidle' });
  await expect(page.locator('h1')).toHaveCount(1);
  for (const href of ['/design-lab/monolith/', '/design-lab/orbit/', '/design-lab/signal/', '/']) {
    await expect(page.locator(`.g-card a[href="${href}"]`)).toHaveCount(1);
  }
  await noHorizontalOverflow(page);
  expect(problems).toEqual([]);
});
