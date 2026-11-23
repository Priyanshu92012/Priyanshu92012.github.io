import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from '../../src/islands/agent/Markdown';

const html = (text: string) => renderToStaticMarkup(createElement(Markdown, { text }));

describe('guide markdown renderer', () => {
  it('renders a lead-in line followed by bullets as a paragraph and a list', () => {
    expect(html('Projects:\n- **A**: one\n- B: two\n\nDone.')).toBe('<p>Projects:</p><ul><li><strong>A</strong>: one</li><li>B: two</li></ul><p>Done.</p>');
  });
  it('only renders allowlisted links and never raw HTML', () => {
    const out = html('[ok](/work/securemed/) [bad](https://evil.example/) <img src=x onerror=alert(1)>');
    expect(out).toContain('<a href="/work/securemed/">ok</a>');
    expect(out).not.toContain('evil.example');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
  });
});
