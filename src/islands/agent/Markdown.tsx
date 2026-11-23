// Minimal, safe Markdown renderer for guide answers: paragraphs, bullets, **bold**,
// _italic_, `code`, and [links] only to known site paths. No HTML injection.
import { Fragment, type ReactNode } from 'react';
import { isAllowedHref } from '../../lib/guide/links';

const safeHref = (href: string): string | null => (isAllowedHref(href) ? href : null);

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${key}-${i++}`;
    if (tok.startsWith('**')) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('`')) out.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith('_')) out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    else {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
      const href = safeHref(lm[2]);
      out.push(href ? <a key={k} href={href}>{lm[1]}</a> : <Fragment key={k}>{lm[1]}</Fragment>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BULLET = /^\s*[-*•]\s+/;

/** Paragraph lines and bullet lines can share a block ("Lead-in:\n- a\n- b"): group consecutive runs. */
export default function Markdown({ text }: { text: string }) {
  const out: ReactNode[] = [];
  text.split(/\n{2,}/).forEach((block, bi) => {
    const runs: { list: boolean; lines: string[] }[] = [];
    for (const line of block.split('\n')) {
      if (!line.trim()) continue;
      const list = BULLET.test(line);
      const last = runs[runs.length - 1];
      if (last && last.list === list) last.lines.push(line); else runs.push({ list, lines: [line] });
    }
    runs.forEach((r, ri) => {
      const k = `${bi}-${ri}`;
      out.push(r.list
        ? <ul key={k}>{r.lines.map((l, li) => <li key={li}>{inline(l.replace(BULLET, ''), `${k}-${li}`)}</li>)}</ul>
        : <p key={k}>{r.lines.map((l, li) => <Fragment key={li}>{li > 0 && <br />}{inline(l, `${k}-${li}`)}</Fragment>)}</p>);
    });
  });
  return <>{out}</>;
}
