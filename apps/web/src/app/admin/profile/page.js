'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import LoadingOverlay from '@/components/LoadingOverlay';
import {
  IconUser,
  IconMail,
  IconShield,
  IconCheck,
  IconEdit,
  IconX,
  IconLock,
  IconAlertCircle,
  IconBuilding,
  IconId,
} from '@tabler/icons-react';

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

export default function AdminProfilePage() {
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

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/auth/profile', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error('Failed to load profile details.');
      }
      const data = await res.json();
      if (data?.user) {
        setProfile(data.user);
        setEditName(data.user.name || '');
      }
    } catch (err) {
      setError(err.message || 'Unable to load profile.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isReady && token) {
      fetchProfile();
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
      const res = await fetch('/api/auth/profile', {
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

  return (
    <div className="space-y-6 max-w-[960px] mx-auto">
      {saving && <LoadingOverlay />}

      {/* Toast Feedback */}
      {toast && (
        <div
          role="status"
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 border transition-all ${
            toast.type === 'success'
              ? 'bg-[#eff1ff] text-[#4338ca] border-[#c7d2fe]'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <IconCheck size={15} />
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Page Header — Standard CodeRank Pattern */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#e2e8f0]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">My Profile</h1>
          <p className="text-xs text-[#64748b] mt-0.5">View and manage your personal information.</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleOpenEdit}
            disabled={loading || !profile}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <IconEdit size={14} />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div role="alert" className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconAlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchProfile}
            className="text-xs font-semibold text-red-700 underline hover:text-red-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state skeleton */}
      {loading && !profile && (
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-8 flex items-center gap-6 animate-pulse">
          <div className="w-16 h-16 rounded-full bg-[#f1f5f9] shrink-0" />
          <div className="space-y-3 flex-1">
            <div className="h-5 bg-[#f1f5f9] rounded w-1/3" />
            <div className="h-3.5 bg-[#f1f5f9] rounded w-1/4" />
          </div>
        </div>
      )}

      {/* Profile Content */}
      {profile && (
        <div className="space-y-6">
          {/* Profile Summary Card */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 sm:p-7 shadow-xs">
            <div className="flex items-center gap-5">
              {/* Circular Avatar with Initials */}
              <div
                className="w-16 h-16 rounded-full bg-[#eff1ff] text-[#4f46e5] font-bold text-xl flex items-center justify-center border-2 border-[#c7d2fe] shrink-0 shadow-xs"
                aria-hidden="true"
              >
                {initials}
              </div>

              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] leading-tight truncate">
                  {profile.name}
                </h2>
                <div className="text-xs text-[#64748b] mt-1 flex items-center gap-1.5 truncate">
                  <IconMail size={13} className="text-[#94a3b8] shrink-0" />
                  <span>{profile.email}</span>
                </div>

                {/* Role and Status Badges */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#eff1ff] text-[#4338ca] border border-[#c7d2fe]">
                    <IconShield size={12} className="text-[#4f46e5]" />
                    <span>{roleName}</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                    <span>{statusName}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Personal Information Section */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 sm:p-7 shadow-xs">
            <div className="pb-4 mb-5 border-b border-[#f1f5f9]">
              <h3 className="text-sm font-bold text-[#0f172a]">Personal Information</h3>
              <p className="text-xs text-[#64748b] mt-0.5">Details associated with your administrative account.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Full Name */}
              <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#f1f5f9]">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b] mb-1 flex items-center gap-1.5">
                  <IconUser size={12} className="text-[#94a3b8]" />
                  <span>Full Name</span>
                </div>
                <div className="text-sm font-semibold text-[#0f172a]">{profile.name}</div>
              </div>

              {/* Email Address */}
              <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#f1f5f9]">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b] mb-1 flex items-center gap-1.5">
                  <IconMail size={12} className="text-[#94a3b8]" />
                  <span>Email Address</span>
                </div>
                <div className="text-sm font-semibold text-[#0f172a]">{profile.email}</div>
              </div>

              {/* Role */}
              <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#f1f5f9]">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b] mb-1 flex items-center gap-1.5">
                  <IconShield size={12} className="text-[#94a3b8]" />
                  <span>Role</span>
                </div>
                <div className="text-sm font-semibold text-[#0f172a]">{roleName}</div>
              </div>

              {/* Account Status */}
              <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#f1f5f9]">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b] mb-1 flex items-center gap-1.5">
                  <IconCheck size={12} className="text-[#94a3b8]" />
                  <span>Account Status</span>
                </div>
                <div className="text-sm font-semibold text-[#0f172a] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                  <span>{statusName}</span>
                </div>
              </div>

              {/* Conditionally rendered extra fields only when backend provides them */}
              {hasEmployeeId && (
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#f1f5f9]">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b] mb-1 flex items-center gap-1.5">
                    <IconId size={12} className="text-[#94a3b8]" />
                    <span>Employee ID</span>
                  </div>
                  <div className="text-sm font-semibold text-[#0f172a]">{profile.extra_info.employee_id}</div>
                </div>
              )}

              {hasDepartment && (
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#f1f5f9]">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b] mb-1 flex items-center gap-1.5">
                    <IconBuilding size={12} className="text-[#94a3b8]" />
                    <span>Department</span>
                  </div>
                  <div className="text-sm font-semibold text-[#0f172a]">{profile.extra_info.department}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal Dialog */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#0f172a]/50 backdrop-blur-xs transition-opacity"
            onClick={handleAttemptClose}
            aria-hidden="true"
          />

          {/* Modal Container */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-modal-title"
            className="relative z-10 w-full max-w-[480px] bg-white rounded-xl shadow-2xl border border-[#e2e8f0] overflow-hidden transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
              <div>
                <h3 id="edit-profile-modal-title" className="text-base font-bold text-[#0f172a]">
                  Edit Profile
                </h3>
                <p className="text-xs text-[#64748b] mt-0.5">Update your personal account information.</p>
              </div>
              <button
                type="button"
                onClick={handleAttemptClose}
                disabled={saving}
                className="p-1 rounded-md text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-colors"
                aria-label="Close dialog"
              >
                <IconX size={18} />
              </button>
            </div>

            {/* Unsaved Changes Confirmation Banner */}
            {showDiscardConfirm && (
              <div role="alert" className="p-3 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
                <span className="font-medium">You have unsaved changes. Discard them?</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDiscardConfirm(false)}
                    className="px-2 py-1 rounded bg-white border border-amber-300 text-amber-900 font-semibold hover:bg-amber-100"
                  >
                    Keep Editing
                  </button>
                  <button
                    type="button"
                    onClick={handleForceClose}
                    className="px-2 py-1 rounded bg-amber-600 text-white font-semibold hover:bg-amber-700"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
              {formError && (
                <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                  <IconAlertCircle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Full Name Field (Editable) */}
              <div>
                <label htmlFor="edit-name" className="block text-xs font-semibold text-[#334155] mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-name"
                  type="text"
                  maxLength={300}
                  autoComplete="name"
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    if (formError) setFormError('');
                  }}
                  className="w-full px-3 py-2 text-sm text-[#0f172a] bg-white border border-[#cbd5e1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4f46e5] focus:border-[#4f46e5] transition-colors"
                  placeholder="Enter your full name"
                  disabled={saving}
                  autoFocus
                />
              </div>

              {/* Email Address (Read-only) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="edit-email" className="block text-xs font-semibold text-[#334155]">
                    Email Address
                  </label>
                  <span className="text-[10px] font-medium text-[#64748b] flex items-center gap-1">
                    <IconLock size={10} /> Read-only
                  </span>
                </div>
                <input
                  id="edit-email"
                  type="email"
                  value={profile.email}
                  readOnly
                  disabled
                  className="w-full px-3 py-2 text-sm text-[#64748b] bg-[#f8fafc] border border-[#e2e8f0] rounded-lg cursor-not-allowed select-none"
                />
                <p className="text-[11px] text-[#94a3b8] mt-1">
                  Institutional email addresses are managed centrally by the university.
                </p>
              </div>

              {/* Role (Read-only) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="edit-role" className="block text-xs font-semibold text-[#334155]">
                    System Role
                  </label>
                  <span className="text-[10px] font-medium text-[#64748b] flex items-center gap-1">
                    <IconLock size={10} /> Read-only
                  </span>
                </div>
                <input
                  id="edit-role"
                  type="text"
                  value={roleName}
                  readOnly
                  disabled
                  className="w-full px-3 py-2 text-sm text-[#64748b] bg-[#f8fafc] border border-[#e2e8f0] rounded-lg cursor-not-allowed select-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f1f5f9]">
                <button
                  type="button"
                  onClick={handleAttemptClose}
                  disabled={saving}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#e2e8f0] text-[#475569] hover:bg-[#f1f5f9] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !editName.trim() || !isDirty}
                  className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
