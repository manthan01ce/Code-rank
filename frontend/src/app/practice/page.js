// Server Component — allowed to export metadata here.
// The dynamic import with ssr:false lives in PracticeClientLoader.js (a Client Component).
import PracticeClientLoader from './PracticeClientLoader';

export const metadata = {
  title: 'Python Practice | CodeRank',
  description: 'Practice Python coding with a fully isolated Docker runtime.',
};

export default function PracticePage() {
  return <PracticeClientLoader />;
}
