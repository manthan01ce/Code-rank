'use client';

import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const generateUserCredentialsPDF = (users) => {
  const doc = new jsPDF();
  
  // Array of users if bulk, array of 1 if single
  const usersList = Array.isArray(users) ? users : [users];

  doc.setFontSize(20);
  doc.text('User Credentials (CONFIDENTIAL)', 14, 22);
  
  doc.setFontSize(12);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
  doc.text('Please distribute these securely and delete this file after use.', 14, 38);

  const tableColumn = ["Name", "Email", "Role", "Password"];
  const tableRows = [];

  usersList.forEach(user => {
    const userData = [
      user.name,
      user.email,
      user.role,
      user.rawPassword // The raw generated password returned from API
    ];
    tableRows.push(userData);
  });

  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 45,
    theme: 'grid',
    styles: { fontSize: 10 },
    headStyles: { fillColor: [90, 106, 252] } // var(--primary)
  });

  doc.save(`CodeRank_Credentials_${Date.now()}.pdf`);
};
