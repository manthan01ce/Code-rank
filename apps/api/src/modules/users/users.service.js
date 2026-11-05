import { AccountService } from '../auth/account.service.js';
import sql from '@coderank/database';
import { UserManagementService } from './user-management.service.js';

const fail = (status, message) => {
  throw { status, message };
};

export class UsersService {
  static admin(user) {
    if (!user || user.role !== 'admin') fail(401, 'Unauthorized');
  }

  /**
   * Validate student division format
   */
  static validateDivision(division) {
    if (!division || typeof division !== 'string' || !division.trim()) {
      return { valid: false, error: 'Division is compulsory for students.' };
    }
    const trimmed = division.trim();
    const alphaMatches = trimmed.match(/[a-zA-Z]/g) || [];
    const digitMatches = trimmed.match(/[0-9]/g) || [];
    if (alphaMatches.length < 2) {
      return {
        valid: false,
        error:
          'Division must contain at least 2 alphabetic letters (e.g., CE1, IT2).',
      };
    }
    if (digitMatches.length < 1) {
      return {
        valid: false,
        error:
          'Division must contain at least 1 numeric digit (e.g., CE1, IT2).',
      };
    }
    return { valid: true };
  }

  static async changePassword(admin, body) {
    return AccountService.changePassword(admin, body);
  }

  /**
   * Admin: List users with filters
   */
  static async listUsers(options) {
    return UserManagementService.listUsers(options);
  }

  /**
   * User mutation handler (create, update, deactivate)
   */
  static async mutate(admin, id, action, body = {}, options = {}) {
    return UserManagementService.mutate(admin, id, action, body, options);
  }

  /**
   * Admin: Create single user
   */
  static async createUser(admin, body, options) {
    return this.mutate(admin, null, 'create', body, options);
  }

  static async updateUser(admin, body) {
    return (await this.mutate(admin, body.id, 'update', body)).user;
  }

  static async deleteUser(admin, id) {
    await this.mutate(admin, id, 'deactivate');
    return { success: true };
  }

  /**
   * Admin: Bulk upload users
   */
  static async bulkUploadUsers(admin, usersList, role) {
    this.admin(admin);
    if (!Array.isArray(usersList) || usersList.length > 500)
      fail(400, 'Maximum 500 users per upload');
    const users = [],
      errors = [];
    for (const [index, u] of usersList.entries()) {
      try {
        const result = await this.mutate(
          admin,
          null,
          'create',
          {
            ...u,
            role,
            name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim(),
            extra_info: {
              roll_number: u.roll_number || u.roll || '',
              division: u.division || '',
              batch: u.batch || '',
              semester: u.semester || 1,
              department: u.department || '',
            },
          },
        );
        users.push({ ...result.user, rawPassword: result.rawPassword });
      } catch (error) {
        errors.push({
          row: index + 1,
          email: u.email,
          error: error.status ? error.message : 'Unable to create user',
        });
      }
    }
    return { success: true, createdCount: users.length, users, errors };
  }

  static async bulkCreateUsers(admin, records, role) {
    this.admin(admin);
    if (records.length > 500) {
      throw { status: 400, message: 'Maximum 500 users per upload' };
    }

    const getVal = (row, keys) => {
      const lowerMap = {};
      for (const k of Object.keys(row)) lowerMap[k.toLowerCase().trim()] = k;
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
      const name = getVal(row, [
        'Name',
        'Full Name',
        'fullname',
        'Student Name',
        'StudentName',
      ]);
      const email = getVal(row, [
        'Email',
        'Email ID',
        'EmailID',
        'email_id',
        'emailaddr',
        'Email Address',
      ]);

      if (!name || !email) {
        skipped.push({
          name: name || 'N/A',
          email: email || 'N/A',
          reason: 'Missing Name or Email',
        });
        continue;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        skipped.push({
          name,
          email,
          reason: `Invalid email format: "${email}"`,
        });
        continue;
      }

      let extra_info = {};
      if (role === 'student') {
        const division = getVal(row, [
          'Division',
          'division',
          'Div',
          'div',
          'Section',
          'section',
        ]);
        const valRes = this.validateDivision(division);
        if (!valRes.valid) {
          skipped.push({
            name,
            email,
            reason: `Invalid or missing division "${division}": ${valRes.error}`,
          });
          continue;
        }

        extra_info = {
          roll_number: getVal(row, [
            'Roll Number',
            'RollNumber',
            'Roll No',
            'RollNo',
            'Roll',
            'roll_number',
            'Enrollment',
            'Enrollment No',
            'EnrollmentNo',
          ]),
          branch: getVal(row, ['Branch', 'branch', 'Dept', 'Department', 'Stream']),
          department: getVal(row, ['Department', 'department', 'Branch', 'branch', 'Dept', 'Stream']),
          semester: getVal(row, ['Semester', 'semester', 'Sem', 'sem']),
          batch: getVal(row, ['Batch', 'batch', 'Year', 'year', 'Passing Year', 'PassingYear', 'Graduation Year']),
          division: division.trim().toUpperCase(),
        };
      } else if (role === 'faculty') {
        extra_info = {
          department: getVal(row, ['Department', 'department', 'Branch', 'branch', 'Dept']),
          designation: getVal(row, ['Designation', 'designation', 'Post', 'Position', 'Role']),
        };
      }

      try {
        const created = await this.mutate(
          admin,
          null,
          'create',
          { name, email, role, extra_info },
        );
        results.push({ ...created.user, rawPassword: created.rawPassword });
      } catch (err) {
        if (err.status === 409) {
          skipped.push({ name, email, reason: 'User already exists' });
        } else {
          errors.push({
            email,
            error: err.status ? err.message : 'Unable to create user',
          });
        }
      }
    }

    return {
      success: true,
      created: results,
      users: results,
      createdCount: results.length,
      updated,
      errors,
      skipped,
      skippedCount: skipped.length,
      summary: {
        total: records.length,
        created: results.length,
        skipped: skipped.length,
        errors: errors.length,
      },
    };
  }
}
