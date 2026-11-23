// The portfolio guide, as the pet bot's chat: short replies, at most two actions, details on request,
// a discreet job matcher, honest fallbacks, allowlisted navigation, keyboard and small screens.
import { test, expect, type Page } from '@playwright/test';
import { guard, ready, noHorizontalOverflow } from './helpers';

const TOPICS: [string, string][] = [
  ['Who is Priyanshu?', 'who'], ['What does he do at Nokia?', 'nokia'], ['What are his best projects?', 'best'],
  ['What AI experience does he have?', 'ai'], ['What cybersecurity work has he done?', 'security'], ['What technologies does he use?', 'tech'],
  ['Tell me about his education.', 'education'], ['What makes his engineering work interesting?', 'interesting'], ['How can I contact him?', 'contact'],
];
const ALLOWED = /^(\/(work|skills|lab|xray|about|recruiter|resume)?\/?|mailto:priyanshu240105@gmail\.com|https:\/\/(github\.com\/Priyanshu92012|www\.linkedin\.com\/in\/priyanshu-priyanshu-\/))/;
const chat = (page: Page) => page.getByRole('dialog', { name: 'Priyanshu’s pet bot' });
const lastBot = (page: Page) => chat(page).locator('.ck-row.bot').last();

async function open(page: Page, path = '/about/', { bare = false } = {}) {
  await page.goto(path);
  await ready(page);
  await page.getByRole('button', { name: /pet bot: ask about his work/ }).click(); // the tiger opens the guide (no header button any more)
  await expect(chat(page)).toBeVisible();
  if (!bare) await topics(page);
}
async function topics(page: Page) {
  await chat(page).getByRole('button', { name: 'Ask me something' }).click();
}
async function say(page: Page, text: string) {
  const input = chat(page).getByLabel('Message Priyanshu’s pet bot');
  await input.fill(text);
  await input.press('Enter');
}

test('opens as a small chat: the greeting and two options, topics on request', async ({ page }) => {
  const problems = await guard(page);
  await open(page, '/about/', { bare: true });
  const c = chat(page);
  await expect(c).toContainText('Hey there! 🐯 I’m Priyanshu’s pet bot. Want to explore his work?');
  await expect(c).toContainText('Scripted · works offline');
  await expect(c.getByRole('link', { name: 'Explore projects' })).toHaveAttribute('href', '/work/');
  await expect(c.locator('.ck-quick .ck-chip')).toHaveCount(2);
  await topics(page);
  for (const q of ['About Priyanshu', 'His best projects', 'AI & engineering', 'Work at Nokia']) await expect(c.getByRole('button', { name: q })).toBeVisible();
  await expect(c.getByRole('button', { name: 'Security work' })).toHaveCount(0);
  await expect(c.getByLabel('Message Priyanshu’s pet bot')).toBeFocused();
  await c.getByRole('button', { name: 'More questions' }).click();
  for (const q of ['Security work', 'Tech stack', 'Education', 'How he works', 'Contact', 'BREACH MODE', 'AI Systems Lab', 'Match a job description']) await expect(c.getByRole('button', { name: q })).toBeVisible();
  const box = await c.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(380);
  await expect(c).not.toContainText(/language model is|live model|streaming/i);
  expect(problems).toEqual([]);
});

test('every topic gets a short reply with at most two allowlisted actions', async ({ page }) => {
  const problems = await guard(page);
  await open(page);
  await chat(page).getByRole('button', { name: 'His best projects' }).click();
  await expect(lastBot(page)).toContainText('He works on some pretty interesting things!');
  for (const [q, intent] of TOPICS) {
    await say(page, q);
    const b = lastBot(page);
    await expect(b.locator('.ck-bubble')).toHaveAttribute('data-intent', intent);
    expect((await b.locator('.ck-bubble > p').first().innerText()).length, q).toBeLessThan(260);
    const acts = b.locator('.ck-acts > *');
    expect(await acts.count(), q).toBeLessThanOrEqual(2);
    for (const h of await b.locator('a.ck-act').evaluateAll((els) => els.map((e) => e.getAttribute('href')!))) expect(h, q).toMatch(ALLOWED);
  }
  expect(problems).toEqual([]);
});

test('“Tell me more” expands on request, with sources behind a discreet disclosure', async ({ page }) => {
  await guard(page);
  await open(page);
  await chat(page).getByRole('button', { name: 'AI & engineering' }).click();
  await lastBot(page).getByRole('button', { name: 'Tell me more' }).click();
  const more = lastBot(page);
  await expect(more).toContainText('FinBERT');
  await expect(more.locator('details.ck-src summary', { hasText: 'Sources' })).toBeVisible();
  await expect(more.locator('details.ck-src[open]')).toHaveCount(0);
  await expect(chat(page).locator('.ck-row.me').last()).toContainText('Tell me more');
});

