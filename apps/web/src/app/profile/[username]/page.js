'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import styles from './profile.module.css';
import { profilePracticals } from '@/lib/progress-updates';
import { useProgressRefresh } from '@/hooks/useProgressRefresh';
import { usePolling } from '@/hooks/usePolling';
import AdminProfileOverview from './AdminProfileOverview';

/* ── helpers ───────────────────────────────── */
function getInitials(name) {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function statusLabel(s) {
  switch (s) {
    case 'done':        return 'Solved';
    case 'past_due':   return 'Past Due';
    case 'upcoming':   return 'Due Soon';
    default:           return 'Unsolved';
  }
}

function sortTasks(tasks) {
  const order = { past_due: 0, upcoming: 1, not_started: 2, done: 3 };
  return [...tasks].sort((a, b) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    if (a.status === 'upcoming' && a.dueDate && b.dueDate) {
      return new Date(a.dueDate) - new Date(b.dueDate);
    }
    return 0;
  });
}

/* ── Edit Modal ─────────────────────────────── */
function EditModal({ user, onClose, onSave }) {
  const [name, setName] = useState(user.name || '');
  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dialog = useRef(null);
  useEffect(() => { dialog.current?.showModal(); }, []);

  const handleSave = async () => {
    if (saving) return;
    if (!name.trim() || name.length > 300) { setError('Enter a name of 1–300 characters.'); return; }
    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');

      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined
        }),
      });

      let d = {};
      try {
        const text = await res.text();
        d = text ? JSON.parse(text) : {};
      } catch {
        d = {};
      }

      if (!res.ok) {
        throw new Error(d.error || `Save failed (${res.status})`);
      }

      if (d.token) {
        localStorage.setItem('token', d.token);
      }
      try {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        if (stored && typeof stored === 'object') {
          stored.name = name.trim();
          localStorage.setItem('user', JSON.stringify(stored));
          window.dispatchEvent(new Event('coderank:account'));
        }
      } catch {}

      onSave({ name: name.trim() });
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog ref={dialog} className={styles.editDialog} aria-labelledby="edit-profile-title" onCancel={event => { if (saving) event.preventDefault(); else onClose(); }}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 id="edit-profile-title">Edit Profile</h3>
          <button className={styles.modalClose} aria-label="Close edit profile" disabled={saving} onClick={onClose}>✕</button>
        </div>

        {error && <div role="alert" className={styles.modalError}>{error}</div>}

        <div className={styles.formGroup}>
          <label htmlFor="profile-name">Full Name</label>
          <input id="profile-name" maxLength={300} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="profile-current-password">Current Password (required only to change password)</label>
          <input id="profile-current-password" autoComplete="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password..." />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="profile-new-password">New Password</label>
          <input id="profile-new-password" autoComplete="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password..." />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="profile-confirm-password">Confirm New Password</label>
          <input id="profile-confirm-password" autoComplete="new-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password..." />
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnCancel} disabled={saving} onClick={onClose}>Cancel</button>
          <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/* ── Main Page ──────────────────────────────── */
