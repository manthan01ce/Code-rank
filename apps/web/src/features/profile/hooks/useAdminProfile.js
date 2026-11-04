'use client';
import { selfProfileRequest } from '../api/profile-api';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAdminAuth } from '@/features/auth/hooks/useAdminAuth';

function getInitials(name) {
  if (!name) return 'A';
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

export function useAdminProfile() {
  const { token, isReady } = useAdminAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Edit Profile Modal states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, []);

  const fetchProfile = useCallback(async (signal) => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const res = await selfProfileRequest( {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store', signal,
      });
      if (!res.ok) {
        throw new Error('Failed to load profile details.');
      }
      const data = await res.json();
      if (signal?.aborted) return;
      if (data?.user) {
        setProfile(data.user);
        setEditName(data.user.name || '');
      }
    } catch (err) {
      if (!signal?.aborted) setError(err.message || 'Unable to load profile.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isReady && token) {
      const controller = new AbortController();
      fetchProfile(controller.signal);
      return () => controller.abort();
    }
  }, [isReady, token, fetchProfile]);

  // Track if edit modal has unsaved changes
  const isDirty = useMemo(() => {
    if (!profile) return false;
    return editName.trim() !== (profile.name || '').trim();
  }, [editName, profile]);

  const handleOpenEdit = () => {
    setEditName(profile?.name || '');
    setFormError('');
    setShowDiscardConfirm(false);
    setIsEditOpen(true);
  };

  const handleAttemptClose = () => {
    if (saving) return;
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      setIsEditOpen(false);
      setShowDiscardConfirm(false);
      setFormError('');
    }
  };

  const handleForceClose = () => {
    setShowDiscardConfirm(false);
    setIsEditOpen(false);
    setEditName(profile?.name || '');
    setFormError('');
  };

  // Handle Escape key for modal
  useEffect(() => {
    if (!isEditOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showDiscardConfirm) {
          setShowDiscardConfirm(false);
        } else if (isDirty) {
          setShowDiscardConfirm(true);
        } else {
          setIsEditOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEditOpen, isDirty, showDiscardConfirm]);

  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    const trimmed = editName.trim();
    if (!trimmed) {
      setFormError('Full name cannot be blank.');
      return;
    }
    if (trimmed.length > 300) {
      setFormError('Name must be 300 characters or fewer.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const res = await selfProfileRequest( {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile.');
      }

      // Update local profile state without full-page reload
      const updatedUser = { ...profile, name: trimmed };
      setProfile(updatedUser);

      // Keep localStorage in sync so sidebar and identity update immediately
      try {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        if (stored && typeof stored === 'object') {
          stored.name = trimmed;
          localStorage.setItem('user', JSON.stringify(stored));
          window.dispatchEvent(new Event('coderank:account'));
        }
      } catch {}

      showToast('Profile updated successfully.');
      setIsEditOpen(false);
      setShowDiscardConfirm(false);
    } catch (err) {
      setFormError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const initials = getInitials(profile?.name);
  const roleName = profile?.role === 'admin' ? 'Administrator' : profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'Administrator';
  const statusName = profile?.status ? profile.status.charAt(0).toUpperCase() + profile.status.slice(1) : 'Active';

  // Only render extra fields if backend provides them
  const hasEmployeeId = Boolean(profile?.extra_info?.employee_id);
  const hasDepartment = Boolean(profile?.extra_info?.department);


  return { token, isReady, profile, setProfile, loading, setLoading, error, setError, toast, setToast, isEditOpen, setIsEditOpen, editName, setEditName, formError, setFormError, saving, setSaving, showDiscardConfirm, setShowDiscardConfirm, showToast, fetchProfile, isDirty, handleOpenEdit, handleAttemptClose, handleForceClose, handleSaveProfile, initials, roleName, statusName, hasEmployeeId, hasDepartment };
}