test('typed questions match synonyms; unknown questions get an honest fallback', async ({ page }) => {
  await guard(page);
  await open(page);
  await say(page, 'Where does he work?');
  await expect(lastBot(page)).toContainText('Nokia');
  await say(page, 'any infosec background?');
  await expect(lastBot(page)).toContainText('SecureMed');
  await say(page, 'What is his favourite pizza?');
  const a = lastBot(page);
  await expect(a).toContainText('I won’t guess');
  await expect(a.locator('.ck-acts')).toHaveCount(0);
  await a.getByRole('button', { name: 'About Priyanshu' }).click();
  await expect(lastBot(page)).toContainText('Software engineer and dual Computer Science student');
});

test('actions navigate only to allowlisted pages', async ({ page }) => {
  await guard(page);
  await open(page);
  await chat(page).getByRole('button', { name: 'Work at Nokia' }).click();
  await lastBot(page).getByRole('link', { name: /Explore this project/ }).click();
  await page.waitForURL('**/work/test-resource-scheduler/');
  await ready(page);
  await page.keyboard.press('/');
  await say(page, 'recruiter mode');
  await lastBot(page).getByRole('link', { name: /Open recruiter mode/ }).click();
  await page.waitForURL('**/recruiter/');
});

test('job matcher is a discreet secondary option and runs locally', async ({ page }) => {
  await guard(page);
  await open(page, '/');
  const c = chat(page);
  await c.getByRole('button', { name: 'More questions' }).click();
  await c.getByRole('button', { name: 'Match a job description' }).click();
  await c.getByLabel('Job description').fill('Requirements:\n- 3+ years of Python and SQL\n- Experience with CI/CD and automated testing\n- Terraform and AWS\n- Excellent communication skills');
  await c.getByRole('button', { name: 'Map evidence' }).click();
  const a = lastBot(page);
  await expect(a).toContainText(/with strong evidence/);
  await expect(a).toContainText(/not a score/);
  await a.getByText('Show the evidence map').click();
  await expect(a.locator('.ag-artifact')).toBeVisible();
});

test('keyboard: / opens, Escape closes and restores focus, focus is never trapped', async ({ page }) => {
  await guard(page);
  await page.goto('/work/');
  await ready(page);
  const trigger = page.getByRole('button', { name: /pet bot: ask about his work/ });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const input = chat(page).getByLabel('Message Priyanshu’s pet bot');
  await expect(input).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(chat(page)).toBeHidden();
  await page.keyboard.press('/');
  await expect(input).toBeFocused();
  await page.keyboard.type('How can I contact him?');
  await page.keyboard.press('Enter');
  await expect(lastBot(page)).toContainText('priyanshu240105@gmail.com');
  // non-modal: Shift+Tab from the first control in the chat leaves it
  await chat(page).getByRole('button', { name: 'Clear' }).focus();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !document.activeElement?.closest('.ck'))).toBe(true);
});

for (const width of [390, 320]) {
  test(`mobile ${width}px: the chat fits the screen and stays usable`, async ({ page }) => {
    await guard(page);
    await page.setViewportSize({ width, height: 700 });
    await open(page, '/');
    const box = await chat(page).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await chat(page).getByRole('button', { name: 'His best projects' }).click();
    await expect(lastBot(page)).toContainText('pretty interesting');
    const overflow = await page.evaluate(() => [...document.querySelectorAll('.ck *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length);
    expect(overflow).toBe(0);
    await expect(chat(page).getByLabel('Message Priyanshu’s pet bot')).toBeInViewport();
    await noHorizontalOverflow(page);
  });
}

test('?ask= opens the chat with an answer', async ({ page }) => {
  await guard(page);
  await page.goto(`/?ask=${encodeURIComponent('Tell me about his education.')}`);
  await expect(lastBot(page)).toContainText('DHBW Stuttgart');
});

test('terminal: local commands and freeform questions, all offline', async ({ page }) => {
  const problems = await guard(page);
  await page.goto('/about/');
  await ready(page);
  await page.keyboard.press('`');
  const term = page.getByRole('dialog', { name: 'Terminal' });
  const input = term.locator('input').first();
  await input.fill('ls security'); await input.press('Enter');
  await expect(term).toContainText('SecureMed');
  await input.fill('what does he do at nokia?'); await input.press('Enter');
  await expect(term).toContainText('Software Engineer (dual study)');
  await input.fill('ask how can I contact him'); await input.press('Enter');
  await expect(term).toContainText('priyanshu240105@gmail.com');
  await input.fill('policy'); await input.press('Enter');
  await expect(term).toContainText('not a language model');
  await input.fill('cd skills'); await input.press('Enter');
  await page.waitForURL('**/skills/');
  expect(problems).toEqual([]);
});

test('retired legacy pages are noindex redirect stubs with no archived content', async ({ page }) => {
  for (const [url, dest] of [['/v1/', '/'], ['/gmre_architecture_v3.html', '/work/gmre-log-parser/']] as const) {
    const res = await page.request.get(url);
    expect(res.status(), url).toBe(200);
    const html = await res.text();
    expect(html, url).toContain('<meta name="robots" content="noindex">');
    expect(html, url).toContain(`url=${dest}`);
    expect(html.length, url).toBeLessThan(1500);           // a stub, not an archive
    expect(html, url).not.toMatch(/<script|terminal|migrations|plugins/i);
  }
  await page.goto('/v1/');
  await page.waitForURL('**/');
  await expect(page.locator('h1')).toHaveCount(1);
});
