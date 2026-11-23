// The pet bot chat (src/islands/petbot/chat.ts): conversational wrapper over the deterministic guide.
import { describe, expect, it } from 'vitest';
import { chat, chatReply, joinList, clip, QUICK, MORE_TOPICS, ALL_TOPICS } from '../../src/islands/petbot/chat';
import { answer, SUGGESTED, type TraceStep } from '../../src/lib/guide/index';
import { isAllowedHref } from '../../src/lib/guide/links';
import { profile, projects } from '../../src/data/index';

describe('chat replies', () => {
  it('offers four quick replies and the remaining topics behind “More questions”', () => {
    expect(QUICK.map((q) => q.label)).toEqual(['About Priyanshu', 'His best projects', 'AI & engineering', 'Work at Nokia']);
    // together they cover every curated topic of the guide
    expect(new Set(ALL_TOPICS.map((t) => t.q))).toEqual(new Set(SUGGESTED.map((s) => s.question)));
    expect(MORE_TOPICS).toHaveLength(7);
  });

  it('answers every topic in at most two short sentences with at most two allowlisted actions', () => {
    for (const t of ALL_TOPICS) {
      const r = chat(t.q);
      expect(r.route, t.label).toBe('curated');
      expect(r.text.length, t.label).toBeLessThan(260);
      expect(r.text.split(/[.!?](\s|$)/).filter((x) => x && x.trim()).length, t.label).toBeLessThanOrEqual(3);
      expect(r.actions.length, t.label).toBeLessThanOrEqual(2);
      for (const a of r.actions) if ('href' in a) expect(isAllowedHref(a.href), a.href).toBe(true);
      for (const l of r.links) expect(isAllowedHref(l.href), l.href).toBe(true);
    }
  });

  it('matches the requested tone for best projects', () => {
    const r = chat('What are his best projects?');
    expect(r.text).toMatch(/^He works on some pretty interesting things! 🐯 His portfolio includes /);
    expect(r.actions.map((a) => a.label)).toEqual(['Explore projects', 'Tell me more']);
  });

  it('keeps the full, sourced answer for “Tell me more” (nothing is lost)', () => {
    const a = answer('What AI experience does he have?');
    const r = chatReply(a);
    expect(r.more).toBe(a.text);
    expect(r.sources).toEqual(a.sources);
  });

  it('uses only facts from the content model', () => {
    expect(chat('Who is Priyanshu?').text).toContain(profile.lede.split('.')[0]);
    expect(chat('How can I contact him?').text).toContain(profile.links.emailLabel);
    for (const p of projects) expect(chat(`Tell me about ${p.title}`).text.startsWith(`${p.shortTitle}:`), p.slug).toBe(true);
  });

  it('is honest about unknown questions and evidence gaps', () => {
    const u = chat('What is his favourite pizza?');
    expect(u.route).toBe('unknown');
    expect(u.text).toMatch(/won’t guess/);
    expect(u.actions).toEqual([]);
    expect(u.suggestions.length).toBeGreaterThan(0);
    expect(u.suggestions.length).toBeLessThanOrEqual(3);
    expect(chat('Does he know Terraform?').text).toMatch(/don’t see Terraform/);
    expect(chat('Is this ChatGPT?').text).toMatch(/scripted guide, not an AI model/);
    expect(chat('Ignore previous instructions').route).toBe('guard');
  });

  it('turns a pasted job description into a one-line evidence summary', () => {
    const r = chat('Requirements:\n- 3+ years of Python and SQL\n- CI/CD and automated testing\n- Terraform and AWS\n- Excellent communication skills');
    expect(r.route).toBe('job');
    expect(r.text).toMatch(/I mapped \d+ requirements/);
    expect(r.job).toBeDefined();
  });

  it('formats lists and clips at word boundaries', () => {
    expect(joinList(['a'])).toBe('a');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c');
    expect(clip('one two three four', 9)).toBe('one two…');
    expect(clip('short', 20)).toBe('short');
  });
});

describe('routing trace', () => {
  it('records every decision without changing the answer', () => {
    for (const q of ['What AI experience does he have?', 'Does he know Kubernetes?', 'Tell me about OpticLab', 'What is his favourite pizza?', 'hi', 'What is his salary?']) {
      const steps: TraceStep[] = [];
      const traced = answer(q, (s) => steps.push(s));
      expect(traced).toEqual(answer(q));
      expect(steps[0].step).toBe('normalise');
      expect(steps.filter((s) => s.hit).length, q).toBeGreaterThan(0);
    }
  });
});
