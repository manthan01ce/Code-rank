'use client';
import WorkspaceReturn from '@/components/layout/WorkspaceReturn';
import styles from '@/features/dashboard/components/overview.module.css';
import { useAccountIdentity } from '@/features/auth/hooks/useAccountIdentity';
import { StudentThemeToggle } from '@/components/layout/StudentTheme';
import Link from 'next/link';
import QuestionList from '@/components/student/QuestionList';
import { practicalDestination, practicalHasStarted, practicalBelongsToCourse } from '@/lib/practical-navigation';
import { usePracticalPage } from '@/features/practicals/hooks/usePracticalPage';
import { fetchCollection } from '@/lib/fetch-collection';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import LogoutConfirmModal from '@/components/ui/LogoutConfirmModal';
import { useSocket } from '@/hooks/useSocket';
import { usePolling } from '@/hooks/usePolling';

export function useStudentDashboard() {
  const router = useRouter();
  const currentIdentity = useAccountIdentity();
  const socket = useSocket();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);
  const [courses, setCourses] = useState([]);
  const practicalPage = usePracticalPage(null, Boolean(user));
  const { rows: practicals, refresh: fetchStudentPracticals } = practicalPage;

  useEffect(() => {
    // Wait for client-side hydration before accessing localStorage
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return; // Don't check auth until hydrated

    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!userData || !token) {
      router.push('/');
      return;
    }

    try {
      setUser(JSON.parse(userData));
    } catch {
      router.push('/');
      return;
    }

    // Profile determines the course filter; practicals can load independently.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let active = true;
    const options = {headers: {'Authorization': `Bearer ${token}`}, signal: controller.signal};
    setLoading(true);
    setLoadError('');
    const read = async (url) => {
      const res = await fetch(url, options);
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.replace('/login');
        throw Error('Please sign in again.');
      }
      if (!res.ok) throw Error(`Request failed (${res.status})`);
      return res.json();
    };
    const fetchData = async () => {
      try {
        const results = await Promise.allSettled([
          (async () => {
            const data = await read('/api/auth/profile');
            if (!active) return;
            setProfile(data);
            const sem = data.user?.extra_info?.semester;
            if (sem) {
              const rows = await fetchCollection(`/api/courses?semester=${encodeURIComponent(sem)}`, options);
              if (active) setCourses(rows);
            }
          })(),
        ]);
        if (active && results.some(result => result.status === 'rejected')) {
          setLoadError(controller.signal.aborted
            ? 'Loading took too long. Check your connection and retry.'
            : 'Some dashboard sections could not load. Please retry.');
        }
      } finally {
        clearTimeout(timer);
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => {active = false; clearTimeout(timer); controller.abort();};
  }, [router, isHydrated]);

  // Real-time socket updates for new, updated, or deleted practicals
  useEffect(() => {
    if (!socket) return;

    const handleSocketUpdate = () => {
      fetchStudentPracticals();
    };

    socket.on('new_submission_marks', handleSocketUpdate);
    socket.on('practical_added', handleSocketUpdate);
    socket.on('practical_updated', handleSocketUpdate);
    socket.on('practical_deleted', handleSocketUpdate);

    return () => {
      socket.off('new_submission_marks', handleSocketUpdate);
      socket.off('practical_added', handleSocketUpdate);
      socket.off('practical_updated', handleSocketUpdate);
      socket.off('practical_deleted', handleSocketUpdate);
    };
  }, [socket, fetchStudentPracticals]);

  // Join course rooms for student courses to receive course-specific socket events
  useEffect(() => {
    if (!socket || !courses || courses.length === 0) return;
    courses.forEach(c => socket.emit('join_course_room', c.id));
    return () => {
      courses.forEach(c => socket.emit('leave_course_room', c.id));
    };
  }, [socket, courses]);

  // Polling fallback – refresh practicals every 60s (only when socket unavailable, supplements socket events)
  // Only enable polling when socket is not connected or user is active
  const isSocketConnected = socket?.connected;
  usePolling(fetchStudentPracticals, 60_000, !!user && !isSocketConnected);

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => setShowLogoutModal(true);

  const confirmLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };


  return { router, currentIdentity, socket, user, setUser, profile, setProfile, loading, setLoading, loadError, setLoadError, isHydrated, setIsHydrated, courses, setCourses, practicalPage, practicals, fetchStudentPracticals, isSocketConnected, showLogoutModal, setShowLogoutModal, handleLogout, confirmLogout };
}
