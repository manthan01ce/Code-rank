'use client';

import { useState, useEffect } from 'react';
import LoadingOverlay from '@/components/LoadingOverlay';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ faculty: 0, students: 0, courses: 0 });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const [statsRes, logsRes] = await Promise.all([
        fetch('/api/stats', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/logs?limit=8', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const downloadDocs = async () => {
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
    printParagraph('CodeRank is a secure, serverless coding playground and dynamic practical management system built on Next.js 16. The backend leverages Neon Serverless Postgres for relational storage and local/remote Docker compiler containers for sandboxed standard I/O execution.');

    printSectionHeader('2. Database Schema Architecture');
    printParagraph('The relational database uses Neon Postgres and comprises key tables:\n' +
      '- users: Mapped to email, password, and roles (admin, faculty, student).\n' +
      '- courses: Tracks name, course_code, status, and semester.\n' +
      '- practicals: Stores title, description, allowed_languages, difficulty, and total_marks.\n' +
      '- practical_test_cases: Maps input, expected output, and partial marks per case.\n' +
      '- practical_submissions: Stores user code, selected language, status, and score results.\n' +
      '- practical_submission_cases: Granular evaluation report per test case.');

    printSectionHeader('3. Dynamic Execution & Sandboxing');
    printParagraph('When a student runs or submits code, the request is intercepted by language execution managers (python-run, cpp-run, java-run, c-run, javascript-run). It mounts the source code and input text inside isolated Docker containers, compiles if necessary, and executes the program safely under resource constraints (128MB memory limit, 5s timeout).');

    printSectionHeader('4. Grading and Normalization Formula');
    printParagraph('During submission, the system evaluates all test cases. The raw marks are aggregated. The overall score is then normalized to a 10-point scale using the formula:\n' +
      '   Normalized Marks = (Raw Marks / Total Marks) * 10\n' +
      'The result is rounded to 2 decimal places and stored in the database.');

    doc.save('CodeRank_Backend_Architecture.pdf');
  };

  return (
    <div>
      {loading && <LoadingOverlay />}
      <div className="header">
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '700' }}>Dashboard Overview</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Welcome back to your administration command center.</p>
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
             <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px', margin: 0 }} onClick={fetchDashboardData}>
               Refresh Data
             </button>
        </div>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3>Faculty Members</h3>
                <span style={{ fontSize: '20px' }}>👨‍🏫</span>
            </div>
            <p style={{ fontSize: '32px', fontWeight: '800', color: 'var(--primary)' }}>
              {stats.faculty}
            </p>
          </div>
          <div style={{ marginTop: '15px', fontSize: '12px', color: '#10b981' }}>
             ↑ 12% from last month
          </div>
        </div>
        
        <div className="stat-card">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3>Active Students</h3>
                <span style={{ fontSize: '20px' }}>🎓</span>
            </div>
            <p style={{ fontSize: '32px', fontWeight: '800', color: '#10b981' }}>
              {stats.students}
            </p>
          </div>
          <div style={{ marginTop: '15px', fontSize: '12px', color: '#10b981' }}>
             ↑ 5% from last month
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3>Ongoing Courses</h3>
                <span style={{ fontSize: '20px' }}>📚</span>
            </div>
            <p style={{ fontSize: '32px', fontWeight: '800', color: '#f59e0b' }}>
              {stats.courses}
            </p>
          </div>
          <div style={{ marginTop: '15px', fontSize: '12px', color: '#888' }}>
             Stabilized
          </div>
        </div>
      </div>

      <div className="table-container" style={{ border: '1px solid var(--border-color)', boxShadow: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Recent Activity</h3>
            <button className="btn-small" style={{ color: 'var(--primary)', border: 'none', fontWeight: '600' }}>View All Logs</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Action</th>
              <th>Details</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td style={{ fontWeight: '500' }}>{log.user_name || 'System'}</td>
                <td>
                    <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '20px', 
                        fontSize: '11px', 
                        fontWeight: '600',
                        backgroundColor: log.action.includes('CREATE') ? '#ecfdf5' : log.action.includes('LOGIN') ? '#eff6ff' : '#fef3c7',
                        color: log.action.includes('CREATE') ? '#10b981' : log.action.includes('LOGIN') ? '#3b82f6' : '#f59e0b'
                    }}>
                        {log.action}
                    </span>
                </td>
                <td style={{ color: '#4b5563' }}>{log.details}</td>
                <td style={{ color: '#94a3b8', fontSize: '12px' }}>{formatDate(log.created_at)}</td>
              </tr>
            ))}
            {logs.length === 0 && !loading && (
              <tr><td colSpan="4" style={{ textAlign: 'center', color: '#888', padding: '40px' }}>No activity logs found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