export default function ProfilePage() {
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
    const res = await fetch(`/api/profile/${encodeURIComponent(username)}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal,
    });
    if (res.status === 401) { router.replace('/login'); return null; }
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to load profile');
    }
    const data = await res.json();
    const ownResponse = await fetch('/api/auth/profile', {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal,
    });
    if (ownResponse.status === 401) { router.replace('/login'); return null; }
    if (!ownResponse.ok) throw new Error('Unable to verify profile ownership. Please try again.');
    const { user: ownUser } = await ownResponse.json();
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

  if (loading || (!profileData && !error)) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
        <span>Loading profile…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorWrap}>
        <div className={styles.errorBox}>
          <span>⚠️</span>
          <p>{error}</p>
          <button onClick={() => router.back()}>← Go Back</button>
        </div>
      </div>
    );
  }

  const { user, practicals = [] } = profileData;
  const userHandle = user.email ? user.email.split('@')[0] : username;
  const initials = getInitials(user.name);

  // Student specific data
  const rollNumber = user.extra_info?.roll_number || '—';
  const division = user.extra_info?.division || '—';
  const semester = user.extra_info?.semester || '—';

  // Faculty/Admin specific data
  const empId      = user.extra_info?.employee_id || '—';
  const department = user.extra_info?.department  || '—';

  const sortedTasks   = sortTasks(practicals);
  const completedCount = practicals.filter((t) => t.status === 'done').length;

  const isActive = user.status === 'active';

  return (
    <div className={styles.profileContainer}>
      {/* Section label */}
      <div className={styles.headerTitle}>
        <span>👤</span> PROFILE
      </div>

      <div className={styles.profileLayout}>
        {/* ── 1. Identity Header ────────────────────── */}
        <div className={styles.identityCard}>
          {/* Avatar */}
          <div className={styles.identityMain}>
            <div className={styles.avatarWrap}>
              {user.avatar_url ? (
                <Image src={user.avatar_url} alt={user.name || 'Profile avatar'} width={120} height={120} unoptimized className={styles.avatarImage} />
              ) : (
                <span>{initials}</span>
              )}
            </div>

            <div className={styles.userInfo}>
              <h1 className={styles.userName}>{user.name || '—'}</h1>
              <div className={styles.userHandle}>@{userHandle}</div>

              {/* Role + Status badges */}
              <div className={styles.badgeRow}>
                <span className={`${styles.badge} ${styles.badgeRole}`}>
                  {user.role === 'admin' ? '🛡 Admin' : user.role === 'student' ? '🧑‍🎓 Student' : '🎓 Faculty'}
                </span>
                <span className={`${styles.badge} ${isActive ? styles.badgeActive : styles.badgeInactive}`}>
                  {isActive ? '✔ Active' : user.status === 'inactive' ? '✖ Inactive' : 'Status unavailable'}
                </span>
              </div>
            </div>
          </div>

          {/* Meta + Edit Button */}
          <div className={styles.identityMeta}>
            <div className={styles.metaGrid}>
              {user.role === 'student' ? (
                <>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>ROLL NO</span>
                    <span className={styles.metaValue}>{rollNumber}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>SEM / DIV</span>
                    <span className={styles.metaValue}>{semester} / {division}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>EMP ID</span>
                    <span className={styles.metaValue}>{empId}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>DEPARTMENT</span>
                    <span className={styles.metaValue}>{department}</span>
                  </div>
                </>
              )}
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>EMAIL</span>
                <span className={styles.metaValue}>
                  {user.email}

                </span>
              </div>
            </div>

            {isOwnProfile && (
              <button className={styles.btnEdit} onClick={() => setShowEdit(true)}>
                ✏ Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* ── 2. Practicals Tracker (own profile only) ── */}
        {isOwnProfile && user.role === 'admin' && <AdminProfileOverview onEdit={() => setShowEdit(true)} />}
        {isOwnProfile && user.role !== 'admin' && (
          <div className={styles.trackerSection}>
            <div className={styles.trackerHeader}>
              <h2>Practical progress</h2>
              <div className={styles.summaryChips}>
                <span className={`${styles.summaryChip} ${styles.chipCompleted}`}>
                  {completedCount} Solved
                </span>
                <span className={`${styles.summaryChip} ${styles.chipPastDue}`}>
                  {practicals.length - completedCount} Unsolved
                </span>
                <span className={`${styles.summaryChip} ${styles.chipUpcoming}`}>
                  {practicals.length} Attempted
                </span>
              </div>
            </div>

            <div className={styles.trackerList}>
              <div className={styles.trackerListHeader}>
                <div className={styles.headerName}>Problem/Practical Name</div>
                <div className={styles.headerCourse}>Course</div>
                <div className={styles.headerDate}>Submitted</div>
                <div className={styles.headerStatus}>Status</div>
              </div>
              {sortedTasks.length === 0 ? (
                <div className={styles.emptyState}>No submitted practicals yet. Your progress will appear after you submit a solution.</div>
              ) : (
                sortedTasks.map((task) => (
                  <Link
                    key={task.id}
                    href={user.role === 'student' ? `/student/code/practical_${task.id}?subject=${task.course_code || task.course}` : `/faculty?tab=practicals&id=${task.id}`}
                    className={styles.trackerRow}
                  >
                    <div className={styles.taskName}>{task.name}</div>
                    <div className={styles.taskCourse}>
                      {task.course_code || task.course}
                    </div>
                    <div className={styles.taskDate}>
                      {task.dueDate
                        ? new Date(task.dueDate).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })
                        : '—'}
                    </div>
                    <div
                      className={`${styles.taskStatus} ${
                        task.status === 'done'        ? styles.statusDone :
                        task.status === 'past_due'    ? styles.statusPastDue :
                        task.status === 'upcoming'    ? styles.statusUpcoming :
                        styles.statusNotStarted
                      }`}
                    >
                      {statusLabel(task.status)}{task.marks !== null && task.marks !== undefined ? ` · ${task.marks}/10` : ''}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <EditModal
          user={user}
          onClose={() => setShowEdit(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
