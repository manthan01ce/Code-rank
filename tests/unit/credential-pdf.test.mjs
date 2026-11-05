import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  generateUserCredentialsPDF,
  downloadFacultyCredentialsPDF,
  downloadStudentCredentialsPDF,
} from '../../apps/web/src/features/users/credential-pdf.js';
import * as pdfFeature from '../../apps/web/src/features/users/credential-pdf.js';

test('credential PDF functions reject execution outside of a browser window', async () => {
  const originalWindow = globalThis.window;
  delete globalThis.window;

  try {
    await assert.rejects(
      () => generateUserCredentialsPDF([{ name: 'Test', email: 'test@example.com', role: 'student', rawPassword: 'secret' }]),
      /generateUserCredentialsPDF can only be called in a browser context/
    );

    await assert.rejects(
      () => downloadFacultyCredentialsPDF([{ name: 'Prof', email: 'prof@example.com', rawPassword: 'secret' }]),
      /downloadFacultyCredentialsPDF can only be called in a browser context/
    );

    await assert.rejects(
      () => downloadStudentCredentialsPDF([{ name: 'Student', email: 'stu@example.com', rawPassword: 'secret' }]),
      /downloadStudentCredentialsPDF can only be called in a browser context/
    );
  } finally {
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    }
  }
});

test('credential PDF feature exposes the authoritative browser methods', () => {
  assert.equal(typeof pdfFeature.generateUserCredentialsPDF, 'function');
  assert.equal(typeof pdfFeature.downloadFacultyCredentialsPDF, 'function');
  assert.equal(typeof pdfFeature.downloadStudentCredentialsPDF, 'function');
});

test('credential PDF generation constructs valid document with synthetic non-sensitive data', async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    atob: globalThis.atob.bind(globalThis),
    btoa: globalThis.btoa.bind(globalThis),
    document: {},
  };

  const originalCwd = process.cwd();
  const outputDir = fs.mkdtempSync(path.join(tmpdir(), 'coderank-pdf-'));
  process.chdir(outputDir);

  try {
    const syntheticUsers = [
      { name: 'Synthetic Student', email: 'student@example.test', role: 'student', rawPassword: 'mock-password-123' },
    ];

    const genericDoc = await generateUserCredentialsPDF(syntheticUsers);
    assert.ok(genericDoc, 'Expected generic jsPDF document instance');

    const facultyDoc = await downloadFacultyCredentialsPDF([
      {
        name: 'Synthetic Faculty',
        email: 'faculty@example.test',
        extra_info: { department: 'Computer Engineering', designation: 'Assistant Professor' },
        rawPassword: 'mock-faculty-password',
      },
    ]);
    assert.ok(facultyDoc, 'Expected faculty jsPDF document instance');

    const studentDoc = await downloadStudentCredentialsPDF([
      {
        name: 'Synthetic Student Two',
        email: 'student2@example.test',
        extra_info: {
          roll_number: '25CE001',
          department: 'Computer Engineering',
          division: 'CE1',
          semester: '1',
        },
        rawPassword: 'mock-student-password',
      },
    ]);
    assert.ok(studentDoc, 'Expected student jsPDF document instance');

    // Verify PDF binary outputs contain expected non-sensitive content
    const genericPdf = genericDoc.output();
    assert.ok(genericPdf.includes('User Credentials'), 'PDF should include User Credentials title');
    assert.ok(genericPdf.includes('Synthetic'), 'PDF should include user name');
    assert.ok(genericPdf.includes('student@example.test'), 'PDF should include user email');

    const facultyPdf = facultyDoc.output();
    assert.ok(facultyPdf.includes('Faculty Credentials'), 'PDF should include Faculty Credentials title');
    assert.ok(facultyPdf.includes('Synthetic'), 'PDF should include user name');
    assert.ok(facultyPdf.includes('faculty@example.test'), 'PDF should include user email');
    assert.ok(facultyPdf.includes('Computer'), 'PDF should include department');

    const studentPdf = studentDoc.output();
    assert.ok(studentPdf.startsWith('%PDF'), 'Student PDF should start with PDF magic number');
    assert.ok(studentPdf.includes('Student Credentials'), 'PDF should include Student Credentials title');
    assert.ok(studentPdf.includes('CE1'), 'PDF should include division');
    // Inspect the files actually saved by the download functions, not just the
    // returned document. This directory is uniquely created and test-owned.
    const downloads = fs.readdirSync(outputDir).filter(name => name.endsWith('.pdf'));
    assert.equal(downloads.length, 3);
    const binaries = downloads.map(name => fs.readFileSync(path.join(outputDir, name)));
    assert.ok(binaries.every(bytes => bytes.subarray(0, 4).toString() === '%PDF'));
    for (const title of ['User Credentials', 'Faculty Credentials', 'Student Credentials']) {
      assert.ok(binaries.some(bytes => bytes.toString('latin1').includes(title)), `Saved PDF contains ${title}`);
    }
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    process.chdir(originalCwd);
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});
