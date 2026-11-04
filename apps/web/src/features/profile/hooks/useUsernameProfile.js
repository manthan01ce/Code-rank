'use client';
import { selfProfileRequest, usernameProfileRequest } from '../api/profile-api';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { profilePracticals } from '@/lib/progress-updates';
import { useProgressRefresh } from '@/hooks/useProgressRefresh';
import { usePolling } from '@/hooks/usePolling';

export function useUsernameProfile() {
  const { username } = useParams();
  const router = useRouter();

  const [profileData, setProfileData] = useState(null);   // { user, practicals }
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useProgressRefresh(refresh);
  usePolling(refresh, 10000, true);

  const fetchProfile = useCallback(async (signal) => {
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return null; }
    const res = await usernameProfileRequest(username, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal,
    });
    if (res.status === 401) { router.replace('/login'); return null; }
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to load profile');
    }
    const data = await res.json();
    const ownResponse = await selfProfileRequest( {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal,
    });
    if (ownResponse.status === 401) { router.replace('/login'); return null; }
    if (!ownResponse.ok) throw new Error('Unable to verify profile ownership. Please try again.');
    const { user: ownUser } = await ownResponse.json();
    if (signal.aborted || token !== localStorage.getItem('token')) return null;
    const ownsProfile = String(ownUser.id) === String(data.user.id);
    return { ownsProfile, profile: { ...data, practicals: profilePracticals(data.submissions), user: ownsProfile ? { ...data.user, ...ownUser } : data.user } };
  }, [username, router]);

  useEffect(() => {
    const controller = new AbortController();
    fetchProfile(controller.signal).then(result => {
      if (controller.signal.aborted || !result) return;
      setIsOwnProfile(result.ownsProfile);
      setProfileData(result.profile);
      setError('');
    }).catch(err => {
      if (!controller.signal.aborted) setError(err.message || 'Unable to load profile');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [fetchProfile, revision]);

  const handleSave = (updated) => {
    setProfileData((prev) => ({
      ...prev,
      user: { ...prev.user, ...updated },
    }));
    // Also update localStorage so the sidebar reflects the new name immediately
    const local = localStorage.getItem('user');
    if (local) {
      const parsed = JSON.parse(local);
      localStorage.setItem('user', JSON.stringify({ ...parsed, ...updated }));
    }
  };


  return { username, router, profileData, setProfileData, isOwnProfile, setIsOwnProfile, loading, setLoading, showEdit, setShowEdit, error, setError, revision, setRevision, refresh, fetchProfile, handleSave };
}
