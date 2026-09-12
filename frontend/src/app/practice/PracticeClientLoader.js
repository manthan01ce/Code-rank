'use client';

// This Client Component wrapper exists solely to use next/dynamic with ssr:false.
// next/dynamic({ ssr: false }) CANNOT be called from a Server Component.
// page.js is a Server Component (it exports `metadata`), so the dynamic import
// must live here in a 'use client' boundary instead.

import dynamic from 'next/dynamic';

const PythonDashboard = dynamic(
  () => import('@/components/practice/PythonDashboard'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen bg-[#1a1a1a] text-gray-400 text-sm gap-3">
        <span className="animate-spin rounded-full h-5 w-5 border-2 border-[#2cbb5d] border-t-transparent" />
        Loading editor...
      </div>
    ),
  }
);

export default function PracticeClientLoader() {
  return <PythonDashboard />;
}
