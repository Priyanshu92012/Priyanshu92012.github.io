import { test, expect } from '@playwright/test';
import { guard } from './helpers';

test('scheduler: step, inject faults, invariants hold, strategies compare', async ({ page }) => {
  const problems = await guard(page);
  await page.goto('/work/test-resource-scheduler/?motion=reduce');
  const lab = page.locator('#demo');
  await lab.scrollIntoViewIfNeeded();
  for (let i = 0; i < 12; i++) await lab.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(lab.locator('.demo-metric').first()).toContainText('12');
  await lab.getByRole('button', { name: 'Crash an agent' }).click();
  await lab.getByRole('button', { name: 'Resource offline' }).click();
  for (let i = 0; i < 10; i++) await lab.getByRole('button', { name: 'Step', exact: true }).click();
  await expect(lab).toContainText('no double booking');
  await expect(lab.locator('.pill.bad')).toHaveCount(0);
  await lab.getByRole('button', { name: /240-tick comparison/ }).click();
  await expect(lab.locator('.sch-cmp tbody tr')).toHaveCount(3);
  expect(problems).toEqual([]);
});

test('securemed: real TOTP login, replay and lockout', async ({ page }) => {
  await guard(page);
  await page.goto('/work/securemed/?motion=reduce');
  const lab = page.locator('#demo');
  await lab.scrollIntoViewIfNeeded();
  await lab.getByRole('button', { name: 'Enrol authenticator' }).click();
  await lab.getByLabel('Password').fill('demo-passphrase');
  await lab.getByRole('button', { name: 'Sign in' }).click();
  await lab.getByRole('button', { name: 'Copy from authenticator' }).click();
  await lab.getByRole('button', { name: 'Verify' }).click();
  await expect(lab).toContainText('Signed in as');
  await expect(lab).toContainText('session rotated');
  await lab.getByRole('button', { name: 'Replay last code' }).click();
  await expect(lab).toContainText('replay rejected');
  await lab.getByRole('tab', { name: /CI\/CD/ }).click();
  await lab.getByRole('button', { name: /Push & run pipeline/ }).click();
  await expect(lab).toContainText(/blocked at Secret scan/);
});

test('gmre: ingest all, re-upload skipped by sha256, corrupt + backfill', async ({ page }) => {
  await guard(page);
  await page.goto('/work/gmre-log-parser/?motion=reduce');
  const lab = page.locator('#demo');
  await lab.scrollIntoViewIfNeeded();
  await lab.getByRole('button', { name: 'Corrupt a member' }).click();
  await lab.getByRole('button', { name: 'Ingest all' }).click();
  await expect(lab).toContainText('skipped · same sha256');
  await expect(lab.locator('.gm-st.FAILED').first()).toBeVisible();
  await lab.getByRole('button', { name: 'Backfill failed plugin' }).click();
  await expect(lab.locator('.gm-st.FAILED')).toHaveCount(0);
});

test('xai: Shapley efficiency holds and masking moves the prediction', async ({ page }) => {
  await guard(page);
  await page.goto('/work/finbert-xai/');
  const lab = page.locator('#demo');
  await lab.scrollIntoViewIfNeeded();
  const tiles = lab.locator('.demo-metric b');
  await expect(tiles.nth(0)).toHaveText(await tiles.nth(1).innerText());
  await lab.getByRole('button', { name: /^beat/ }).click();
  await expect(lab.locator('.xa-pv .warn')).toBeVisible();
  await expect(lab).toContainText('NOT FinBERT');
});

test('only the eight public projects have case pages; six have labs', async ({ page }) => {
  for (const slug of ['basyx-aasx-importer', 'agent-arena', 'ai-incident-copilot', 'midlog-iot', 'schimmelwaechter', 'wearable-balance', 'investment-research', 'optics-controller']) {
    expect((await page.request.get(`/work/${slug}/`)).status(), slug).toBe(404);
  }
  await guard(page);
  await page.goto('/lab/');
  await expect(page.locator('.lab-card')).toHaveCount(6);
  await expect(page.locator('#arena')).toHaveCount(0);
  await page.goto('/work/');
  await expect(page.locator('.index-row')).toHaveCount(8);
  await expect(page.locator('.index-row').nth(6)).toContainText('PRIYANSHU.EXE');
  await expect(page.locator('.index-row').nth(7)).toContainText('Infrastructure Capacity');
  await expect(page.locator('.index-row').nth(7)).toContainText('Planned');
});

