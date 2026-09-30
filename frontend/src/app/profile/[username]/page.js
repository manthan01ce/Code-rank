'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './profile.module.css';

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
    case 'done':        return 'Done';
    case 'past_due':   return 'Past Due';
    case 'upcoming':   return 'Due Soon';
    default:           return 'Not Started';
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
  // Faculty/Admin fields
  const [empId, setEmpId] = useState(user.extra_info?.employee_id || '');
  const [dept, setDept] = useState(user.extra_info?.department || '');
  
  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const handle = user.email.split('@')[0];
      
      let extraInfoUpdate = { ...user.extra_info };
      if (user.role === 'faculty' || user.role === 'admin') {
        extraInfoUpdate.employee_id = empId;
        extraInfoUpdate.department = dept;
      }
      
      const res = await fetch(`/api/profile/${handle}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          extra_info: extraInfoUpdate,
          currentPassword,
          newPassword
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Save failed');
      }
      onSave({ name, extra_info: extraInfoUpdate });
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Edit Profile</h3>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        {error && <div className={styles.modalError}>{error}</div>}

        <div className={styles.formGroup}>
          <label>Full Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        
        {(user.role === 'faculty' || user.role === 'admin') && (
          <>
            <div className={styles.formGroup}>
              <label>Employee ID</label>
              <input value={empId} onChange={(e) => setEmpId(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label>Department</label>
              <input value={dept} onChange={(e) => setDept(e.target.value)} />
            </div>
          </>
        )}

        <div className={styles.formGroup}>
          <label>Current Password (Required for changes)</label>
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password..." />
        </div>
        <div className={styles.formGroup}>
          <label>New Password</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password..." />
        </div>
        <div className={styles.formGroup}>
          <label>Confirm New Password</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password..." />
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnCancel} onClick={onClose}>Cancel</button>
          <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
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

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/'); return; }

      const res = await fetch(`/api/profile/${username}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) { router.push('/'); return; }
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to load profile');
      }

      const data = await res.json();
      setProfileData(data);

      // Check ownership
      const localUser = localStorage.getItem('user');
      if (localUser) {
        const parsed = JSON.parse(localUser);
        const handle = parsed.email ? parsed.email.split('@')[0] : '';
        setIsOwnProfile(handle === username);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [username, router]);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) { router.push('/'); return; }
    fetchProfile();
  }, [fetchProfile, router]);

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

  if (loading) {
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
  const pastDueCount   = practicals.filter((t) => t.status === 'past_due').length;
  const upcomingCount  = practicals.filter((t) => t.status === 'upcoming').length;

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
                <img src={user.avatar_url} alt={user.name} className={styles.avatarImage} />
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
                  {isActive ? '✔ Active' : '✖ Inactive'}
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
                  <span className={styles.verifiedIcon} title="College Email">✔</span>
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
        {isOwnProfile && (
          <div className={styles.trackerSection}>
            <div className={styles.trackerHeader}>
              <h2>Problems / Practicals Tracker</h2>
              <div className={styles.summaryChips}>
                <span className={`${styles.summaryChip} ${styles.chipCompleted}`}>
                  {completedCount} Completed
                </span>
                <span className={`${styles.summaryChip} ${styles.chipPastDue}`}>
                  {pastDueCount} Past due
                </span>
                <span className={`${styles.summaryChip} ${styles.chipUpcoming}`}>
                  {upcomingCount} Upcoming
                </span>
              </div>
            </div>

            <div className={styles.trackerList}>
              <div className={styles.trackerListHeader}>
                <div className={styles.headerName}>Problem/Practical Name</div>
                <div className={styles.headerCourse}>Course</div>
                <div className={styles.headerDate}>Due Date</div>
                <div className={styles.headerStatus}>Status</div>
              </div>
              {sortedTasks.length === 0 ? (
                <div className={styles.emptyState}>No practicals assigned yet.</div>
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
                      {statusLabel(task.status)}
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
