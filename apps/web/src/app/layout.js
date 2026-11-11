import './globals.css';
import UsageTracker from '@/components/layout/UsageTracker';
import { getSiteConfig } from '@/lib/site-config';

const { origin, indexable } = getSiteConfig();
export const metadata = {
  ...(origin ? { metadataBase: new URL(origin) } : {}),
  title: 'CodeRank – Rank Up Your Coding',
  description: 'CodeRank connects academic coding practicals, live code execution, faculty assessment and student progress.',
  robots: { index: indexable, follow: indexable },
  openGraph: { title: 'CodeRank – Rank Up Your Coding', description: 'Practice with purpose. Progress with confidence.', type: 'website', siteName: 'CodeRank' },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }) {
  return <html lang="en" suppressHydrationWarning><body suppressHydrationWarning>{children}<UsageTracker/></body></html>;
}
