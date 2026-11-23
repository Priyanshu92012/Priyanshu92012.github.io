// AI Systems Lab: real retrieval with cited extractive answers, validated tool calls, a labelled
// simulation, and an evaluation harness. No model, no network.
import { test, expect } from '@playwright/test';
import { guard, noHorizontalOverflow } from './helpers';

test('RAG explorer retrieves, assembles and answers with citations; evaluation runs live', async ({ page }) => {
  const problems = await guard(page);
  await page.goto('/ai-lab/');
  const lab = page.locator('.ai');
  await lab.scrollIntoViewIfNeeded();
  await lab.getByRole('button', { name: 'How does GMRE skip duplicate archives?' }).click();
  await expect(lab.locator('.ai-hits li.used').first()).toBeVisible();
  await expect(lab.locator('.ai-answer')).toContainText('SHA-256');
  await expect(lab.getByText('every sentence quoted from a source')).toBeVisible();
  for (const href of await lab.locator('.ai-sources a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))) expect(href).toMatch(/^\/work\//);
  await lab.getByRole('button', { name: 'Run evaluation' }).click();
  await expect(lab.locator('.demo-metric', { hasText: 'Recall@5' })).toContainText('100%');
  await expect(page.getByText('extractive', { exact: false }).first()).toBeVisible();
  await noHorizontalOverflow(page);
  expect(problems).toEqual([]);
});

test('tool calling: real contracts validate input; invalid calls never execute', async ({ page }) => {
  const problems = await guard(page);
  await page.goto('/ai-lab/');
  const lab = page.locator('.ai');
  await lab.scrollIntoViewIfNeeded();
  await lab.getByRole('tab', { name: /Tool calling/ }).click();
  await lab.getByRole('button', { name: 'What evidence is there for Python?' }).click();
  const trace = lab.locator('.ai-trace li');
  await expect(trace).toHaveCount(6);
  await expect(trace.nth(1)).toContainText('showSkillEvidence');
  await expect(trace.nth(2)).toContainText('Zod contract');
  await lab.getByRole('button', { name: 'Empty query, bad enum' }).click();
  await lab.getByRole('button', { name: /Validate & run/ }).click();
  await expect(lab.locator('.ai-trace li.bad').first()).toContainText(/query|domain/);
  await expect(lab.locator('.ai-trace')).toContainText('Refused before execution');
  expect(problems).toEqual([]);
});

test('multi-agent is labelled a deterministic simulation; evaluation passes and is reproducible', async ({ page }) => {
  const problems = await guard(page);
  await page.goto('/ai-lab/');
  const lab = page.locator('.ai');
  await lab.scrollIntoViewIfNeeded();
  await lab.getByRole('tab', { name: /Multi-agent/ }).click();
  await expect(lab).toContainText('Deterministic simulation');
  await lab.getByRole('button', { name: 'Start' }).click();
  await lab.getByRole('button', { name: 'Show all' }).click();
  await expect(lab.locator('.ai-msgs li')).toHaveCount(5);
  await expect(lab.locator('.ai-msgs')).toContainText('not a suitability score');
  await lab.getByRole('tab', { name: /Evaluation/ }).click();
  await lab.getByRole('button', { name: 'Run the evaluation' }).click();
  await expect(lab.locator('.demo-metric', { hasText: 'Passed' })).toContainText('18/18');
  await expect(lab.locator('.demo-metric', { hasText: 'Reproducible' })).toContainText('yes');
  await expect(lab).toContainText('$0');
  expect(problems).toEqual([]);
});
