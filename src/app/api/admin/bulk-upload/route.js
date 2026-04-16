
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execPromise = promisify(exec);

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const role = formData.get('role');

    if (!file || !role) {
      return NextResponse.json({ error: 'File and role are required' }, { status: 400 });
    }

    // Save file temporarily
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const uploadsDir = path.join(process.cwd(), 'tmp', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const filePath = path.join(uploadsDir, `${Date.now()}_${file.name}`);
    await fs.writeFile(filePath, buffer);

    // Run Python script
    // Ensure DATABASE_URL is available to the child process
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
