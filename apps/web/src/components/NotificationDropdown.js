'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCircle2, Clock, AlertCircle, FileText, Check, ExternalLink } from 'lucide-react';

/**
 * NotificationDropdown
 * --------------------
 * Functional notification bell and dropdown panel supporting Admin, Faculty, and Students.
 * Fetches real activity/notification records based on role, manages read/unread status in localStorage,
 * and allows marking notifications as read.
 */
export default function NotificationDropdown({ user }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef(null);

  const role = user?.role || 'student';
  const userId = user?.id || 0;
  const storageKey = `coderank_read_notifications_${userId}_${role}`;

  // Fetch contextual notification data
  const fetchNotifications = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setLoading(true);
    try {
      if (role === 'admin') {
        // Fetch recent activity logs for admin notifications
        const res = await fetch('/api/logs?limit=6', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const logs = await res.json();
          const readIds = JSON.parse(localStorage.getItem(storageKey) || '[]');
          const formatted = (logs || []).map((log) => ({
            id: `log_${log.id}`,
            title: log.action || 'System Event',
            message: log.details || `Action performed by ${log.user_name || 'System'}`,
            time: log.created_at,
            type: log.action?.includes('CREATE') ? 'success' : log.action?.includes('DELETE') ? 'alert' : 'info',
            isRead: readIds.includes(`log_${log.id}`),
            link: '/admin/logs'
          }));
          setNotifications(formatted);
          setUnreadCount(formatted.filter((n) => !n.isRead).length);
        }
      } else if (role === 'faculty') {
        // Fetch recent practicals / submissions for faculty
        const res = await fetch('/api/faculty/courses', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const courses = await res.json();
          const readIds = JSON.parse(localStorage.getItem(storageKey) || '[]');
          const formatted = (courses || []).slice(0, 5).map((c, idx) => ({
            id: `course_${c.id || idx}`,
            title: `Assigned: ${c.course_code || 'Course'}`,
            message: `${c.name || 'Course'} is active for this semester`,
            time: new Date().toISOString(),
            type: 'info',
            isRead: readIds.includes(`course_${c.id || idx}`),
            link: '/faculty'
          }));
          setNotifications(formatted);
          setUnreadCount(formatted.filter((n) => !n.isRead).length);
        }
      } else {
        // Student notifications: fetch assigned practicals
        const res = await fetch('/api/student/practicals', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const practicals = await res.json();
          const readIds = JSON.parse(localStorage.getItem(storageKey) || '[]');
          const formatted = (Array.isArray(practicals) ? practicals : []).slice(0, 5).map((p) => {
            const due = p.end_time ? new Date(p.end_time) : null;
            const isDueSoon = due && due.getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;
            return {
              id: `prac_${p.id}`,
              title: isDueSoon ? `Due Soon: ${p.title}` : `Practical: ${p.title}`,
              message: `${p.course_name || 'Course'} • ${p.total_marks || 10} marks`,
              time: p.end_time || new Date().toISOString(),
              type: isDueSoon ? 'alert' : 'info',
              isRead: readIds.includes(`prac_${p.id}`),
              link: '/student'
            };
          });
          setNotifications(formatted);
          setUnreadCount(formatted.filter((n) => !n.isRead).length);
        }
      }
    } catch (err) {
      console.warn('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [role, userId]);

  // Click outside to close
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    localStorage.setItem(storageKey, JSON.stringify(allIds));
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const markAsRead = (id, link) => {
    const readIds = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (!readIds.includes(id)) {
      readIds.push(id);
      localStorage.setItem(storageKey, JSON.stringify(readIds));
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setIsOpen(false);
    if (link) {
      router.push(link);
    }
  };

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="View notifications"
        style={{
          background: 'none',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          width: '38px',
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
          color: '#475569',
          transition: 'all 0.15s ease',
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: '#ef4444',
              color: 'white',
              fontSize: '10px',
              fontWeight: 700,
              borderRadius: '9999px',
              padding: '1px 5px',
              minWidth: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 0 2px white',
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '340px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>Notifications</span>
              {unreadCount > 0 && (
                <span
                  style={{
                    backgroundColor: '#e0e7ff',
                    color: '#4338ca',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '999px',
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '12px',
                  color: '#4f46e5',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '30px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                <CheckCircle2 size={24} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
                No new notifications
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id, n.link)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    backgroundColor: n.isRead ? '#ffffff' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: n.type === 'alert' ? '#fef2f2' : n.type === 'success' ? '#ecfdf5' : '#eff6ff',
                      color: n.type === 'alert' ? '#ef4444' : n.type === 'success' ? '#10b981' : '#3b82f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    {n.type === 'alert' ? <AlertCircle size={14} /> : n.type === 'success' ? <CheckCircle2 size={14} /> : <FileText size={14} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: n.isRead ? 600 : 700, color: '#1e293b' }}>
                        {n.title}
                      </span>
                      {!n.isRead && (
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#4f46e5' }} />
                      )}
                    </div>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                      {n.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {role === 'admin' && (
            <div
              style={{
                padding: '8px 16px',
                textAlign: 'center',
                borderTop: '1px solid #f1f5f9',
                backgroundColor: '#f8fafc',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  router.push('/admin/logs');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '12px',
                  color: '#4f46e5',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>View Full System Logs</span>
                <ExternalLink size={12} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
