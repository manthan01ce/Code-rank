import Link from 'next/link';
import PublicPage from '@/components/layout/PublicPage';
import { pageMetadata } from '@/lib/site-config';

export const metadata = pageMetadata('Usage guidelines | CodeRank', 'Account security, academic integrity and responsible use of the CodeRank coding workspace.', '/terms', true);

export default function TermsPage() {
  return <PublicPage title="Usage guidelines" intro="Use CodeRank responsibly and follow the assessment rules set by your institution.">
    <section><h2>Accounts and access</h2><p>Use the account assigned to you. Keep credentials private, sign out on shared devices and report suspected unauthorized access to your institution. Do not access another person’s account or attempt to bypass role restrictions.</p></section>
    <section><h2>Academic integrity</h2><p>Follow your faculty’s instructions about collaboration, external resources and AI assistance. Submit work you are authorized to submit. Course rules determine assessment deadlines, grading, permitted assistance and review procedures.</p></section>
    <section><h2>Responsible code execution</h2><p>Use the coding environment for assigned learning and practice. Do not attempt to escape execution restrictions, probe other systems, disrupt the service or access data you are not authorized to use. Do not put passwords, access tokens or unrelated personal information in code or test inputs.</p></section>
    <section><h2>Results and support</h2><p>Check the result and status of your submission. Report unexpected errors or disputed grades to your faculty with the practical name and relevant details. Your institution manages account access and academic decisions.</p><p>These platform guidelines complement your institution’s policies. Ask your department for its applicable assessment, privacy and acceptable-use rules.</p><p><Link href="/contact">Get help with your account or practical →</Link></p></section>
  </PublicPage>;
}
