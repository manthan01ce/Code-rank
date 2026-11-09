import { pageMetadata } from '@/lib/site-config';

export const metadata = pageMetadata('Student workspace | CodeRank', 'Your institutional CodeRank workspace.');

import { StudentThemeProvider } from '@/components/layout/StudentTheme';
import './student-theme.css';

export default function StudentLayout({ children }) {
  return <StudentThemeProvider>{children}</StudentThemeProvider>;
}
