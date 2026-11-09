// Server-side public-site settings. Never derive canonical URLs from request headers.
export function getSiteConfig(env = process.env) {
  let origin = null;
  if (env.CODERANK_PUBLIC_URL) {
    const url = new URL(env.CODERANK_PUBLIC_URL);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('CODERANK_PUBLIC_URL must be an HTTP(S) origin without credentials, path, query or fragment');
    }
    origin = url.origin;
  }
  const supportEmail = (env.CODERANK_SUPPORT_EMAIL || '').trim();
  if (supportEmail && !/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(supportEmail)) {
    throw new Error('CODERANK_SUPPORT_EMAIL must be a valid public support email');
  }
  let supportUrl = null;
  if (env.CODERANK_SUPPORT_URL) {
    const url = new URL(env.CODERANK_SUPPORT_URL);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('CODERANK_SUPPORT_URL must be an HTTP(S) help page without credentials');
    }
    supportUrl = url.href;
  }
  const indexable = Boolean(origin && env.CODERANK_ALLOW_INDEXING === 'true' && (!env.VERCEL_ENV || env.VERCEL_ENV === 'production'));
  return { origin, indexable, supportEmail, supportUrl };
}

export const publicPaths = ['/', '/practice', '/privacy', '/terms', '/contact'];
export const privateRobots = { index: false, follow: false };

export function pageMetadata(title, description, pathname = null, isPublic = false) {
  const { origin, indexable } = getSiteConfig();
  const url = origin && pathname ? new URL(pathname, origin).href : null;
  return {
    title, description,
    robots: isPublic && indexable ? { index: true, follow: true } : privateRobots,
    ...(url && isPublic ? { alternates: { canonical: url } } : {}),
    openGraph: { title, description, type: 'website', siteName: 'CodeRank', ...(url && isPublic ? { url } : {}) },
  };
}
