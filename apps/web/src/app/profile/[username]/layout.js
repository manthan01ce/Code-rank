import { pageMetadata } from '@/lib/site-config';

export const metadata = pageMetadata('Profile | CodeRank', 'Your institutional CodeRank workspace.');

import WorkspaceReturn from '@/components/layout/WorkspaceReturn';

export default function ProfileLayout({ children }) {
  return <><WorkspaceReturn />{children}</>;
}
