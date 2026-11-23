// Release pass (v2.1): compact header + menu drawer, English/German, the simple tiger greeting, analytics off.
import { test, expect } from '@playwright/test';
import { guard, ready, noHorizontalOverflow } from './helpers';

test('header: logo, EN/DE, Recruiter, menu; no link row, no ⌘K, no Guide button, no field-notes strip', async ({ page }) => {
  const problems = await guard(page);
  await page.goto('/');
  const header = page.locator('.site-header');
  await expect(header.getByRole('link', { name: /PRIYANSHU\.EXE, home/ })).toBeVisible();
  await expect(header.getByRole('link', { name: 'EN', exact: true })).toHaveAttribute('aria-current', 'true');
  await expect(header.getByRole('link', { name: 'DE', exact: true })).toHaveAttribute('href', '/de/');
  await expect(header.getByRole('link', { name: /Recruiter/ })).toBeVisible();
  await expect(header.getByRole('button', { name: 'Open menu' })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Work', exact: true })).toHaveCount(0);
  await expect(header.getByRole('button', { name: /Guide|⌘K|palette/ })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/field notes on systems/i);
  expect(problems).toEqual([]);
});

test('menu drawer: focus moves in and is trapped, Escape and the scrim close it, scroll is locked and restored', async ({ page }) => {
  await guard(page);
  await page.goto('/work/');
  await ready(page);
  const btn = page.getByRole('button', { name: 'Open menu' });
  await btn.click();
  const dlg = page.getByRole('dialog', { name: 'Menu' });
  await expect(dlg).toBeVisible();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
  await expect(dlg.getByRole('link', { name: /^Work/ })).toHaveAttribute('aria-current', 'page');
  for (const name of [/^Work/, /^Skills/, /^Engineering Labs/, /^BREACH MODE/, /^AI Systems Lab/, /^Engineering X-Ray/, /^About/, /^Contact/]) await expect(dlg.getByRole('link', { name })).toBeVisible();
  // focus stays inside while tabbing
  for (let i = 0; i < 16; i++) { await page.keyboard.press('Tab'); expect(await dlg.evaluate((d) => d.contains(document.activeElement))).toBe(true); }
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  await expect(btn).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
  await btn.click();
  await page.mouse.click(40, 300); // the scrim, left of the panel
  await expect(dlg).toBeHidden();
  await btn.click();
  await dlg.getByRole('link', { name: /^AI Systems Lab/ }).click();
  await page.waitForURL('**/ai-lab/');
});

test('German: same page in German, no detour to the homepage, correct lang, hreflang and canonical', async ({ page }) => {
  const problems = await guard(page);
  await page.goto('/work/opticlab/');
  await page.locator('.site-header').getByRole('link', { name: 'DE', exact: true }).click();
  await page.waitForURL('**/de/work/opticlab/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.locator('h1')).toHaveText('OpticLab Secure Controller');
  await expect(page.locator('.case-meta')).toContainText('Rolle');
  await expect(page.locator('.case-head .lede')).toContainText('Sicherheitslabor für Embedded Linux');
  await expect(page.locator('.en-note').first()).toContainText('auf Englisch');
  expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toBe('https://priyanshu92012.github.io/de/work/opticlab/');
  expect(await page.locator('link[hreflang="en"]').getAttribute('href')).toBe('https://priyanshu92012.github.io/work/opticlab/');
  // the choice is remembered: an English link now lands on the German page
  await page.goto('/skills/');
  await page.waitForURL('**/de/skills/');
  await page.locator('.site-header').getByRole('link', { name: 'EN', exact: true }).click();
  await page.waitForURL(/\/skills\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(problems).toEqual([]);
});

test.describe('German browser without an explicit choice', () => {
  test.use({ locale: 'de-DE' });
  test('stays on English pages (no automatic language switch)', async ({ page }) => {
    await guard(page);
    await page.goto('/about/');
    await page.waitForTimeout(400);
    expect(new URL(page.url()).pathname).toBe('/about/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test('German homepage, recruiter and tiger greeting', async ({ page }) => {
  const problems = await guard(page, { greet: true });
  await page.goto('/de/');
  await expect(page.locator('.hero-headline')).toContainText('Ich entwickle intelligente,');
  await expect(page.locator('.hero-role')).toHaveText('Software Engineering · Cybersecurity · KI & Machine Learning');
  await expect(page.locator('.intro-sec')).toContainText('Duales Studium Informatik');
  await expect(page.locator('.sk-langs')).toContainText('Deutsch · Verhandlungssicher');
  await ready(page);
  const bubble = page.locator('.pb-bubble--greet');
  await expect(bubble).toContainText('Hey! 🐯 Ich bin Priyanshus kleiner Bot. Möchtest du seine Projekte entdecken?', { timeout: 8000 });
  await expect(bubble.getByRole('link', { name: 'Projekte entdecken' })).toHaveAttribute('href', '/de/work/');
  await bubble.getByRole('button', { name: 'Frag mich etwas' }).click();
  const chat = page.getByRole('dialog', { name: 'Priyanshus kleiner Bot' });
  await chat.getByRole('button', { name: 'Frag mich etwas' }).click();
  await chat.getByLabel('Nachricht an Priyanshus kleinen Bot').fill('Was macht er bei Nokia?');
  await chat.getByLabel('Nachricht an Priyanshus kleinen Bot').press('Enter');
  await expect(chat.locator('.ck-row.bot').last()).toContainText('Bei Nokia baut er Tooling');
  await page.goto('/de/recruiter/');
  await expect(page.locator('.cv-sec > h2')).toHaveText(['Profil', 'Berufserfahrung', 'Ausgewählte Projekte', 'Skills', 'Ausbildung', 'Sprachen']);
  await noHorizontalOverflow(page);
  expect(problems).toEqual([]);
});

test('analytics is off in this build: no beacon, no counter, no third-party request', async ({ page }) => {
  const problems = await guard(page);
  await page.goto('/');
  await expect(page.locator('[data-analytics]')).toHaveCount(0);
  await expect(page.locator('[data-visitor-count]')).toHaveCount(0);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).not.toContain('goatcounter');
  expect(problems).toEqual([]);
});
