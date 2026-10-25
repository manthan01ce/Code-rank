import { StudentThemeProvider } from '@/components/student/StudentTheme';
import './student-theme.css';

export default function StudentLayout({ children }) {
  return <StudentThemeProvider>{children}</StudentThemeProvider>;
}
