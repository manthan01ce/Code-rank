import { notFound } from 'next/navigation';
import WorkspaceClientWrapper from './WorkspaceClientWrapper';
import { STATIC_PROBLEMS } from '@/lib/problems';

// ── SEO metadata ──────────────────────────────────────────────────────────────
export async function generateMetadata({ params }) {
  const { id } = await params;
  
  // Find problem by ID directly or by slug alias
  let problem = STATIC_PROBLEMS[id];
  if (!problem) {
    problem = Object.values(STATIC_PROBLEMS).find(p => p.slug === id);
  }

  if (!problem) {
    return { title: 'Problem Not Found — CodeRank' };
  }

  return {
    title:       `${problem.title} — CodeRank`,
    description: `Solve ${problem.title} on the CodeRank student coding platform.`,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function StudentCodingPage({ params }) {
  const { id } = await params;

  // Find problem by ID directly or by slug alias
  let problem = STATIC_PROBLEMS[id];
  if (!problem) {
    problem = Object.values(STATIC_PROBLEMS).find(p => p.slug === id);
  }

  // Triggers the nearest not-found.js in this route segment.
  if (!problem) notFound();

  return <WorkspaceClientWrapper problem={problem} />;
}
