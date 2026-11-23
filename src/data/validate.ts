// Build-time validation of the content model (Zod). Imported by BaseLayout (so every
// `astro build` validates) and by the unit tests. Never imported by browser code.
import { z } from 'zod';
import { DomainSchema, ProjectRecordSchema, SkillSchema } from './schema';
import { projectsRaw } from './projects';
import { domainsRaw, skillsRaw } from './skills';

let done = false;
export function validateContent(): void {
  if (done) return;
  const skills = z.array(SkillSchema).parse(skillsRaw);
  z.array(DomainSchema).parse(domainsRaw);
  const projects = z.array(ProjectRecordSchema).parse(projectsRaw);
  const skillIds = new Set(skills.map((s) => s.id));
  const slugs = new Set<string>();
  for (const p of projects) {
    if (slugs.has(p.slug)) throw new Error(`duplicate project slug: ${p.slug}`);
    slugs.add(p.slug);
    for (const s of p.skills) if (!skillIds.has(s)) throw new Error(`project ${p.slug} references unknown skill "${s}"`);
  }
  if (new Set(skills.map((s) => s.id)).size !== skills.length) throw new Error('duplicate skill id');
  done = true;
}
