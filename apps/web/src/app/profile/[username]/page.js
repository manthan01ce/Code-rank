'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Edit3,
  KeyRound,
  Shield,
  School,
  GraduationCap,
  CheckCircle2,
  XCircle,
  BookOpen,
  Award,
  FileText,
  Clock,
  Lock,
  Users,
  Layers,
  Settings,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import styles from './profile.module.css';

/* ── helpers ───────────────────────────────── */
function getInitials(name) {
  if (!name) return 'U';
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function statusLabel(s) {
  switch (s) {
    case 'done':
      return 'Completed';
    case 'submitted':
      return 'Submitted';
    case 'past_due':
      return 'Past Due';
    case 'upcoming':
      return 'Due Soon';
    default:
      return 'Not Started';
  }
}

function sortTasks(tasks) {
  const order = { past_due: 0, upcoming: 1, not_started: 2, submitted: 3, done: 4 };
  return [...tasks].sort((a, b) => {
    const statusA = order[a.status] !== undefined ? order[a.status] : 5;
    const statusB = order[b.status] !== undefined ? order[b.status] : 5;
    if (statusA !== statusB) return statusA - statusB;
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate) - new Date(b.dueDate);
    }
    return 0;
  });
}

/* ── Edit Profile Modal ─────────────────────── */
function EditProfileModal({ user, onClose, onSave }) {
  const [name, setName] = useState(user.name || '');
  const [empId, setEmpId] = useState(user.extra_info?.employee_id || user.extra_info?.facultyId || '');
  const [dept, setDept] = useState(user.extra_info?.department || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isAdmin = user.role === 'admin';
  const isFaculty = user.role === 'faculty';
  const isStudent = user.role === 'student';

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Full name cannot be empty.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const handle = user.email ? user.email.split('@')[0] : '';

      let extraInfoUpdate = { ...(user.extra_info || {}) };
      if (isAdmin) {
        extraInfoUpdate.employee_id = empId;
        extraInfoUpdate.department = dept;
      }

      const res = await fetch(`/api/profile/${handle}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          extra_info: extraInfoUpdate
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile.');
      }

      setSuccess('Profile updated successfully!');
      onSave({ name: name.trim(), extra_info: extraInfoUpdate });
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit3 size={18} color="#4f46e5" />
            <h3 id="edit-profile-title">Edit Profile</h3>
          </div>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close dialog">
            &times;
          </button>
        </div>

        {error && (
          <div className={styles.modalError}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className={styles.modalSuccess}>
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Full Name (Editable for all) */}
          <div className={styles.formGroup}>
            <label htmlFor="edit-name">
              Full Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="edit-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>

          {/* Email Address (Protected) */}
          <div className={styles.formGroup}>
            <label>
              Official Email
              <Lock size={12} color="#94a3b8" />
            </label>
            <input type="text" value={user.email || ''} disabled />
            <span className={styles.fieldHelpText}>
              <Lock size={11} /> Email addresses are managed by administration.
            </span>
          </div>

          {/* Student Protected Fields */}
          {isStudent && (
            <>
              <div className={styles.formGroup}>
                <label>
                  Roll Number
                  <Lock size={12} color="#94a3b8" />
                </label>
                <input type="text" value={user.extra_info?.roll_number || '—'} disabled />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className={styles.formGroup}>
                  <label>
                    Department
                    <Lock size={12} color="#94a3b8" />
                  </label>
                  <input type="text" value={user.extra_info?.department || '—'} disabled />
                </div>
                <div className={styles.formGroup}>
                  <label>
                    Semester / Division
                    <Lock size={12} color="#94a3b8" />
                  </label>
                  <input
                    type="text"
                    value={`${user.extra_info?.semester || '—'} / ${user.extra_info?.division || '—'}`}
                    disabled
                  />
                </div>
              </div>
              <span className={styles.fieldHelpText}>
                <Lock size={11} /> Academic details are verified records managed by the department.
              </span>
            </>
          )}

          {/* Faculty Protected Fields */}
          {isFaculty && (
            <>
              <div className={styles.formGroup}>
                <label>
                  Faculty ID
                  <Lock size={12} color="#94a3b8" />
                </label>
                <input type="text" value={user.extra_info?.facultyId || user.extra_info?.employee_id || '—'} disabled />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className={styles.formGroup}>
                  <label>
                    Department
                    <Lock size={12} color="#94a3b8" />
                  </label>
                  <input type="text" value={user.extra_info?.department || '—'} disabled />
                </div>
                <div className={styles.formGroup}>
                  <label>
                    Designation
                    <Lock size={12} color="#94a3b8" />
                  </label>
                  <input type="text" value={user.extra_info?.designation || '—'} disabled />
                </div>
              </div>
              <span className={styles.fieldHelpText}>
                <Lock size={11} /> Faculty designation and department can only be updated by administrators.
              </span>
            </>
          )}

          {/* Admin Fields */}
          {isAdmin && (
            <>
              <div className={styles.formGroup}>
                <label htmlFor="edit-empid">Employee / Admin ID</label>
                <input
                  id="edit-empid"
                  type="text"
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  placeholder="e.g. ADMIN-001"
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="edit-dept">Department</label>
                <input
                  id="edit-dept"
                  type="text"
                  value={dept}
                  onChange={(e) => setDept(e.target.value)}
                  placeholder="e.g. Administration"
                />
              </div>
            </>
          )}

          <div className={styles.modalFooter}>
            <button type="button" className={styles.btnCancel} onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={styles.btnSave} disabled={saving}>
              {saving ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main Profile Component ─────────────────── */
export default function ProfilePage() {
  const { username } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [profileData, setProfileData] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [error, setError] = useState('');

  // Determine back destination based on role
  const getDashboardUrl = () => {
    if (!currentUser) return '/';
    switch (currentUser.role) {
      case 'admin':
        return '/admin';
      case 'faculty':
        return '/faculty';
      case 'student':
      default:
        return '/student';
    }
  };

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
        return;
      }

      const res = await fetch(`/api/profile/${username}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401) {
        router.push('/');
        return;
      }

      if (res.status === 403) {
        setError('Access Denied: You do not have permission to view this profile.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to load profile.');
      }

      const data = await res.json();
      setProfileData(data);

      const localUserStr = localStorage.getItem('user');
      if (localUserStr) {
        const parsed = JSON.parse(localUserStr);
        setCurrentUser(parsed);
        const handle = parsed.email ? parsed.email.split('@')[0] : '';
        const isOwn = handle === username;
        setIsOwnProfile(isOwn);

        // Check if query param requested edit mode
        if (isOwn && searchParams.get('edit') === 'true') {
          setShowEdit(true);
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [username, router, searchParams]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSaveProfile = (updated) => {
    setProfileData((prev) => ({
      ...prev,
      user: { ...prev.user, ...updated }
    }));

    // Update localStorage user record so global headers immediately reflect changes
    const localUserStr = localStorage.getItem('user');
    if (localUserStr) {
      const parsed = JSON.parse(localUserStr);
      const updatedUser = { ...parsed, ...updated };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
        <span>Loading profile data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorWrap}>
        <div className={styles.errorBox}>
          <span>⚠️</span>
          <p>{error}</p>
          <button onClick={() => router.push(getDashboardUrl())}>
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!profileData || !profileData.user) {
    return null;
  }

  const { user, courses = [], practicals = [], academicOverview, systemStats } = profileData;
  const userHandle = user.email ? user.email.split('@')[0] : username;
  const initials = getInitials(user.name);
  const isActive = user.status === 'active';

  // Role Badges
  const getRoleBadgeStyle = (r) => {
    switch (r) {
      case 'admin':
        return styles.badgeAdmin;
      case 'faculty':
        return styles.badgeFaculty;
      case 'student':
      default:
        return styles.badgeStudent;
    }
  };

  const roleTitle = user.role === 'admin' ? 'Administrator' : user.role === 'faculty' ? 'Faculty Member' : 'Student';
  const roleIcon = user.role === 'admin' ? <Shield size={12} /> : user.role === 'faculty' ? <School size={12} /> : <GraduationCap size={12} />;

  // Student specific data
  const rollNumber = user.extra_info?.roll_number || '—';
  const division = user.extra_info?.division || '—';
  const semester = user.extra_info?.semester || '—';
  const department = user.extra_info?.department || '—';

  // Faculty specific data
  const facultyId = user.extra_info?.facultyId || user.extra_info?.employee_id || '—';
  const designation = user.extra_info?.designation || 'Faculty';

  // Admin specific data
  const adminId = user.extra_info?.employee_id || 'ADMIN-001';

  const sortedTasks = sortTasks(practicals);

  return (
    <div className={styles.profileContainer}>
      {/* ── Top Navigation Bar ────────────────────── */}
      <div className={styles.topNavBar}>
        <button
          onClick={() => router.push(getDashboardUrl())}
          className={styles.btnBack}
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
        <div className={styles.topTitle}>
          {roleIcon}
          <span>{roleTitle} Profile</span>
        </div>
      </div>

      <div className={styles.profileLayout}>
        {/* ── 1. Left Column: Identity Card ─────────── */}
        <div className={styles.identityCard}>
          <div className={styles.identityMain}>
            <div className={styles.avatarWrap}>
              <span>{initials}</span>
            </div>

            <div className={styles.userInfo}>
              <h1 className={styles.userName}>{user.name || '—'}</h1>
              <div className={styles.userHandle}>@{userHandle}</div>

              <div className={styles.badgeRow}>
                <span className={`${styles.badge} ${getRoleBadgeStyle(user.role)}`}>
                  {roleIcon}
                  {user.role?.toUpperCase()}
                </span>
                <span className={`${styles.badge} ${isActive ? styles.badgeActive : styles.badgeInactive}`}>
                  {isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.identityMeta}>
            <div className={styles.metaGrid}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Official Email</span>
                <span className={styles.metaValue}>
                  {user.email}
                  <CheckCircle2 size={14} className={styles.verifiedIcon} title="Verified College Email" />
                </span>
              </div>

              {user.role === 'student' && (
                <>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Roll Number</span>
                    <span className={styles.metaValue}>{rollNumber}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Department</span>
                    <span className={styles.metaValue}>{department}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Sem / Div</span>
                    <span className={styles.metaValue}>
                      Sem {semester} &bull; Div {division}
                    </span>
                  </div>
                </>
              )}

              {user.role === 'faculty' && (
                <>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Faculty ID</span>
                    <span className={styles.metaValue}>{facultyId}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Department</span>
                    <span className={styles.metaValue}>{department}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Designation</span>
                    <span className={styles.metaValue}>{designation}</span>
                  </div>
                </>
              )}

              {user.role === 'admin' && (
                <>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Admin ID</span>
                    <span className={styles.metaValue}>{adminId}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Department</span>
                    <span className={styles.metaValue}>{department}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Privilege</span>
                    <span className={styles.metaValue}>Full Administrative</span>
                  </div>
                </>
              )}
            </div>

            {/* Actions (Available on own profile or for admin) */}
            {(isOwnProfile || currentUser?.role === 'admin') && (
              <div className={styles.actionButtonColumn}>
                <button
                  className={styles.btnEdit}
                  onClick={() => setShowEdit(true)}
                  aria-label="Edit Profile"
                >
                  <Edit3 size={15} />
                  <span>Edit Profile</span>
                </button>
                {isOwnProfile && (
                  <button
                    className={styles.btnPassword}
                    onClick={() => setShowChangePassword(true)}
                    aria-label="Change Password"
                  >
                    <KeyRound size={15} />
                    <span>Change Password</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── 2. Right Column: Role Specific Content ── */}
        <div className={styles.contentColumn}>
          {/* ═══════════════ STUDENT VIEW ═══════════════ */}
          {user.role === 'student' && (
            <>
              {/* Academic Overview Metrics */}
              {academicOverview && (
                <div className={styles.metricGrid}>
                  <div className={styles.metricCard}>
                    <div className={styles.metricHeader}>
                      <span className={styles.metricLabel}>Total Practicals</span>
                      <div className={styles.metricIcon} style={{ background: '#eef2ff', color: '#4f46e5' }}>
                        <FileText size={18} />
                      </div>
                    </div>
                    <div className={styles.metricValue}>{academicOverview.totalAssigned}</div>
                    <div className={styles.metricSubtext}>Assigned for semester {semester}</div>
                  </div>

                  <div className={styles.metricCard}>
                    <div className={styles.metricHeader}>
                      <span className={styles.metricLabel}>Completed</span>
                      <div className={styles.metricIcon} style={{ background: '#ecfdf5', color: '#059669' }}>
                        <CheckCircle2 size={18} />
                      </div>
                    </div>
                    <div className={styles.metricValue} style={{ color: '#059669' }}>
                      {academicOverview.completed}
                    </div>
                    <div className={styles.metricSubtext}>Finished submissions</div>
                  </div>

                  <div className={styles.metricCard}>
                    <div className={styles.metricHeader}>
                      <span className={styles.metricLabel}>Pending</span>
                      <div className={styles.metricIcon} style={{ background: '#fff7ed', color: '#ea580c' }}>
                        <Clock size={18} />
                      </div>
                    </div>
                    <div className={styles.metricValue} style={{ color: '#ea580c' }}>
                      {academicOverview.pending}
                    </div>
                    <div className={styles.metricSubtext}>Due or incomplete</div>
                  </div>

                  <div className={styles.metricCard}>
                    <div className={styles.metricHeader}>
                      <span className={styles.metricLabel}>Avg. Score</span>
                      <div className={styles.metricIcon} style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                        <Award size={18} />
                      </div>
                    </div>
                    <div className={styles.metricValue} style={{ color: '#7c3aed' }}>
                      {academicOverview.averageMarks !== null ? `${academicOverview.averageMarks}%` : '—'}
                    </div>
                    <div className={styles.metricSubtext}>Normalized marks</div>
                  </div>
                </div>
              )}

              {/* Enrolled Courses */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2 className={styles.sectionTitle}>
                      <BookOpen size={20} color="#4f46e5" />
                      Enrolled Courses &amp; Subjects
                    </h2>
                    <div className={styles.sectionSubtitle}>
                      Active curriculum for Semester {semester}
                    </div>
                  </div>
                  <span className={styles.summaryChip}>{courses.length} Courses</span>
                </div>

                {courses.length === 0 ? (
                  <div className={styles.emptyState}>No courses registered for semester {semester}.</div>
                ) : (
                  <div className={styles.courseGrid}>
                    {courses.map((c) => (
                      <div key={c.id} className={styles.courseCard}>
                        <div className={styles.courseHeader}>
                          <span className={styles.courseCode}>{c.course_code}</span>
                          <span className={styles.courseSemester}>Semester {c.semester}</span>
                        </div>
                        <div className={styles.courseName}>{c.name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Practicals Tracker */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2 className={styles.sectionTitle}>
                      <FileText size={20} color="#4f46e5" />
                      Problems &amp; Practicals Tracker
                    </h2>
                    <div className={styles.sectionSubtitle}>
                      All assigned programming exercises and their status
                    </div>
                  </div>
                  <div className={styles.summaryChips}>
                    <span className={`${styles.summaryChip} ${styles.chipCompleted}`}>
                      {practicals.filter((p) => p.status === 'done' || p.status === 'submitted').length} Done
                    </span>
                    <span className={`${styles.summaryChip} ${styles.chipPastDue}`}>
                      {practicals.filter((p) => p.status === 'past_due').length} Past Due
                    </span>
                    <span className={`${styles.summaryChip} ${styles.chipUpcoming}`}>
                      {practicals.filter((p) => p.status === 'upcoming').length} Upcoming
                    </span>
                  </div>
                </div>

                {sortedTasks.length === 0 ? (
                  <div className={styles.emptyState}>No practicals currently assigned.</div>
                ) : (
                  <div className={styles.trackerList}>
                    <div className={styles.trackerListHeader}>
                      <div>Problem / Practical Name</div>
                      <div>Course</div>
                      <div>Due Date</div>
                      <div>Score</div>
                      <div>Status</div>
                    </div>
                    {sortedTasks.map((task) => (
                      <Link
                        key={task.id}
                        href={`/student/code/practical_${task.id}?subject=${task.course_code || task.course}`}
                        className={styles.trackerRow}
                      >
                        <div className={styles.taskName}>{task.name}</div>
                        <div className={styles.taskCourse}>{task.course_code || task.course}</div>
                        <div className={styles.taskDate}>
                          {task.dueDate
                            ? new Date(task.dueDate).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })
                            : '—'}
                        </div>
                        <div className={styles.taskMarks}>
                          {task.normalizedMarks !== null && task.normalizedMarks !== undefined
                            ? `${task.normalizedMarks} / ${task.totalMarks || 100}`
                            : '—'}
                        </div>
                        <div
                          className={`${styles.taskStatus} ${
                            task.status === 'done'
                              ? styles.statusDone
                              : task.status === 'submitted'
                              ? styles.statusDone
                              : task.status === 'past_due'
                              ? styles.statusPastDue
                              : task.status === 'upcoming'
                              ? styles.statusUpcoming
                              : styles.statusNotStarted
                          }`}
                        >
                          {statusLabel(task.status)}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══════════════ FACULTY VIEW ═══════════════ */}
          {user.role === 'faculty' && (
            <>
              {/* Faculty Metrics */}
              <div className={styles.metricGrid}>
                <div className={styles.metricCard}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricLabel}>Assigned Courses</span>
                    <div className={styles.metricIcon} style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                      <BookOpen size={18} />
                    </div>
                  </div>
                  <div className={styles.metricValue}>{courses.length}</div>
                  <div className={styles.metricSubtext}>Subjects coordinated</div>
                </div>

                <div className={styles.metricCard}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricLabel}>Practicals Managed</span>
                    <div className={styles.metricIcon} style={{ background: '#eef2ff', color: '#4f46e5' }}>
                      <FileText size={18} />
                    </div>
                  </div>
                  <div className={styles.metricValue}>{practicals.length}</div>
                  <div className={styles.metricSubtext}>Assignments created</div>
                </div>
              </div>

              {/* Assigned Courses */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2 className={styles.sectionTitle}>
                      <BookOpen size={20} color="#7c3aed" />
                      Assigned Subjects &amp; Courses
                    </h2>
                    <div className={styles.sectionSubtitle}>
                      Courses and subjects under your instructional purview
                    </div>
                  </div>
                  <span className={styles.summaryChip}>{courses.length} Courses</span>
                </div>

                {courses.length === 0 ? (
                  <div className={styles.emptyState}>No courses currently assigned to this faculty member.</div>
                ) : (
                  <div className={styles.courseGrid}>
                    {courses.map((c) => (
                      <div key={c.id} className={styles.courseCard}>
                        <div className={styles.courseHeader}>
                          <span className={styles.courseCode}>{c.course_code}</span>
                          <span className={styles.courseSemester}>Sem {c.semester}</span>
                        </div>
                        <div className={styles.courseName}>{c.name}</div>
                        {c.is_co_coordinator && (
                          <span className={styles.courseCoordinator}>Co-Coordinator</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Practicals Created */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2 className={styles.sectionTitle}>
                      <FileText size={20} color="#7c3aed" />
                      Managed Practicals &amp; Assignments
                    </h2>
                    <div className={styles.sectionSubtitle}>
                      Assignments set up for student practical labs
                    </div>
                  </div>
                  <Link href="/faculty?tab=practicals" className={styles.btnBack} style={{ fontSize: '12px' }}>
                    Manage in Dashboard <ExternalLink size={14} />
                  </Link>
                </div>

                {practicals.length === 0 ? (
                  <div className={styles.emptyState}>No practical assignments created yet.</div>
                ) : (
                  <div className={styles.trackerList}>
                    <div className={styles.trackerListHeader} style={{ gridTemplateColumns: '2fr 1fr 1fr 120px' }}>
                      <div>Practical Title</div>
                      <div>Course</div>
                      <div>Due Date</div>
                      <div>Submissions</div>
                    </div>
                    {practicals.map((p) => (
                      <div
                        key={p.id}
                        className={styles.trackerRow}
                        style={{ gridTemplateColumns: '2fr 1fr 1fr 120px' }}
                      >
                        <div className={styles.taskName}>{p.name}</div>
                        <div className={styles.taskCourse}>{p.course_code || p.course}</div>
                        <div className={styles.taskDate}>
                          {p.dueDate
                            ? new Date(p.dueDate).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })
                            : '—'}
                        </div>
                        <div className={styles.taskMarks}>
                          {p.submissionsCount} received
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══════════════ ADMIN VIEW ═══════════════ */}
          {user.role === 'admin' && (
            <>
              {/* System Stats Overview */}
              {systemStats && (
                <div className={styles.metricGrid}>
                  <div className={styles.metricCard}>
                    <div className={styles.metricHeader}>
                      <span className={styles.metricLabel}>Students</span>
                      <div className={styles.metricIcon} style={{ background: '#ecfeff', color: '#0e7490' }}>
                        <GraduationCap size={18} />
                      </div>
                    </div>
                    <div className={styles.metricValue}>{systemStats.students}</div>
                    <div className={styles.metricSubtext}>Registered students</div>
                  </div>

                  <div className={styles.metricCard}>
                    <div className={styles.metricHeader}>
                      <span className={styles.metricLabel}>Faculty</span>
                      <div className={styles.metricIcon} style={{ background: '#f5f3ff', color: '#6d28d9' }}>
                        <School size={18} />
                      </div>
                    </div>
                    <div className={styles.metricValue}>{systemStats.faculty}</div>
                    <div className={styles.metricSubtext}>Active faculty staff</div>
                  </div>

                  <div className={styles.metricCard}>
                    <div className={styles.metricHeader}>
                      <span className={styles.metricLabel}>Courses</span>
                      <div className={styles.metricIcon} style={{ background: '#eef2ff', color: '#4338ca' }}>
                        <BookOpen size={18} />
                      </div>
                    </div>
                    <div className={styles.metricValue}>{systemStats.courses}</div>
                    <div className={styles.metricSubtext}>Total curriculum courses</div>
                  </div>

                  <div className={styles.metricCard}>
                    <div className={styles.metricHeader}>
                      <span className={styles.metricLabel}>Practicals</span>
                      <div className={styles.metricIcon} style={{ background: '#ecfdf5', color: '#059669' }}>
                        <FileText size={18} />
                      </div>
                    </div>
                    <div className={styles.metricValue}>{systemStats.practicals}</div>
                    <div className={styles.metricSubtext}>Total coding exercises</div>
                  </div>
                </div>
              )}

              {/* Administrative Quick Actions */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2 className={styles.sectionTitle}>
                      <Layers size={20} color="#4f46e5" />
                      Administrative Control Center
                    </h2>
                    <div className={styles.sectionSubtitle}>
                      Direct access to core system and user management modules
                    </div>
                  </div>
                </div>

                <div className={styles.quickLinkGrid}>
                  <Link href="/admin/students" className={styles.quickLinkCard}>
                    <div className={styles.quickLinkIcon}>
                      <GraduationCap size={20} />
                    </div>
                    <div className={styles.quickLinkText}>
                      <div className={styles.quickLinkTitle}>Manage Students</div>
                      <div className={styles.quickLinkDesc}>Add, edit, and organize students</div>
                    </div>
                  </Link>

                  <Link href="/admin/faculty" className={styles.quickLinkCard}>
                    <div className={styles.quickLinkIcon}>
                      <School size={20} />
                    </div>
                    <div className={styles.quickLinkText}>
                      <div className={styles.quickLinkTitle}>Manage Faculty</div>
                      <div className={styles.quickLinkDesc}>Faculty staff &amp; coordinators</div>
                    </div>
                  </Link>

                  <Link href="/admin/courses" className={styles.quickLinkCard}>
                    <div className={styles.quickLinkIcon}>
                      <BookOpen size={20} />
                    </div>
                    <div className={styles.quickLinkText}>
                      <div className={styles.quickLinkTitle}>Manage Courses</div>
                      <div className={styles.quickLinkDesc}>Curriculum subjects &amp; semesters</div>
                    </div>
                  </Link>

                  <Link href="/admin/departments" className={styles.quickLinkCard}>
                    <div className={styles.quickLinkIcon}>
                      <Users size={20} />
                    </div>
                    <div className={styles.quickLinkText}>
                      <div className={styles.quickLinkTitle}>Departments</div>
                      <div className={styles.quickLinkDesc}>Divisions and academic branches</div>
                    </div>
                  </Link>

                  <Link href="/admin/settings" className={styles.quickLinkCard}>
                    <div className={styles.quickLinkIcon}>
                      <Settings size={20} />
                    </div>
                    <div className={styles.quickLinkText}>
                      <div className={styles.quickLinkTitle}>Account Settings</div>
                      <div className={styles.quickLinkDesc}>Security and profile options</div>
                    </div>
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEdit && (
        <EditProfileModal
          user={user}
          onClose={() => setShowEdit(false)}
          onSave={handleSaveProfile}
        />
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </div>
  );
}
