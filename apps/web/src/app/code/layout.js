import { pageMetadata } from '@/lib/site-config';

export const metadata = pageMetadata('Coding workspace | CodeRank', 'Your institutional CodeRank workspace.');

export default function CodeLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#1e1e1e] font-sans">
      {children}
    </div>
  );
}
