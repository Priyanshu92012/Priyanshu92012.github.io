// @ts-check
// V3 DESIGN LAB · local only. Same site as astro.config.mjs plus the injected /design-lab/ routes,
// built into .lab/site (git-ignored). The production config never sees these routes, so
// `npm run build` / dist/ / the sitemap are unchanged.
//   npm run lab        build + serve on http://localhost:4330/design-lab/
//   npm run lab:dev    dev server with hot reload on :4330
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import base, { afterPaintDirective } from './astro.config.mjs';

/** @returns {import('astro').AstroIntegration} */
function designLab() {
  return {
    name: 'pexe-design-lab',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        const pages = { '/design-lab': 'index', '/design-lab/monolith': 'monolith', '/design-lab/orbit': 'orbit', '/design-lab/signal': 'signal' };
        for (const [pattern, file] of Object.entries(pages)) {
          injectRoute({ pattern, entrypoint: `./src/design-lab/pages/${file}.astro`, prerender: true });
        }
      },
    },
  };
}

export default defineConfig({
  ...base,
  outDir: './.lab/site',
  // no sitemap: nothing here is meant to be indexed (every lab page is also noindex)
  integrations: [afterPaintDirective(), react(), mdx(), designLab()],
  server: { port: 4330, host: '127.0.0.1' },
  preview: { port: 4330, host: '127.0.0.1' },
});