test('opticlab: real signatures reject every tampered image; driver, protocol and mTLS behave like the original suite', async ({ page }) => {
  const problems = await guard(page);
  await page.goto('/work/opticlab/#demo');
  const lab = page.locator('.ol');
  await lab.scrollIntoViewIfNeeded();
  for (const [attack, stage] of [['none', null], ['unsigned', 'configuration signature'], ['wrong-key', 'configuration signature'], ['kernel-bit', 'image hashes'], ['entry', 'configuration signature'], ['rootfs-bit', 'dm-verity']] as const) {
    await lab.locator(`input[value="${attack}"]`).check();
    await lab.getByRole('button', { name: /^Boot OLC-4/ }).click();
    const fail = lab.locator('.ol-stage.s-fail');
    if (stage) await expect(fail).toContainText(stage, { timeout: 20_000 });
    else { await expect(lab.locator('.ol-verdict')).toContainText('Booted OLC-4', { timeout: 20_000 }); await expect(fail).toHaveCount(0); }
  }
  await lab.getByRole('tab', { name: 'Driver & slots' }).click();
  await lab.getByLabel(/simulate_slot/).fill('5 fault');
  await lab.getByRole('button', { name: 'Write' }).click();
  await expect(lab.locator('.ol-res')).toContainText('ERANGE');
  await lab.getByLabel(/simulate_slot/).fill('3 fault');
  await lab.getByRole('button', { name: 'Write' }).click();
  await expect(lab.locator('.ol-slot.s-fault')).toHaveCount(1);
  await lab.getByRole('tab', { name: 'Controller API' }).click();
  await lab.getByRole('button', { name: 'GET health' }).click();
  await expect(lab.locator('.ol-rpc')).toContainText('"health":"degraded"');
  await lab.getByRole('button', { name: 'GET secrets' }).click();
  await expect(lab.locator('.ol-rpc')).toContainText('unknown GET target');
  await lab.getByRole('tab', { name: 'mTLS access' }).click();
  await lab.getByLabel(/OU=opticlab-observer/).check();
  await expect(lab.locator('.ol-verdict')).toContainText('not authorised');
  expect(problems).toEqual([]);
});

test('PRIYANSHU.EXE: the intent-routing lab runs the real engine and shows every decision', async ({ page }) => {
  const problems = await guard(page);
  await page.goto('/work/priyanshu-exe/');
  const lab = page.locator('#demo');
  await lab.scrollIntoViewIfNeeded();
  await expect(lab.locator('.ir-steps li').first()).toContainText('normalise');
  await lab.getByRole('button', { name: 'Does he know Kubernetes?' }).click();
  await expect(lab.locator('.ir-out')).toContainText('skill:kubernetes');
  await expect(lab.locator('.ir-steps li.hit').last()).toContainText('skill answer');
  await lab.locator('#ir-q').fill('What is his favourite pizza?');
  await lab.getByRole('button', { name: 'Route it' }).click();
  await expect(lab.locator('.ir-out')).toContainText('unknown');
  await expect(lab.locator('.ir-steps li.hit').last()).toContainText('no guess');
  expect(problems).toEqual([]);
});

test('PRIYANSHU.EXE: architecture, component explorer, honest AI tiers, evidence and roadmap', async ({ page }) => {
  const problems = await guard(page);
  await page.goto('/work/priyanshu-exe/');
  await expect(page.locator('.site-diagram svg')).toBeVisible();
  const cx = page.locator('.cx');
  await cx.scrollIntoViewIfNeeded();
  await cx.getByRole('tab', { name: 'LLM agent Worker' }).click();
  await expect(cx.locator('.cx-panel')).toContainText('Built, disabled');
  await expect(cx.locator('.cx-panel')).toContainText('Not deployed');
  await expect(page.locator('.ai-tier.live')).toContainText('Deterministic intent matching');
  await expect(page.locator('.ai-tier.off')).toContainText('not deployed');
  await expect(page.locator('.site-ev')).toContainText('target 2.5 s, met');
  await expect(page.locator('.site-rm')).toContainText('Not built');
  expect(problems).toEqual([]);
});

test('PRIYANSHU.EXE appears in the constellation, X-Ray and recruiter mode', async ({ page }) => {
  await guard(page);
  await page.goto('/skills/?focus=project:priyanshu-exe');
  await expect(page.getByLabel('Constellation inspector')).toContainText('PRIYANSHU.EXE');
  await page.goto('/xray/');
  await expect(page.locator('a[href="/work/priyanshu-exe/"]').first()).toBeVisible();
  await page.goto('/recruiter/');
  await expect(page.locator('a[href="/work/priyanshu-exe/"]').first()).toBeAttached();
});
