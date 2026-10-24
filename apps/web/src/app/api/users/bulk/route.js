import { NextResponse } from "next/server";
import { UserManagementService } from "@coderank/core/services/UserManagementService";
import { authenticateRequest } from '@coderank/core/security/active-actor';
import ExcelJS from "exceljs";
import { Readable } from "stream";

function validateDivision(division) {
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
      error: "Division must contain at least 1 numeric digit (e.g., CE1, IT2).",
    };
  }
  return { valid: true };
}

export async function POST(request) {
  try {
    const admin = await authenticateRequest(request);
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let formData;
    try { formData = await request.formData(); } catch {
      return NextResponse.json({ error: 'Invalid multipart payload' }, { status: 400 });
    }
    const file = formData.get("file");
    const role = formData.get("role"); // 'student' or 'faculty'

    if (
      !file ||
      typeof file.arrayBuffer !== "function" ||
      !["student", "faculty"].includes(role)
    ) {
      return NextResponse.json(
        { error: "File and role are required" },
        { status: 400 },
      );
    }

    if (file.size > 5 * 1024 * 1024)
      return NextResponse.json(
        { error: "Maximum upload size is 5 MB" },
        { status: 400 },
      );
    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Parse with ExcelJS (supports .xlsx and .csv)
    const workbook = new ExcelJS.Workbook();
    const fileExt = (file.name || "").split(".").pop().toLowerCase();
    if (!["csv", "xlsx"].includes(fileExt))
      return NextResponse.json(
        { error: "Upload CSV or XLSX only" },
        { status: 400 },
      );
    try {
      if (fileExt === "csv") await workbook.csv.read(Readable.from(buffer));
      else await workbook.xlsx.load(buffer);
    } catch {
      return NextResponse.json(
        { error: "Invalid spreadsheet file" },
        { status: 400 },
      );
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json(
        { error: "No worksheet found in file" },
        { status: 400 },
      );
    }

    // Convert worksheet to array of plain objects keyed by header row
    const headers = [];
    const records = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell, column) => {
          headers[column - 1] = String(cell.value || "").trim();
        });
      } else {
        const obj = {};
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const header = headers[colNumber - 1] || `col${colNumber}`;
          obj[header] =
            cell.value !== null && cell.value !== undefined
              ? String(cell.value).trim()
              : "";
        });
        records.push(obj);
      }
    });

    if (records.length === 0) {
      return NextResponse.json(
        { error: "No data found in file" },
        { status: 400 },
      );
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
          return val !== undefined && val !== null ? String(val).trim() : "";
        }
      }
      return "";
    };

    if (records.length > 500)
      return NextResponse.json(
        { error: "Maximum 500 users per upload" },
        { status: 400 },
      );
    const results = [];
    const updated = [];
    const errors = [];
    const skipped = [];

    for (const row of records) {
      const name = getVal(row, [
        "Name",
        "Full Name",
        "fullname",
        "Student Name",
        "StudentName",
      ]);
      const email = getVal(row, [
        "Email",
        "Email ID",
        "EmailID",
        "email_id",
        "emailaddr",
        "Email Address",
      ]);

      if (!name || !email) {
        skipped.push({
          name: name || "N/A",
          email: email || "N/A",
          reason: "Missing Name or Email",
        });
        continue;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        skipped.push({
          name,
          email,
          reason: `Invalid email format: "${email}"`,
        });
        continue;
      }

      // Build extra_info
      let extra_info = {};
      if (role === "student") {
        const division = getVal(row, [
          "Division",
          "division",
          "Div",
          "div",
          "Section",
          "section",
        ]);
        const valRes = validateDivision(division);
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
            "Roll Number",
            "RollNumber",
            "Roll No",
            "RollNo",
            "Roll",
            "roll_number",
            "Enrollment",
            "Enrollment No",
            "EnrollmentNo",
          ]),
          branch: getVal(row, [
            "Branch",
            "branch",
            "Dept",
            "Department",
            "Stream",
          ]),
          department: getVal(row, [
            "Department",
            "department",
            "Branch",
            "branch",
            "Dept",
            "Stream",
          ]),
          semester: getVal(row, ["Semester", "semester", "Sem", "sem"]),
          batch: getVal(row, [
            "Batch",
            "batch",
            "Year",
            "year",
            "Passing Year",
            "PassingYear",
            "Graduation Year",
          ]),
          division: division.trim().toUpperCase(),
        };
      } else if (role === "faculty") {
        extra_info = {
          department: getVal(row, [
            "Department",
            "department",
            "Branch",
            "branch",
            "Dept",
          ]),
          designation: getVal(row, [
            "Designation",
            "designation",
            "Post",
            "Position",
            "Role",
          ]),
        };
      }

      try {
        const created = await UserManagementService.mutate(
          admin,
          null,
          "create",
          { name, email, role, extra_info },
        );
        results.push({ ...created.user, rawPassword: created.rawPassword });
      } catch (err) {
        if (err.status === 409)
          skipped.push({ name, email, reason: "User already exists" });
        else
          errors.push({
            email,
            error: err.status ? err.message : "Unable to create user",
          });
      }
    }

    return NextResponse.json({
      success: true,
      created: results, // new users with passwords → go into PDF
      updated, // keeping for backward compatibility (empty now)
      errors, // actual failures (bad email format, etc.)
      skipped, // users that already exist
      skippedCount: skipped.length,
      summary: {
        total: records.length,
        created: results.length,
        skipped: skipped.length,
        errors: errors.length,
      },
    });
  } catch (error) {
    if (error.status) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Bulk user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
