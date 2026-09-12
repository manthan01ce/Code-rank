import WorkspaceLayout from '@/components/compiler/WorkspaceLayout';

export const metadata = {
  title: 'Workspace - CodeRank',
  description: 'Online coding workspace',
};

export default function CodePage() {
  return (
    <main className="h-screen w-full bg-[#1e1e1e] text-white overflow-hidden">
      <WorkspaceLayout />
    </main>
  );
}
