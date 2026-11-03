/**
 * apps/web/src/lib/pdfGenerator.js
 * Temporary web facade re-exporting PDF generation from ../features/users/credential-pdf.js
 */
export {
  generateUserCredentialsPDF,
  downloadFacultyCredentialsPDF,
  downloadStudentCredentialsPDF,
} from '../features/users/credential-pdf.js';
