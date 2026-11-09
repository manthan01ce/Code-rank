import { getSiteConfig, publicPaths } from '../lib/site-config.js';

export default function sitemap() {
  const { origin, indexable } = getSiteConfig();
  return indexable ? publicPaths.map(path => ({ url: new URL(path, origin).href })) : [];
}
