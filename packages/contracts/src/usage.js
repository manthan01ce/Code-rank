// Coarse, finite route names only. Never send usernames, IDs, queries or fragments.
export const usageRoutes=['/','/login','/signup','/practice','/code','/student','/student/practicals','/student/code','/faculty','/admin','/admin/courses','/admin/departments','/admin/faculty','/admin/logs','/admin/mapping','/admin/profile','/admin/settings','/admin/students','/profile','/privacy','/terms','/contact','other'];
export function usageRoute(pathname='') {
 const path=String(pathname).split(/[?#]/)[0];
 if(path==='/analytics'||path.startsWith('/analytics/')||path==='/api'||path.startsWith('/api/'))return null;
 if(path.startsWith('/student/code/'))return '/student/code';
 if(path.startsWith('/profile/'))return '/profile';
 return usageRoutes.includes(path)?path:'other';
}
