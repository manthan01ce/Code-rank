import Link from 'next/link';
import PublicPage from '@/components/layout/PublicPage';

export default function NotFound() {
  return <PublicPage title="Page not found" intro="404 — This address does not lead to a CodeRank page.">
    <section><h2>Let’s get you back on track</h2><p>The link may be incorrect or the page may have moved. Check the address or choose where to go next.</p><p><Link href="/">Back to home</Link> · <Link href="/login">Sign in to your workspace</Link> · <Link href="/contact">Get help</Link></p></section>
  </PublicPage>;
}
