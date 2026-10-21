/**
 * PURPOSE OF THIS FILE:
 * Server-side entry point for the student coding workspace route (/student/code/[id]).
 * It checks the URL parameters:
 * - If the ID starts with 'practical_', it queries the Neon Postgres database to load
 *   the dynamic practical details, constraints, allowed languages, and parameters.
 * - Otherwise, it defaults to rendering the workspace client wrapper with a placeholder/null state.
 */
import { notFound } from 'next/navigation';
import WorkspaceClientWrapper from './WorkspaceClientWrapper';
import { STATIC_PROBLEMS } from '@/lib/problems';
import sql from '@/lib/db';

// ── SEO metadata ──────────────────────────────────────────────────────────────
export async function generateMetadata({ params }) {
  const { id } = await params;
  
  let problem = null;
  if (id.startsWith('practical_')) {
    const practicalId = parseInt(id.replace('practical_', ''));
    try {
      const res = await sql`
        SELECT title FROM practicals WHERE id = ${practicalId}
      `;
      if (res.length > 0) {
        problem = { title: res[0].title };
      }
    } catch {}
  } else {
    problem = STATIC_PROBLEMS[id] || Object.values(STATIC_PROBLEMS).find(p => p.slug === id);
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

  let problem = null;
  if (id.startsWith('practical_')) {
    const practicalId = parseInt(id.replace('practical_', ''));
    try {
      const res = await sql`
        SELECT p.*, c.name as course_name, c.course_code 
        FROM practicals p
        JOIN courses c ON p.course_id = c.id
        WHERE p.id = ${practicalId}
      `;
      if (res.length > 0) {
        const p = res[0];
        problem = {
          id: `practical_${p.id}`,
          dbId: p.id,
          isPractical: true,
          clipboardRestricted: p.starter_code?.exam_policy?.restrict_clipboard === true,
          title: p.title,
          description: p.description,
          difficulty: p.difficulty || 'Medium',
          inputFormat: p.input_format,
          outputFormat: p.output_format,
          sampleInput: p.sample_input,
          sampleOutput: p.sample_output,
          constraints: p.constraints,
          instructions: p.instructions,
          allowedLanguages: p.starter_code?.allowed_languages || ['python', 'cpp'],
          startTime: p.start_time,
          endTime: p.end_time,
          testCases: []
        };
      }
    } catch (e) {
      console.error('Error fetching practical:', e);
    }
  }
  // If it's not a dynamic practical, it will be loaded as null, which renders the placeholder screen asking to select a practical.
  return <WorkspaceClientWrapper problem={problem} />;
}
