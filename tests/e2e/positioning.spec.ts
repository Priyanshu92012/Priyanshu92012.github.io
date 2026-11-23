// Professional positioning: a readable hero name at every width, the introduction, the skills &
// languages section and the recruiter résumé (structure and print).
import { test, expect, type Page } from '@playwright/test';
import { guard, noHorizontalOverflow } from './helpers';

/** Name text box vs. the portrait's head (the head starts 31% into the square portrait, its top at 2.4%). */
async function heroGeometry(page: Page) {
  return page.evaluate(() => {
    const n = document.querySelector('[data-hero-name]')!;
    const rg = document.createRange(); rg.selectNodeContents(n); const t = rg.getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(n).fontSize);
    const f = document.querySelector('.hero-portrait')!.getBoundingClientRect();
    return { fs, overlapX: t.right - (f.left + 0.31 * f.width), overlapY: t.bottom - (f.top + 0.024 * f.height), stacked: f.top > t.top + 0.5 * t.height && f.left < t.left + 0.3 * t.width };
  });
}

test('hero: the portrait never hides the name (regression: “shu” ran behind the face on wide screens)', async ({ page }) => {
  await guard(page);
  for (const [w, h] of [[1100, 800], [1440, 900], [1512, 982], [1728, 1117], [1920, 1080], [2560, 1440], [820, 1180], [390, 844], [320, 640]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/?3d=0');
    await page.evaluate(() => document.fonts.ready);
    const g = await heroGeometry(page);
    if (w > 900) expect(g.overlapX, `${w}×${h}: hair may touch only the last letter`).toBeLessThanOrEqual(0.12 * g.fs);
    else expect(g.overlapY, `${w}×${h}: hair may tuck only under the baseline`).toBeLessThanOrEqual(0.42 * g.fs);
    await noHorizontalOverflow(page);
  }
  await expect(page.locator('.hero-headline > *')).toHaveText(['Building intelligent,', 'secure systems.']);
  await expect(page.locator('.hero-role')).toHaveText('Software Engineering · Cybersecurity · AI & Machine Learning');
});

test('introduction: role, study, focus tags, education line and signature', async ({ page }) => {
  await guard(page);
  await page.goto('/?3d=0');
  const intro = page.locator('.intro-sec');
  await expect(intro.locator('.intro-lede')).toContainText('software engineer and dual Computer Science student');
  await expect(intro).toContainText('At Nokia');
  await expect(intro.locator('.intro-lede')).toContainText('DHBW Stuttgart');
  await expect(intro.locator('.intro-tags li')).toHaveText(['Software engineering', 'Cybersecurity', 'AI & machine learning']);
  await expect(intro.locator('.intro-areas')).toContainText('Agentic AI');
  await expect(intro).toContainText('Duales Studium Informatik — DHBW Stuttgart');
  await expect(intro).toContainText('Technical focus: cybersecurity and AI/ML');
  await expect(page.locator('main')).not.toContainText(/applied AI/i);
  await expect(intro.locator('.intro-sig b')).toHaveText('Builder');
});

test('skills & languages: the evidence-backed taxonomy, constellation kept, languages with levels', async ({ page }) => {
  await guard(page);
  await page.goto('/?3d=0');
  const sec = page.locator('#skills');
  await expect(sec.getByRole('heading', { level: 2 })).toHaveText('Skills, each tied to the work behind it.');
  await expect(sec.locator('.tx-title')).toHaveText(['Languages', 'Frontend', 'Backend', 'Cloud & infrastructure', 'Data & AI/ML', 'Agentic AI & developer tools', 'Testing & cybersecurity', 'Systems & automation', 'A skill is a claim. The constellation shows the proof.']);
  const tags = sec.locator('.tx-tag');
  expect(await tags.count()).toBeGreaterThan(40);
  for (const t of await tags.all()) await expect(t).toHaveAttribute('href', /^\/skills\/#skill-[a-z0-9-]+$/);
  await expect(sec.locator('.tx-tag.is-exploring')).toHaveText([/Retrieval-augmented answers \(RAG\)/, /Multi-agent systems/]);
  await expect(sec).not.toContainText(/Grafana|Prometheus|TensorFlow|Azure|Gemini/);
  await expect(sec.locator('.sk-langs li')).toHaveText([/Hindi · Native/, /German · Full professional proficiency, used in university studies and professional work/, /English · Fluent \(C1\)/]);
  await expect(sec.locator('svg.cmini')).toBeVisible();
  await expect(sec.getByRole('link', { name: /Explore the constellation/ })).toHaveAttribute('href', '/skills/');
  // every tag lands on an evidence row on /skills/
  const href = await tags.first().getAttribute('href');
  await page.goto(href!);
  await expect(page.locator(`[id="${href!.split('#')[1]}"]`)).toBeAttached();
});

for (const route of ['/recruiter/', '/resume/']) {
  test(`${route}: a scannable résumé in recruiter order, print-ready`, async ({ page }) => {
    const problems = await guard(page);
    await page.goto(route);
    const cv = page.locator('.cv');
    await expect(page.locator('h1')).toHaveText('Priyanshu');
    await expect(cv.locator('.cv-title')).toHaveText('Software Engineer | Cybersecurity · AI & Machine Learning');
    await expect(cv.locator('.cv-langs li')).toHaveCount(3);
    await expect(cv.locator('.cv-langs')).toContainText('German · Full professional proficiency');
    await expect(cv.locator('.cv-sec > h2')).toHaveText(['Summary', 'Experience', 'Selected projects', 'Skills', 'Education', 'Languages']);
    await expect(cv.locator('.cv-summary p')).toHaveCount(3);
    await expect(cv.locator('.cv-bullets li')).toHaveCount(3);
    await expect(cv.locator('.cv-project')).toHaveCount(4);
    await expect(cv.locator('.cv-contact a[href^="mailto:"]')).toBeVisible();
    await expect(cv).toContainText('Duales Studium Informatik');
    await expect(cv).not.toContainText(/B\.?Sc|Bachelor/);
    await expect(cv.locator('.basis')).toHaveCount(0); // no outcome claims on the résumé
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.site-header')).toBeHidden();
    await expect(page.locator('.no-print').first()).toBeHidden();
    await expect(cv).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)');
    expect(problems).toEqual([]);
  });
}
