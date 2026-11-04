import { UserManagementService } from '@coderank/core/services/UserManagementService';
import { UserService } from '@coderank/core/services/UserService';

export class UsersService {
  static admin(user) {
    if (!user || user.role !== 'admin') throw { status: 401, message: 'Unauthorized' };
  }

  static validateDivision(division) {
    return UserService.validateDivision(division);
  }

  static async changePassword(admin, body) {
    return UserService.changePassword(admin, body);
  }

  static async listUsers(options) {
    return UserService.listUsers(options);
  }

  static async mutate(admin, id, action, body, options) {
    return UserManagementService.mutate(admin, id, action, body, options);
  }

  static async createUser(admin, body, options) {
    return UserService.createUser(admin, body, options);
  }

  static async updateUser(admin, body) {
    return UserService.updateUser(admin, body);
  }

  static async deleteUser(admin, id) {
    return UserService.deleteUser(admin, id);
  }

  static async bulkUploadUsers(admin, usersList, role) {
    return UserService.bulkUploadUsers(admin, usersList, role);
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
