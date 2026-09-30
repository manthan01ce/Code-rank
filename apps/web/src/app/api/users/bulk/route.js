import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest, hashPassword, generateSecurePassword } from '@/lib/auth';
import ExcelJS from 'exceljs';
import { Readable } from 'stream';

function validateDivision(division) {
  if (!division || typeof division !== 'string' || !division.trim()) {
    return { valid: false, error: 'Division is compulsory for students.' };
  }
  const trimmed = division.trim();
  const alphaMatches = trimmed.match(/[a-zA-Z]/g) || [];
  const digitMatches = trimmed.match(/[0-9]/g) || [];
  if (alphaMatches.length < 2) {
    return { valid: false, error: 'Division must contain at least 2 alphabetic letters (e.g., CE1, IT2).' };
  }
  if (digitMatches.length < 1) {
    return { valid: false, error: 'Division must contain at least 1 numeric digit (e.g., CE1, IT2).' };
  }
  return { valid: true };
}

export async function POST(request) {
  try {
    const admin = getUserFromRequest(request);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const role = formData.get('role'); // 'student' or 'faculty'

    if (!file || !role) {
      return NextResponse.json({ error: 'File and role are required' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Parse with ExcelJS (supports .xlsx and .csv)
    const workbook = new ExcelJS.Workbook();
    const fileExt = (file.name || '').split('.').pop().toLowerCase();
    if (fileExt === 'csv') {
      await workbook.csv.read(Readable.from(buffer));
    } else {
      await workbook.xlsx.load(buffer);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json({ error: 'No worksheet found in file' }, { status: 400 });
    }

    // Convert worksheet to array of plain objects keyed by header row
    const headers = [];
    const records = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell) => headers.push(String(cell.value || '').trim()));
      } else {
        const obj = {};
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const header = headers[colNumber - 1] || `col${colNumber}`;
          obj[header] = cell.value !== null && cell.value !== undefined ? String(cell.value).trim() : '';
        });
        records.push(obj);
      }
    });

    if (records.length === 0) {
      return NextResponse.json({ error: 'No data found in file' }, { status: 400 });
    }

    // Robust case-insensitive column value getter
    const getVal = (row, keys) => {
      // Build a lowercase key → actual key map once
      const lowerMap = {};
      for (const k of Object.keys(row)) {
        lowerMap[k.toLowerCase().trim()] = k;
      }
      for (const key of keys) {
        const actual = lowerMap[key.toLowerCase().trim()];
        if (actual !== undefined) {
          const val = row[actual];
          return val !== undefined && val !== null ? String(val).trim() : '';
        }
      }
      return '';
    };

    const results = [];
    const updated = [];
    const errors = [];
    const skipped = [];

    for (const row of records) {
      const name  = getVal(row, ['Name', 'Full Name', 'fullname', 'Student Name', 'StudentName']);
      const email = getVal(row, ['Email', 'Email ID', 'EmailID', 'email_id', 'emailaddr', 'Email Address']);

      if (!name || !email) {
        skipped.push({ 
          name: name || 'N/A', 
          email: email || 'N/A', 
          reason: 'Missing Name or Email' 
        });
        continue;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        skipped.push({ 
          name, 
          email, 
          reason: `Invalid email format: "${email}"` 
        });
        continue;
      }

      // Build extra_info
      let extra_info = {};
      if (role === 'student') {
        const division = getVal(row, ['Division', 'division', 'Div', 'div', 'Section', 'section']);
        const valRes = validateDivision(division);
        if (!valRes.valid) {
          skipped.push({ 
            name, 
            email, 
            reason: `Invalid or missing division "${division}": ${valRes.error}` 
          });
          continue;
        }

        extra_info = {
          roll_number: getVal(row, ['Roll Number', 'RollNumber', 'Roll No', 'RollNo', 'Roll', 'roll_number', 'Enrollment', 'Enrollment No', 'EnrollmentNo']),
          branch:      getVal(row, ['Branch', 'branch', 'Dept', 'Department', 'Stream']),
          department:  getVal(row, ['Department', 'department', 'Branch', 'branch', 'Dept', 'Stream']),
          semester:    getVal(row, ['Semester', 'semester', 'Sem', 'sem']),
          batch:       getVal(row, ['Batch', 'batch', 'Year', 'year', 'Passing Year', 'PassingYear', 'Graduation Year']),
          division:    division.trim().toUpperCase(),
        };
      } else if (role === 'faculty') {
        extra_info = {
          department:  getVal(row, ['Department', 'department', 'Branch', 'branch', 'Dept']),
          designation: getVal(row, ['Designation', 'designation', 'Post', 'Position', 'Role']),
        };
      }

      try {
        // Check if user already exists
        const existing = await sql`SELECT id, name, role, status FROM users WHERE email = ${email}`;

        if (existing.length > 0) {
          const existingUser = existing[0];
          // Skip if user already exists - don't update
          skipped.push({
            name,
            email,
            reason: `User already exists (ID: ${existingUser.id}, Name: ${existingUser.name}, Role: ${existingUser.role}, Status: ${existingUser.status})`
          });
          continue;
        }

        // INSERT new user with generated password
        const rawPassword    = generateSecurePassword();
        const hashedPassword = await hashPassword(rawPassword);

        const result = await sql`
          INSERT INTO users (name, email, password, role, extra_info, status)
          VALUES (${name}, ${email}, ${hashedPassword}, ${role}, ${JSON.stringify(extra_info)}, 'active')
          RETURNING id, name, email, role, extra_info, status
        `;
        results.push({ ...result[0], rawPassword });

      } catch (err) {
        console.error('DB error for', email, err);
        errors.push({ email, error: `DB error: ${err.message}` });
      }
    }

    await sql`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (${admin.id}, 'BULK_CREATE_USERS',
        ${`Bulk upload: ${results.length} created, ${skipped.length} skipped, ${errors.length} errors (${role})`})
    `;

    return NextResponse.json({
      success: true,
      created: results,          // new users with passwords → go into PDF
      updated,                   // keeping for backward compatibility (empty now)
      errors,                    // actual failures (bad email format, etc.)
      skipped,                   // users that already exist
      skippedCount: skipped.length,
      summary: {
        total:   records.length,
        created: results.length,
        skipped: skipped.length,
        errors:  errors.length,
      }
    });

  } catch (error) {
    console.error('Bulk user error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}

