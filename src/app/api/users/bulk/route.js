import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromRequest, hashPassword, generateSecurePassword } from '@/lib/auth';
import * as XLSX from 'xlsx';

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

    // Parse with XLSX — defVal: '' so empty cells come as '' not undefined
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const records = XLSX.utils.sheet_to_json(sheet, { defval: '' });

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

    for (const row of records) {
      const name  = getVal(row, ['Name', 'Full Name', 'fullname', 'Student Name', 'StudentName']);
      const email = getVal(row, ['Email', 'Email ID', 'EmailID', 'email_id', 'emailaddr', 'Email Address']);

      if (!name || !email) {
        errors.push({ row: JSON.stringify(row), error: 'Missing Name or Email — row skipped' });
        continue;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push({ email, error: `Invalid email format: "${email}"` });
        continue;
      }

      // Build extra_info
      let extra_info = {};
      if (role === 'student') {
        extra_info = {
          roll_number: getVal(row, ['Roll Number', 'RollNumber', 'Roll No', 'RollNo', 'Roll', 'roll_number', 'Enrollment', 'Enrollment No', 'EnrollmentNo']),
          branch:      getVal(row, ['Branch', 'branch', 'Dept', 'Department', 'Stream']),
          batch:       getVal(row, ['Batch', 'batch', 'Year', 'year', 'Passing Year', 'PassingYear', 'Graduation Year']),
        };
      } else if (role === 'faculty') {
        extra_info = {
          department:  getVal(row, ['Department', 'department', 'Branch', 'branch', 'Dept']),
          designation: getVal(row, ['Designation', 'designation', 'Post', 'Position', 'Role']),
        };
      }

      try {
        // Check if user already exists
        const existing = await sql`SELECT id, status FROM users WHERE email = ${email}`;

        if (existing.length > 0) {
          // UPDATE existing user — never skip, just update name + extra_info
          const result = await sql`
            UPDATE users
            SET name       = ${name},
                extra_info = ${JSON.stringify(extra_info)},
                status     = 'active'
            WHERE email = ${email}
            RETURNING id, name, email, role, extra_info, status
          `;
          // Don't expose old password — generate a note
          updated.push({ ...result[0], rawPassword: '(existing account — password unchanged)' });

        } else {
          // INSERT new user with generated password
          const rawPassword    = generateSecurePassword();
          const hashedPassword = await hashPassword(rawPassword);

          const result = await sql`
            INSERT INTO users (name, email, password, role, extra_info, status)
            VALUES (${name}, ${email}, ${hashedPassword}, ${role}, ${JSON.stringify(extra_info)}, 'active')
            RETURNING id, name, email, role, extra_info, status
          `;
          results.push({ ...result[0], rawPassword });
        }

      } catch (err) {
        console.error('DB error for', email, err);
        errors.push({ email, error: `DB error: ${err.message}` });
      }
    }

    await sql`
      INSERT INTO activity_logs (user_id, action, details)
      VALUES (${admin.id}, 'BULK_CREATE_USERS',
        ${`Bulk upload: ${results.length} created, ${updated.length} updated, ${errors.length} errors (${role})`})
    `;

    return NextResponse.json({
      success: true,
      created: results,          // new users with passwords → go into PDF
      updated,                   // existing users that were updated
      errors,                    // actual failures (bad email format, etc.)
      summary: {
        total:   records.length,
        created: results.length,
        updated: updated.length,
        errors:  errors.length,
      }
    });

  } catch (error) {
    console.error('Bulk user error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}

