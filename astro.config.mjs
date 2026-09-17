// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// Update `site` with your GitHub Pages URL before deploying:
//   - If repo is username.github.io      → https://username.github.io
//   - If repo is career-site             → https://username.github.io/career-site
// Update `base` only if deploying to a sub-path (e.g. base: '/career-site')
export default defineConfig({
  site: 'https://yourusername.github.io',
  vite: {
    plugins: [tailwindcss()]
  },
  integrations: [mdx(), sitemap()]
});
