/**
 * apps/web/src/features/users/credential-pdf.js
 *
 * Client-side credential PDF generation for users, faculty, and students.
 * Dynamically loads jspdf and jspdf-autotable in browser context to avoid
 * server bundling and prevent core package contamination.
 */

async function loadPdfModules() {
  const mPdf = await import('jspdf');
  const mTable = await import('jspdf-autotable');

  const jsPDF = mPdf.jsPDF || (typeof mPdf.default === 'function' ? mPdf.default : mPdf.default?.jsPDF);
  const autoTable = (typeof mTable.default === 'function' ? mTable.default : mTable.default?.default) || mTable.autoTable;

  return { jsPDF, autoTable };
}

function applyAutoTable(doc, autoTable, options) {
  if (typeof doc.autoTable === 'function') {
    doc.autoTable(options);
  } else if (typeof autoTable === 'function') {
    autoTable(doc, options);
  } else {
    throw new Error('autoTable plugin is not available on jsPDF instance');
  }
}

/**
 * Generic user credential PDF export (preserves original @coderank/core API contract).
 * @param {object|object[]} users Single user or array of users: { name, email, role, rawPassword }
 */
export async function generateUserCredentialsPDF(users) {
  if (typeof window === 'undefined') {
    throw new Error('generateUserCredentialsPDF can only be called in a browser context.');
  }

  const { jsPDF, autoTable } = await loadPdfModules();
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

  applyAutoTable(doc, autoTable, {
    head: [tableColumn],
    body: tableRows,
    startY: 45,
    theme: 'grid',
    styles: { fontSize: 10 },
    headStyles: { fillColor: [90, 106, 252] },
  });

  doc.save(`CodeRank_Credentials_${Date.now()}.pdf`);
  return doc;
}

/**
 * Faculty credentials PDF export with department and designation columns.
 * @param {object[]} users Array of faculty user objects with extra_info
 */
export async function downloadFacultyCredentialsPDF(users) {
  if (typeof window === 'undefined') {
    throw new Error('downloadFacultyCredentialsPDF can only be called in a browser context.');
  }

  const { jsPDF, autoTable } = await loadPdfModules();
  const doc = new jsPDF();
  const usersList = Array.isArray(users) ? users : [users];

  doc.setFontSize(18);
  doc.setTextColor(79, 70, 229);
  doc.text('CodeRank — Faculty Credentials', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}  |  CONFIDENTIAL — delete after distribution`, 14, 28);

  applyAutoTable(doc, autoTable, {
    startY: 35,
    head: [['Name', 'Email', 'Department', 'Designation', 'Password']],
    body: usersList.map((u) => [
      u.name,
      u.email,
      u.extra_info?.department || '-',
      u.extra_info?.designation || '-',
      u.rawPassword,
    ]),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 255] },
  });

  doc.save(`CodeRank_Faculty_${Date.now()}.pdf`);
  return doc;
}

/**
 * Student credentials PDF export with roll number, department, division, and semester columns.
 * @param {object[]} users Array of student user objects with extra_info
 */
export async function downloadStudentCredentialsPDF(users) {
  if (typeof window === 'undefined') {
    throw new Error('downloadStudentCredentialsPDF can only be called in a browser context.');
  }

  const { jsPDF, autoTable } = await loadPdfModules();
  const doc = new jsPDF();
  const usersList = Array.isArray(users) ? users : [users];

  doc.setFontSize(18);
  doc.setTextColor(79, 70, 229);
  doc.text('CodeRank — Student Credentials', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}  |  CONFIDENTIAL — delete after distribution`, 14, 28);

  applyAutoTable(doc, autoTable, {
    startY: 35,
    head: [['Name', 'Email', 'Roll No', 'Department', 'Division', 'Semester', 'Password']],
    body: usersList.map((u) => [
      u.name,
      u.email,
      u.extra_info?.roll_number || '-',
      u.extra_info?.department || '-',
      u.extra_info?.division || '-',
      u.extra_info?.semester || '-',
      u.rawPassword,
    ]),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 255] },
  });

  doc.save(`CodeRank_Students_${Date.now()}.pdf`);
  return doc;
}
