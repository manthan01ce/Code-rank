import { StudentThemeProvider } from '@/components/layout/StudentTheme';
import './student-theme.css';

export default function StudentLayout({ children }) {
  return <StudentThemeProvider>{children}</StudentThemeProvider>;
}
