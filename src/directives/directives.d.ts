// Type for the custom client:afterpaint directive (registered in astro.config.mjs).
declare module 'astro' {
  interface AstroClientDirectives {
    'client:afterpaint'?: boolean;
  }
}
export {};
