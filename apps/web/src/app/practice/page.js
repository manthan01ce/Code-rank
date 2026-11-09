import { pageMetadata } from '@/lib/site-config';
// Server Component — allowed to export metadata here.
// The dynamic import with ssr:false lives in PracticeClientLoader.js (a Client Component).
import PracticeClientLoader from './PracticeClientLoader';

export const metadata = pageMetadata('Python Practice | CodeRank', 'Practice Python in the CodeRank coding workspace.', '/practice', true);

export default function PracticePage() {
  return <PracticeClientLoader />;
}
