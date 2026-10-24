import WorkspaceClientWrapper from './WorkspaceClientWrapper';
import { STATIC_PROBLEMS } from '@/lib/problems';

// Tokens live in browser storage. Never serialize practical records into an
// unauthenticated server-component response or into public page metadata.
export const metadata = { title: 'Student Coding Workspace — CodeRank' };
export default async function StudentCodingPage({ params }) {
  const { id } = await params;
  if (/^(?:practical_)?\d+$/.test(id)) {
    return <WorkspaceClientWrapper practicalId={id.replace('practical_','')} />;
  }
  const problem = (Object.hasOwn(STATIC_PROBLEMS,id) ? STATIC_PROBLEMS[id] : null)
    || Object.values(STATIC_PROBLEMS).find(problem => problem.slug === id) || null;
  return <WorkspaceClientWrapper problem={problem} />;
}
