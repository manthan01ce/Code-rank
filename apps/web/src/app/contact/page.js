import PublicPage from '@/components/layout/PublicPage';
import { getSiteConfig, pageMetadata } from '@/lib/site-config';

export const metadata = pageMetadata('Contact & support | CodeRank', 'Get help with CodeRank accounts, practicals, assessment results and privacy questions.', '/contact', true);

export default function ContactPage() {
  const { supportEmail, supportUrl } = getSiteConfig();
  return <PublicPage title="Contact & support" intro="Your institution is the first point of contact for your CodeRank account and assessments.">
    <section><h2>Institutional support</h2>
      {supportEmail && <p>Email: <a href={`mailto:${supportEmail}`}>{supportEmail}</a></p>}
      {supportUrl && <p><a href={supportUrl}>Open your institution’s support page →</a></p>}
      {!supportEmail && !supportUrl && <p>Contact your assigned faculty member or department administrator through your institution’s usual communication channel. They can help you find the appropriate support contact.</p>}
    </section>
    <section><h2>Account and practical help</h2><p>For sign-in or account access, contact your department administrator. For assignments, deadlines, submission results or grades, contact the faculty member responsible for the course.</p><p>Include your username, course, practical name, time of the issue and the visible error message. Never send your password, sign-in token or other credentials.</p></section>
    <section><h2>Privacy and security questions</h2><p>Ask your department administrator to direct privacy requests or security concerns to the responsible institutional team. Report security concerns privately, and avoid sharing student records or sensitive screenshots in public channels.</p></section>
  </PublicPage>;
}
