import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@coderank/core/utils/auth';
import { UserService } from '@coderank/core/services/UserService';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import path from 'path';

export async function POST(request) {
  try {
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

    if (role !== 'faculty' && role !== 'student') {
      return NextResponse.json({ error: 'Invalid role parameter' }, { status: 400 });
    }

    const fileExt = path.extname(file.name).toLowerCase();
    if (!['.csv', '.xlsx', '.xls'].includes(fileExt)) {
      return NextResponse.json({ error: 'Unsupported file type. Only CSV and Excel files are allowed.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (buffer.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 });
    }

    let parsedUsers = [];

    if (fileExt === '.csv') {
      const records = parse(buffer.toString('utf-8'), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      parsedUsers = records.map((r) => ({
        first_name: r.first_name || r.firstName || r.name?.split(' ')[0] || '',
        last_name: r.last_name || r.lastName || r.name?.split(' ').slice(1).join(' ') || '',
        name: r.name || `${r.first_name || ''} ${r.last_name || ''}`.trim(),
        email: r.email,
        division: r.division || '',
        roll_number: r.roll_number || r.roll || '',
        batch: r.batch || '',
        semester: r.semester ? parseInt(r.semester, 10) : 1,
        department: r.department || '',
      }));
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];
      const headers = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          row.eachCell((cell, colNumber) => {
            headers[colNumber] = cell.value?.toString().trim().toLowerCase();
          });
        } else {
          const rowData = {};
          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber];
            if (header) rowData[header] = cell.value?.toString().trim();
          });

          if (rowData.email) {
            parsedUsers.push({
              first_name: rowData.first_name || rowData.firstname || rowData.name?.split(' ')[0] || '',
              last_name: rowData.last_name || rowData.lastname || rowData.name?.split(' ').slice(1).join(' ') || '',
              name: rowData.name || `${rowData.first_name || ''} ${rowData.last_name || ''}`.trim(),
              email: rowData.email,
              division: rowData.division || '',
              roll_number: rowData.roll_number || rowData.roll || '',
              batch: rowData.batch || '',
              semester: rowData.semester ? parseInt(rowData.semester, 10) : 1,
              department: rowData.department || '',
            });
          }
        }
      });
    }

    const result = await UserService.bulkUploadUsers(user, parsedUsers, role);
    return NextResponse.json(result);
  } catch (error) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Bulk upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
