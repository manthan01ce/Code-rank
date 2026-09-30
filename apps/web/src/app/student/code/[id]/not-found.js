/**
 * not-found.js — Native Next.js 404 page for /student/code/[id]
 *
 * This file is automatically rendered by App Router when notFound() is called
 * from page.js in this route segment. No manual wiring needed.
 *
 * Scope: only activates for unknown problem IDs under /student/code/.
 * It does NOT replace the global not-found at app/not-found.js.
 */
import Link from 'next/link';

export default function ProblemNotFound() {
  return (
    <div className="h-screen w-full bg-[#0a0a0a] flex items-center justify-center font-sans">
      <div className="text-center space-y-6 px-6">

        {/* Large dimmed number */}
        <p
          className="text-[120px] font-black leading-none text-gray-800 select-none tracking-tighter"
          aria-hidden="true"
        >
          404
        </p>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white">Problem not found</h1>
          <p className="text-gray-500 text-sm max-w-xs mx-auto leading-relaxed">
            This problem doesn&apos;t exist or may have been removed.
            Check the problem list for available questions.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/student"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-md text-sm font-medium transition-colors"
          >
            ← Back to Dashboard
          </Link>
          <Link
            href="/student/code/1"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2d2d2d] hover:bg-[#3c3c3c] text-gray-300 rounded-md text-sm font-medium transition-colors"
          >
            Try Problem #1
          </Link>
        </div>
      </div>
    </div>
  );
}
