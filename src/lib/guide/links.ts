// The only destinations the portfolio guide may link to. Every answer's links are
// filtered through isAllowedHref() in the engine AND again at render time.
import { profile, projects, skillList, DOMAIN_IDS } from '../../data/index';

const slugs = new Set(projects.map((p) => p.slug));
const skillIds = new Set(skillList.map((s) => s.id));
const PAGES = new Set(['/', '/work/', '/skills/', '/lab/', '/xray/', '/about/', '/recruiter/', '/resume/', '/security-lab/', '/ai-lab/']);
const PAGE_ANCHORS: Record<string, Set<string>> = {
  '/about/': new Set(['contact', 'principles']),
  '/lab/': new Set(['arena']),
  '/xray/': new Set(['guide']),
  '/': new Set(['work']),
};
/** Section anchors every case page renders (src/pages/work/[slug].astro). */
const CASE_ANCHORS = new Set(['demo', 'approach', 'decisions', 'outcomes', 'limits']);
export const EXTERNAL = new Set<string>([profile.links.github, profile.links.linkedin, profile.links.email, profile.links.repo]);

export function isAllowedHref(href: string): boolean {
  if (typeof href !== 'string' || href.length > 200) return false;
  if (EXTERNAL.has(href)) return true;
  // German pages mirror the English ones under /de/ (src/i18n): same allowlist, same anchors.
  if (href === '/de' || href.startsWith('/de/') || href.startsWith('/de#')) href = href.slice(3) || '/';
  if (href.startsWith('#')) return false;
  if (!href.startsWith('/') || href.startsWith('//')) return false;
  const [path, hash, ...rest] = href.split('#');
  if (rest.length) return false;
  const work = path.match(/^\/work\/([a-z0-9-]+)\/$/);
  if (work) return slugs.has(work[1]) && (hash === undefined || CASE_ANCHORS.has(hash));
  if (path === '/skills/' && hash !== undefined) {
    const m = hash.match(/^(skill|domain)-([a-z0-9-]+)$/);
    if (hash === 'evidence-index') return true;
    return !!m && (m[1] === 'skill' ? skillIds.has(m[2]) : (DOMAIN_IDS as readonly string[]).includes(m[2]));
  }
  if (!PAGES.has(path)) return false;
  return hash === undefined || (PAGE_ANCHORS[path]?.has(hash) ?? false);
}

export const isExternal = (href: string) => /^(https?:|mailto:)/.test(href);
