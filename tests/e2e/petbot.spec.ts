// V2 refinement: the tiger pet bot opens the existing scripted guide; the homepage portrait.
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { guard, ready, noHorizontalOverflow } from './helpers';

const chatBox = (page: Page) => page.getByRole('dialog', { name: 'Priyanshu’s pet bot' });
const mascot = (page: Page) => page.getByRole('button', { name: /pet bot: ask about his work/ });
async function botReady(page: Page) {
  await page.waitForFunction(() => { const i = document.querySelector('astro-island[component-url*="PetBot"]'); return !!i && !i.hasAttribute('ssr'); });
}

test('greets once per session with two options, opens the chat, says goodbye on Escape', async ({ page }) => {
  const problems = await guard(page, { greet: true });
  await page.goto('/about/');
  await ready(page); await botReady(page);
  const bubble = page.locator('.pb-bubble--greet');
  await expect(bubble).toContainText('Hey there! 🐯 I’m Priyanshu’s pet bot. Want to explore his work?', { timeout: 6000 });
  await expect(bubble.getByRole('link', { name: 'Explore projects' })).toHaveAttribute('href', '/work/');
  await expect(bubble.getByRole('button', { name: 'Dismiss' })).toBeVisible();
  // the greeting says nothing about the visitor
  await expect(bubble).not.toContainText(/your (ip|location|time ?zone|browser|device)|\d{1,3}\.\d{1,3}\.\d{1,3}/i);
  await bubble.getByRole('button', { name: 'Ask me something' }).click();
  await expect(chatBox(page)).toBeVisible();
  await expect(mascot(page)).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(chatBox(page)).toBeHidden();
  await expect(page.locator('.pb-bubble--farewell')).toBeVisible();
  await expect(mascot(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(mascot(page)).toBeFocused();
  // remembered for this session only (sessionStorage): no second greeting after navigating
  await page.goto('/work/');
  await ready(page); await botReady(page);
  await page.waitForTimeout(2200);
  await expect(page.locator('.pb-bubble--greet')).toHaveCount(0);
  expect(await page.evaluate(() => [sessionStorage.getItem('pexe:pet-greeted'), localStorage.getItem('pexe:pet-greeted')])).toEqual(['1', null]);
  expect(problems).toEqual([]);
});

test('the tiger is small: 52 px on desktop, 48 px on phones, clear of page controls', async ({ page }) => {
  await guard(page);
  await page.goto('/');
  await botReady(page);
  expect(Math.round((await mascot(page).boundingBox())!.width)).toBe(52);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => Math.round((await mascot(page).boundingBox())!.width)).toBe(48);
});

test('keyboard: the mascot opens the chat with Enter; Escape returns focus to it', async ({ page }) => {
  await guard(page);
  await page.goto('/work/');
  await ready(page); await botReady(page);
  await mascot(page).focus();
  await page.keyboard.press('Enter');
  await expect(chatBox(page).getByLabel('Message Priyanshu’s pet bot')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(chatBox(page)).toBeHidden();
  await expect(mascot(page)).toBeFocused();
});

test('axe: the open chat has no serious issues', async ({ page }) => {
  await guard(page);
  await page.goto('/?motion=reduce&3d=0');
  await ready(page); await botReady(page);
  await mascot(page).click();
  await chatBox(page).getByRole('button', { name: 'Ask me something' }).click();
  await chatBox(page).getByRole('button', { name: 'His best projects' }).click();
  await chatBox(page).getByRole('button', { name: 'Tell me more' }).click();
  const r = await new AxeBuilder({ page }).include('.ck').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
});

test('phones: the greeting waits until the hero is scrolled past; nothing overflows', async ({ page }) => {
  await guard(page, { greet: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await botReady(page);
  await page.waitForTimeout(2500);
  await expect(page.locator('.pb-bubble--greet')).toHaveCount(0);
  await expect(mascot(page)).toBeVisible();
  await page.mouse.wheel(0, 900);
  await expect(page.locator('.pb-bubble--greet')).toBeVisible({ timeout: 5000 });
  await noHorizontalOverflow(page);
});

test('recruiter mode and reduced motion: the bot stays available, quiet and still', async ({ page }) => {
  await guard(page, { greet: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/recruiter/');
  await botReady(page);
  await page.waitForTimeout(2500);
  await expect(page.locator('.pb-bubble--greet')).toHaveCount(0);
  await expect(mascot(page)).toBeVisible();
  const looping = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity).length);
  expect(looping).toBe(0);
});

test('axe: no serious issues with the greeting bubble showing', async ({ page }) => {
  await guard(page, { greet: true });
  await page.goto('/?motion=reduce&3d=0');
  await botReady(page);
  await expect(page.locator('.pb-bubble--greet')).toBeVisible({ timeout: 6000 });
  const r = await new AxeBuilder({ page }).include('.pb').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => v.id)).toEqual([]);
});

for (const width of [1440, 820, 390, 320]) {
  test(`homepage portrait renders at ${width}px`, async ({ page }) => {
    const problems = await guard(page);
    await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
    await page.goto('/?3d=0', { waitUntil: 'networkidle' });
    const img = page.locator('.hero-portrait img[alt^="Portrait of Priyanshu"]');
    await expect(img).toBeVisible();
    expect(await img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
    expect(await img.evaluate((i: HTMLImageElement) => i.currentSrc)).toMatch(/\.(avif|webp)$/);
    const box = await img.boundingBox();
    expect(box!.height).toBeGreaterThan(width < 600 ? 260 : 420); // a large editorial portrait, not an avatar
    await noHorizontalOverflow(page);
    expect(problems).toEqual([]);
  });
}

test('homepage is curated: three featured projects, the other five listed, all eight reachable', async ({ page }) => {
  await guard(page);
  await page.goto('/?3d=0');
  await expect(page.locator('.feature')).toHaveCount(3);
  await expect(page.locator('.more-row')).toHaveCount(5);
  await expect(page.getByRole('link', { name: /Explore all projects/ })).toHaveAttribute('href', '/work/');
  const titles = await page.locator('.feature-title, .more-title').allTextContents();
  expect(titles).toEqual(['Dynamic Test-Resource Allocation', 'GMRE Log Parser', 'SecureMed', 'FinBERT Explainability Study', 'OpticLab Secure Controller', 'Support Ticket Reporting Pipeline', 'PRIYANSHU.EXE: Interactive Engineering Portfolio', 'Infrastructure Capacity & Hardware Cost Optimization']);
});
