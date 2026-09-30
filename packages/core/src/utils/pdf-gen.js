/**
 * packages/core/src/utils/pdf-gen.js — PDF generation utility
 *
 * NOTE: jsPDF runs in the browser only. This file is used by the web app
 * on the CLIENT side (not in API routes). It is placed in core so future
 * server-side PDF generation (e.g. via puppeteer in the worker) can be
 * added here without touching app code.
 *
 * Usage (web, client component):
 *   import { generateUserCredentialsPDF } from '@coderank/core/utils/pdf-gen';
 */

/**
 * @param {object|object[]} users  Single user or array of users.
 * Each user must have: { name, email, role, rawPassword }
 */
export const generateUserCredentialsPDF = (users) => {
  // Dynamic import to keep jsPDF browser-only
  if (typeof window === 'undefined') {
    throw new Error('generateUserCredentialsPDF can only be called in a browser context.');
  }

  // jsPDF is expected to be available via the web app's dependencies
  const { default: jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF();
  const usersList = Array.isArray(users) ? users : [users];

  doc.setFontSize(20);
  doc.text('User Credentials (CONFIDENTIAL)', 14, 22);

  doc.setFontSize(12);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
  doc.text('Please distribute these securely and delete this file after use.', 14, 38);

  const tableColumn = ['Name', 'Email', 'Role', 'Password'];
  const tableRows = usersList.map((user) => [
    user.name,
    user.email,
    user.role,
    user.rawPassword,
  ]);

  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 45,
    theme: 'grid',
    styles: { fontSize: 10 },
    headStyles: { fillColor: [90, 106, 252] },
  });

  doc.save(`CodeRank_Credentials_${Date.now()}.pdf`);
};
