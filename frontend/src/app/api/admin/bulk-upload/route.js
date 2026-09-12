import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getUserFromRequest } from '@/lib/auth';

const execPromise = promisify(exec);

export async function POST(request) {
  try {
    // ── 1. Authenticate user ──
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const role = formData.get('role');

    if (!file || !role) {
      return NextResponse.json({ error: 'File and role are required' }, { status: 400 });
    }

    // ── 2. Validate role ──
    if (role !== 'faculty' && role !== 'student') {
      return NextResponse.json({ error: 'Invalid role parameter' }, { status: 400 });
    }

    // ── 3. Validate file extension ──
    const fileExt = path.extname(file.name).toLowerCase();
    if (!['.csv', '.xlsx', '.xls'].includes(fileExt)) {
      return NextResponse.json({ error: 'Unsupported file type. Only CSV and Excel files are allowed.' }, { status: 400 });
    }

    // Save file temporarily using a cryptographically random UUID to prevent command injection
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Check file size (limit to 5MB)
    if (buffer.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), 'tmp', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const safeFileName = `${Date.now()}_${crypto.randomUUID()}${fileExt}`;
    const filePath = path.join(uploadsDir, safeFileName);
    await fs.writeFile(filePath, buffer);

    // Run Python script securely
    const pythonCmd = `python scripts/bulk_upload.py "${filePath}" ${role}`;
    
    const { stdout, stderr } = await execPromise(pythonCmd, {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
    });

    // Cleanup file
    await fs.unlink(filePath).catch(console.error);

    if (stderr && !stdout) {
      console.error('Python Error:', stderr);
      return NextResponse.json({ error: 'Internal execution error' }, { status: 500 });
    }

    try {
      const result = JSON.parse(stdout);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json(result);
    } catch (e) {
      console.error('Failed to parse Python output:', stdout);
      return NextResponse.json({ error: 'Failed to process result' }, { status: 500 });
    }

  } catch (error) {
    console.error('Bulk upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
