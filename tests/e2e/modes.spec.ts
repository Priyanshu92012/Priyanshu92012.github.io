import { test, expect } from '@playwright/test';
import { guard, ready } from './helpers';

test('light is the default; the header button (and P) switches to dark, which persists', async ({ page }) => {
  await guard(page);
  await page.goto('/about/');
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'paper');
  await page.locator('.site-header').getByRole('button', { name: 'Switch between light and dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/work/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.keyboard.press('p');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'paper');
});

test('recruiter mode: banner everywhere, exit restores immersive mode', async ({ page }) => {
  await guard(page);
  await page.goto('/recruiter/');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'recruiter');
  await page.goto('/work/');
  await expect(page.getByRole('region', { name: 'Recruiter mode' })).toBeVisible();
  await page.getByRole('button', { name: 'Exit' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'immersive');
  await expect(page.getByRole('region', { name: 'Recruiter mode' })).toBeHidden();
});

test('recruiter résumé makes no outcome claims; figures stay on the sourced case studies', async ({ page }) => {
  await guard(page);
  await page.goto('/recruiter/');
  const cv = page.locator('.cv');
  await expect(cv.locator('.basis')).toHaveCount(0);
  await expect(cv).toContainText('Outcomes and figures stay on the case-study pages, each labelled with its source.');
  await expect(cv).not.toContainText(/\d+\s?%/);
});

test('keyboard: no command palette any more; go-to chords, x-ray and konami still work', async ({ page }) => {
  await guard(page);
  await page.goto('/about/');
  await ready(page);
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /command palette/i })).toHaveCount(0);
  await page.keyboard.press('g'); await page.keyboard.press('s');
  await page.waitForURL('**/skills/');
  await ready(page);
  await page.keyboard.press('x');
  await expect(page.locator('html')).toHaveAttribute('data-xray', 'on');
  await expect(page.locator('astro-island[data-xray-label]').first()).toBeAttached();
  await page.keyboard.press('g'); await page.keyboard.press('a');
  await page.waitForURL('**/about/');
  await ready(page);
  for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) await page.keyboard.press(k);
  await expect(page.locator('.pexe-toast', { hasText: 'Blueprint unlocked' })).toBeVisible();
});

test('skills constellation: deep link, search and agent focus', async ({ page }) => {
  await guard(page);
  await page.goto('/skills/?focus=skill:python');
  const insp = page.getByLabel('Constellation inspector');
  await expect(insp).toContainText('Python');
  await page.getByLabel('Find a skill or project').fill('threat');
  await page.keyboard.press('Enter');
  await expect(insp).toContainText('Threat modelling');
  await expect(insp.locator('a[href="/work/securemed/"]')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('pexe:focus', { detail: { target: 'constellation', id: 'project:gmre-log-parser', source: 'agent' } })));
  await expect(insp).toContainText('GMRE Log Parser');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('content, links and the static lab still work', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-poster] a.mod')).toHaveCount(8);
    await expect(page.locator('.feature')).toHaveCount(3);
    await expect(page.locator('.more-row')).toHaveCount(5);
    await expect(page.locator('.hero-portrait img')).toBeVisible();
    await page.goto('/work/');
    await expect(page.locator('.index-row')).toHaveCount(8);
    await page.goto('/security-lab/');
    await expect(page.getByRole('heading', { name: /You decide what this page may look at/ })).toBeVisible();
    await page.goto('/skills/');
    await expect(page.locator('#skill-python')).toBeAttached();
    await page.goto('/work/securemed/');
    await expect(page.getByRole('heading', { name: 'Problem' })).toBeVisible();
  });
});

test('no WebGL: the lab stays on its static twin and says why', async ({ page }) => {
  await guard(page);
  await page.goto('/?webgl=0');
  await page.waitForTimeout(2500);
  await expect(page.locator('.lab-stage')).not.toHaveClass(/is-3d/);
  await expect(page.locator('[data-poster]')).toBeVisible();
});

test('3D lab survives viewport changes across the compact breakpoint (regression: removeChild crash)', async ({ page }) => {
  const problems = await guard(page);
  await page.goto('/');
  const live = await page.waitForSelector('.lab-stage.is-3d', { timeout: 15_000 }).then(() => true).catch(() => false);
  test.skip(!live, 'WebGL is not available in this browser');
  for (const w of [390, 1440, 700, 1280]) { await page.setViewportSize({ width: w, height: 860 }); await page.waitForTimeout(300); }
  await expect(page.locator('.lab-stage')).toHaveClass(/is-3d/);
  await expect(page.locator('.lab-pin:not([hidden])')).toHaveCount(13);
  expect(problems.filter((p) => /removeChild|pageerror/.test(p))).toEqual([]);
});
