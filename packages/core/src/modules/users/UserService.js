import { UserManagementService } from "./UserManagementService.js";
import sql from "../../db/client.js";

export class UserService {
  /**
   * Validate student division format
   */
  static validateDivision(division) {
    if (!division || typeof division !== "string" || !division.trim()) {
      return { valid: false, error: "Division is compulsory for students." };
    }
    const trimmed = division.trim();
    const alphaMatches = trimmed.match(/[a-zA-Z]/g) || [];
    const digitMatches = trimmed.match(/[0-9]/g) || [];
    if (alphaMatches.length < 2) {
      return {
        valid: false,
        error:
          "Division must contain at least 2 alphabetic letters (e.g., CE1, IT2).",
      };
    }
    if (digitMatches.length < 1) {
      return {
        valid: false,
        error:
          "Division must contain at least 1 numeric digit (e.g., CE1, IT2).",
      };
    }
    return { valid: true };
  }

  /**
   * Admin: List users with filters
   */
  static async listUsers({
    role,
    search,
    status,
    division,
    cursor = null,
    limit = 100,
  }) {
    limit = Number(limit);
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 200 ||
      (cursor !== null &&
        (!Number.isSafeInteger(Number(cursor)) || Number(cursor) < 1))
    )
      throw { status: 400, message: "Invalid pagination" };
    const conditions = [];
    const params = [];

    const addParam = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (role) {
      conditions.push(`role = ${addParam(role)}`);
    } else {
      conditions.push("role != 'admin'");
    }

    if (status && status !== "all") {
      conditions.push(`status = ${addParam(status)}`);
    }

    if (search && search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      const nameParam = addParam(searchPattern);
      const emailParam = addParam(searchPattern);
      const rollNumberParam = addParam(searchPattern);
      const divisionParam = addParam(searchPattern);
      conditions.push(
        `(name ILIKE ${nameParam} OR email ILIKE ${emailParam} OR extra_info->>'roll_number' ILIKE ${rollNumberParam} OR extra_info->>'division' ILIKE ${divisionParam})`,
      );
    }

    if (division && division !== "all") {
      conditions.push(`extra_info->>'division' = ${addParam(division)}`);
    }

    if (cursor !== null) conditions.push(`id < ${addParam(Number(cursor))}`);
    const limitParam = addParam(limit);
    return await sql.query(
      `
      SELECT id, first_name, last_name, name, email, role, status, created_at, extra_info 
      FROM users 
      WHERE ${conditions.join(" AND ")}
      ORDER BY id DESC
      LIMIT ${limitParam}
    `,
      params,
    );
  }

  /**
   * Admin: Create single user
   */
  static async createUser(admin, body, options) {
    return UserManagementService.mutate(admin, null, "create", body, options);
  }
  static async updateUser(admin, body) {
    return (await UserManagementService.mutate(admin, body.id, "update", body))
      .user;
  }
  static async deleteUser(admin, id) {
    await UserManagementService.mutate(admin, id, "deactivate");
    return { success: true };
  }

  /**
   * Admin: Bulk upload users
   */
  static async bulkUploadUsers(admin, usersList, role) {
    UserManagementService.admin(admin);
    if (!Array.isArray(usersList) || usersList.length > 500)
      throw { status: 400, message: "Maximum 500 users per upload" };
    const users = [],
      errors = [];
    for (const [index, u] of usersList.entries()) {
      try {
        const result = await UserManagementService.mutate(
          admin,
          null,
          "create",
          {
            ...u,
            role,
            name: u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim(),
            extra_info: {
              roll_number: u.roll_number || u.roll || "",
              division: u.division || "",
              batch: u.batch || "",
              semester: u.semester || 1,
              department: u.department || "",
            },
          },
        );
        users.push({ ...result.user, rawPassword: result.rawPassword });
      } catch (error) {
        errors.push({
          row: index + 1,
          email: u.email,
          error: error.status ? error.message : "Unable to create user",
        });
      }
    }
    return { success: true, createdCount: users.length, users, errors };
  }

  /**
   * Get student profile stats by username/email
   */

}
