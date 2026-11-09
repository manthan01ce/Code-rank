import { getSiteConfig } from '../lib/site-config.js';

export default function robots() {
  const { origin, indexable } = getSiteConfig();
  if (!indexable) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/faculty', '/student', '/profile/', '/code', '/login', '/signup'] },
    sitemap: `${origin}/sitemap.xml`,
  };
}
