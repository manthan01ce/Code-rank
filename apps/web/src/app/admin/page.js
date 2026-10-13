'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  FileText, 
  ScrollText, 
  ArrowRight, 
  Radio, 
  Download, 
  Sparkles 
} from 'lucide-react';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useSocket } from '@/hooks/useSocket';
import RefreshButton from '@/components/RefreshButton';

export default function AdminDashboard() {
  const router = useRouter();
  const socket = useSocket();
  const [stats, setStats] = useState({ faculty: 0, students: 0, courses: 0, practicals: 0 });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const { token, isReady } = useAdminAuth();

  const fetchDashboardData = useCallback(async () => {
    if (!token) return;
    try {
      const [statsRes, logsRes] = await Promise.all([
        fetch('/api/stats', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/logs?limit=8', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (statsRes.status === 401 || logsRes.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
        return;
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData);
      }
      setLastUpdated(new Date());
    } catch (e) {
      console.error('[AdminDashboard] Fetch error:', e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Initial fetch on mount
  useEffect(() => {
    if (isReady) {
      fetchDashboardData();
    }
  }, [isReady, fetchDashboardData]);

  // Real-time synchronization via WebSockets (NO polling)
  useEffect(() => {
    if (!socket) return;

    // Join admin room
    socket.emit('join_admin_room');

    const handleNewActivity = (activity) => {
      if (activity && activity.id) {
        setLogs((prev) => [activity, ...prev.slice(0, 7)]);
      } else {
        fetchDashboardData();
      }
    };

    const handleStatsChanged = () => {
      fetchDashboardData();
    };

    socket.on('admin_activity', handleNewActivity);
    socket.on('admin_stats_changed', handleStatsChanged);
    socket.on('new_submission', handleStatsChanged);
    socket.on('practical_added', handleStatsChanged);
    socket.on('practical_deleted', handleStatsChanged);

    return () => {
      socket.emit('leave_admin_room');
      socket.off('admin_activity', handleNewActivity);
      socket.off('admin_stats_changed', handleStatsChanged);
      socket.off('new_submission', handleStatsChanged);
      socket.off('practical_added', handleStatsChanged);
      socket.off('practical_deleted', handleStatsChanged);
    };
  }, [socket, fetchDashboardData]);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const downloadDocs = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(79, 70, 229);
      doc.text('CodeRank Backend Architecture Guide', 14, 22);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()} | System Documentation`, 14, 30);
      doc.line(14, 33, 196, 33);
      
      let y = 42;
      const printSectionHeader = (title) => {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text(title, 14, y);
        y += 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
      };

      const printParagraph = (text) => {
        const lines = doc.splitTextToSize(text, 180);
        lines.forEach(line => {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.text(line, 14, y);
          y += 6;
        });
        y += 4;
      };

      printSectionHeader('1. Executive Overview');
      printParagraph('CodeRank is an enterprise educational management and automated code-evaluation platform. It uses Neon PostgreSQL with connection pooling, Docker runner daemons for code sandboxing, and Socket.IO for real-time telemetry.');

      printSectionHeader('2. Real-Time Synchronization');
      printParagraph('Administrators and Faculty connect to Socket.IO rooms for zero-latency updates upon submissions, practical modifications, and system events. Students utilize adaptive polling with Page Visibility awareness.');

      printSectionHeader('3. Security & Access Control');
      printParagraph('Role-Based Access Control restricts student and faculty privileges to authorized scopes. Passwords are salted and hashed via bcrypt (10 rounds), and session tokens carry 24-hour validity.');

      doc.save('CodeRank_System_Documentation.pdf');
    } catch (e) {
      console.error('Error generating documentation PDF:', e);
      alert('Unable to generate documentation PDF. Please try again.');
    }
  };

  const isSocketConnected = socket?.isConnected ?? false;

  return (
    <div style={{ paddingBottom: '40px' }}>
      {loading && <LoadingOverlay />}

      {/* Header */}
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: '800', color: '#1e293b', margin: '0 0 6px 0' }}>
            Administration Command Center
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
              Live metrics and institutional operations oversight.
            </p>
            {/* Live WebSocket Status Indicator */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '999px',
                backgroundColor: isSocketConnected ? '#ecfdf5' : '#fffbeb',
                color: isSocketConnected ? '#059669' : '#d97706',
                border: `1px solid ${isSocketConnected ? '#a7f3d0' : '#fde68a'}`,
              }}
              title={isSocketConnected ? 'Connected to WebSocket server' : 'Reconnecting to WebSocket server'}
            >
              <Radio size={12} style={{ animation: isSocketConnected ? 'pulse 2s infinite' : 'none' }} />
              {isSocketConnected ? 'WebSocket Live' : 'Reconnecting...'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={downloadDocs}
            aria-label="Download system architecture documentation"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <Download size={14} />
            <span>Architecture PDF</span>
          </button>

          <RefreshButton
            onRefresh={fetchDashboardData}
            lastUpdated={lastUpdated}
            label="Refresh"
            variant="default"
          />
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="stat-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div 
          className="stat-card" 
          onClick={() => router.push('/admin/faculty')}
          style={{ cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Faculty Members</span>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} />
            </div>
          </div>
          <p style={{ fontSize: '32px', fontWeight: '800', color: '#1e293b', margin: '0 0 6px 0' }}>
            {stats.faculty ?? 0}
          </p>
          <span style={{ fontSize: '12px', color: '#4f46e5', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span>Manage faculty</span>
            <ArrowRight size={12} />
          </span>
        </div>
        
        <div 
          className="stat-card" 
          onClick={() => router.push('/admin/students')}
          style={{ cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Active Students</span>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={20} />
            </div>
          </div>
          <p style={{ fontSize: '32px', fontWeight: '800', color: '#1e293b', margin: '0 0 6px 0' }}>
            {stats.students ?? 0}
          </p>
          <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span>Manage students</span>
            <ArrowRight size={12} />
          </span>
        </div>

        <div 
          className="stat-card" 
          onClick={() => router.push('/admin/courses')}
          style={{ cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Registered Courses</span>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={20} />
            </div>
          </div>
          <p style={{ fontSize: '32px', fontWeight: '800', color: '#1e293b', margin: '0 0 6px 0' }}>
            {stats.courses ?? 0}
          </p>
          <span style={{ fontSize: '12px', color: '#d97706', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span>Manage courses</span>
            <ArrowRight size={12} />
          </span>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="table-container" style={{ border: '1px solid #e2e8f0', borderRadius: '14px', backgroundColor: '#ffffff', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px 0' }}>
              Live System Activity Logs
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              Audit events captured across authentication, user management, and submissions.
            </p>
          </div>
          <button 
            type="button"
            className="btn-small" 
            onClick={() => router.push('/admin/logs')}
            style={{ 
              color: '#4f46e5', 
              background: '#eef2ff',
              border: 'none', 
              fontWeight: '600', 
              padding: '8px 14px', 
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px'
            }}
          >
            <span>View All Logs</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Details</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px 16px', fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>
                    {log.user_name || 'System Admin'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ 
                      padding: '4px 10px', 
                      borderRadius: '20px', 
                      fontSize: '11px', 
                      fontWeight: '700',
                      letterSpacing: '0.02em',
                      backgroundColor: log.action?.includes('CREATE') ? '#ecfdf5' : log.action?.includes('LOGIN') ? '#eff6ff' : log.action?.includes('DELETE') ? '#fef2f2' : '#fef3c7',
                      color: log.action?.includes('CREATE') ? '#059669' : log.action?.includes('LOGIN') ? '#2563eb' : log.action?.includes('DELETE') ? '#dc2626' : '#d97706'
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>
                    {log.details}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {formatDate(log.created_at)}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8', padding: '48px 16px', fontSize: '14px' }}>
                    <ScrollText size={32} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
                    No recent activity logs recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
