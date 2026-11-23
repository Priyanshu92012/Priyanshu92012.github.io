// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

/** client:afterpaint (src/directives/afterpaint.ts): hydrate after the first painted frame, then on idle. */
/** @returns {import('astro').AstroIntegration} */
export function afterPaintDirective() {
  return {
    name: 'pexe-afterpaint',
    hooks: { 'astro:config:setup': ({ addClientDirective }) => addClientDirective({ name: 'afterpaint', entrypoint: './src/directives/afterpaint.ts' }) },
  };
}

// Root-path GitHub Pages site (user site), so no `base` is needed.
export default defineConfig({
  site: 'https://priyanshu92012.github.io',
  output: 'static',
  trailingSlash: 'ignore',
  // Inline all CSS: removes 3–4 render-blocking requests per page (~12 KB gzipped inline) and fixes mobile LCP.
  build: { format: 'directory', inlineStylesheets: 'always' },
  integrations: [
    afterPaintDirective(),
    react(),
    mdx(),
    // English at /, German at /de/: the sitemap pairs them with hreflang alternates.
    sitemap({ filter: (page) => !page.includes('/og-card') && !page.includes('/security-lab/sandbox'), i18n: { defaultLocale: 'en', locales: { en: 'en', de: 'de' } } }),
  ],
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  vite: {
    build: { chunkSizeWarningLimit: 900 },
  },
});
