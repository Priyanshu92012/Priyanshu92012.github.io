// BREACH MODE: consent first, nothing automatic, real browser boundaries, honest simulations.
import { test, expect } from '@playwright/test';
import { guard, noHorizontalOverflow } from './helpers';

// The lab deliberately triggers CSP refusals; those console errors are the expected result.
const EXPECTED = /Content Security Policy|Refused to (execute|evaluate|connect|load)|unsafe-eval|script-src|Failed to fetch|ERR_BLOCKED_BY_CSP/i;

test('nothing runs before consent; the gate needs an explicit acknowledgement', async ({ page }) => {
  const problems = await guard(page);
  await page.goto('/security-lab/');
  await expect(page.getByRole('heading', { name: /You decide what this page may look at/ })).toBeVisible();
  const grant = page.getByRole('button', { name: 'Grant permission' });
  await expect(grant).toBeDisabled();
  await expect(page.locator('.br-lab')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('.br-status')).toHaveCount(0);
  await noHorizontalOverflow(page);
  expect(problems).toEqual([]);
});

test('with permission: recon, real CSP and sandbox refusals, shell, attack & defend, then revoke', async ({ page }) => {
  const problems = await guard(page);
  await page.goto('/security-lab/');
  const before = await page.evaluate(() => [Object.keys(localStorage).length, Object.keys(sessionStorage).length]);
  await page.getByLabel(/I understand/).check();
  await page.getByRole('button', { name: 'Grant permission' }).click();
  const lab = page.locator('.br-lab');

  // A. recon: real values, nothing stored
  await lab.getByRole('button', { name: 'Run recon' }).click();
  await expect(lab.locator('.br-recon')).toContainText('Time zone');
  await expect(lab.locator('.br-recon')).toContainText('Secure context');
  expect(await page.evaluate(() => [Object.keys(localStorage).length, Object.keys(sessionStorage).length])).toEqual(before);

  // B. network timings of this page only
  await lab.getByRole('tab', { name: /Network detective/ }).click();
  await lab.getByRole('button', { name: 'Read timings' }).click();
  await expect(lab.locator('.br-wf li').first()).toBeVisible();

  // C. boundaries: the browser refuses every injection; the sandboxed frame is a stranger
  await lab.getByRole('tab', { name: /Security boundaries/ }).click();
  await lab.getByRole('button', { name: 'Try to inject' }).click();
  const csp = lab.locator('.br-probes').first();
  await expect(csp.locator('li')).toHaveCount(4);
  await expect(csp.locator('li.bad')).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { __breach?: number }).__breach)).toBeUndefined();
  await lab.getByRole('button', { name: 'Open sandboxed frame' }).click();
  const sb = lab.locator('.br-probes').nth(1);
  await expect(sb).toContainText('Read the parent page');
  await expect(sb.locator('li.bad')).toHaveCount(0);
  await expect(sb.locator('li', { hasText: 'My origin' })).toContainText('null');
  await lab.getByRole('button', { name: 'Read states' }).click();
  await expect(lab.locator('.br-perms li').first()).toBeVisible();

  // D. fictional shell
  await lab.getByRole('tab', { name: /Command sandbox/ }).click();
  const cmd = lab.getByLabel(/intern@breachlab/);
  for (const c of ['chmod 600 /opt/backup/db-backup.sql', 'chmod u-s /usr/local/bin/report-tool', 'sshd-harden', 'audit']) { await cmd.fill(c); await cmd.press('Enter'); }
  await expect(lab.locator('.br-term-log')).toContainText('All findings fixed.');

  // E. attack & defend
  await lab.getByRole('tab', { name: /Attack & defend/ }).click();
  await lab.getByRole('button', { name: 'Exploit: log in' }).click();
  await expect(lab.locator('.br-result').first()).toContainText('Logged in as ada without a password');
  await lab.getByRole('button', { name: 'Defend: use parameters' }).click();
  await lab.getByRole('button', { name: /Validate: run 4 attack tests/ }).click();
  await expect(lab.locator('.br-probes li.ok')).toHaveCount(4);
  await lab.getByRole('button', { name: 'Exploit: search' }).click();
  await expect(lab.locator('.br-result').last()).toContainText('entered the page');
  await expect(lab.locator('.br-result').last()).toContainText('CSP refused to run it');
  expect(await page.evaluate(() => (window as Window & { __pwned?: number }).__pwned)).toBeUndefined();
  await lab.getByRole('button', { name: 'Defend: escape output' }).click();
  await lab.getByRole('button', { name: /Validate: run 5 payloads/ }).click();
  await expect(lab.locator('.br-probes li', { hasText: 'Neutralised' })).toHaveCount(5);
  await lab.getByRole('button', { name: 'Revoke permission' }).click();
  await expect(page.getByRole('button', { name: 'Grant permission' })).toBeDisabled();

  expect(problems.filter((p) => !EXPECTED.test(p))).toEqual([]);
});
