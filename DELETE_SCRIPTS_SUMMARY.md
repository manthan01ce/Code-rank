# Delete Scripts - Complete Guide

## 📋 Overview

Three scripts are available for permanently deleting users from the database:

1. **`permanent_delete_user.js`** - Universal script (works for both students and faculty)
2. **`permanent_delete_student.js`** - Student-specific script
3. **`permanent_delete_faculty.js`** - Faculty-specific script

## 🎯 Recommended Usage

### Use the Universal Script (Easiest)
```bash
node scripts/permanent_delete_user.js <email_or_id>
```

This script:
- ✅ Works for both students and faculty
- ✅ Auto-detects the user type
- ✅ Handles course unassignment for faculty
- ✅ Prevents deletion of admin users
- ✅ Case-insensitive email search

## 📝 Script Details

### 1. Universal Delete Script
**File:** `scripts/permanent_delete_user.js`

**Usage:**
```bash
# Delete by email (case-insensitive)
node scripts/permanent_delete_user.js john.doe@example.com
node scripts/permanent_delete_user.js JOHN.DOE@EXAMPLE.COM

# Delete by ID
node scripts/permanent_delete_user.js 123
```

**Features:**
- Detects if user is student or faculty
- Shows all user details before deletion
- For faculty: Lists and unassigns courses
- Deletes activity logs (foreign key safety)
- Shows remaining count after deletion
- Cannot delete admin users

**Example Output:**
```
📋 FACULTY to be permanently deleted:
   ID: 2
   Name: trusha
   Email: 25CE097@charusat.edu.in
   Role: faculty
   Status: active
   Department: ce
   Designation: professor
   Created: Thu Apr 16 2026 16:33:50 GMT+0530

🗑️  Deleted 0 activity log(s)

✅ FACULTY permanently deleted from database
   Name: trusha
   Email: 25CE097@charusat.edu.in

📊 Remaining facultys in database: 12
```

### 2. Student-Specific Delete Script
**File:** `scripts/permanent_delete_student.js`

**Usage:**
```bash
node scripts/permanent_delete_student.js student@example.com
node scripts/permanent_delete_student.js 123
```

**Features:**
- Only deletes students (role = 'student')
- Shows student details (roll number, branch, batch)
- Safer if you want to ensure you're only deleting students

### 3. Faculty-Specific Delete Script
**File:** `scripts/permanent_delete_faculty.js`

**Usage:**
```bash
node scripts/permanent_delete_faculty.js faculty@example.com
node scripts/permanent_delete_faculty.js 123
```

**Features:**
- Only deletes faculty (role = 'faculty')
- Shows faculty details (department, designation)
- Lists assigned courses before deletion
- Unassigns faculty from all courses
- Safer if you want to ensure you're only deleting faculty

## 📊 List Scripts

### List Students
```bash
node scripts/list_students.js
```

**Output:**
```
📊 Total Students: 2

✅ ACTIVE STUDENTS (1):
────────────────────────────────────────────────────────────────────────────────
1. ID: 250 | John Doe | john.doe@test.com
   Created: 4/16/2026, 9:53:28 PM

❌ INACTIVE STUDENTS (1):
────────────────────────────────────────────────────────────────────────────────
1. ID: 251 | Jane Smith | jane.smith@test.com
   Created: 4/16/2026, 9:54:15 PM
```

### List Faculty
```bash
node scripts/list_faculty.js
```

**Output:**
```
📊 Total Faculty: 12

✅ ACTIVE FACULTY (12):
────────────────────────────────────────────────────────────────────────────────
1. ID: 247 | Shaurya Jain | shaurya.jain@example.com
   Department: Computer Science & Engineering | Designation: N/A
   Created: 16/4/2026, 9:43:57 pm
...
```

## 🔍 Check Specific User

**File:** `scripts/check_specific_user.js`

This script checks if a specific email exists and shows their details.

**Usage:**
Edit the email in the script and run:
```bash
node scripts/check_specific_user.js
```

**File:** `scripts/check_faculty_user.js`

Checks for faculty with case-insensitive search.

## ⚠️ Important Notes

### 1. Case-Insensitive Email Search
All delete scripts use **case-insensitive** email search:
- `25ce097@charusat.edu.in` matches `25CE097@charusat.edu.in`
- `JOHN.DOE@EXAMPLE.COM` matches `john.doe@example.com`

### 2. Cross-Role Duplicate Detection
The system prevents duplicate emails across ALL roles:
- If `user@example.com` exists as faculty, you cannot add them as student
- If `user@example.com` exists as student, you cannot add them as faculty
- This is by design to maintain email uniqueness

### 3. Permanent Deletion
These scripts perform **hard delete** (not soft delete):
- User is completely removed from database
- Cannot be undone
- Activity logs are also deleted
- For faculty: Courses are unassigned

### 4. Soft Delete (Deactivate)
For reversible deletion, use the admin panel:
- Click "Deactivate" button
- User status becomes 'inactive'
- User data remains in database
- Can be reactivated later

## 🐛 Troubleshooting

### Issue: "User already exists" but not visible in list

**Cause:** User exists with different role or different email case

**Solution:**
1. Check if user exists as faculty (if you're looking in students list)
2. Use check scripts to find the user:
   ```bash
   node scripts/check_specific_user.js
   node scripts/check_faculty_user.js
   ```
3. Delete using the universal script:
   ```bash
   node scripts/permanent_delete_user.js <email>
   ```

### Issue: Cannot delete user

**Possible causes:**
- User is an admin (admins cannot be deleted with these scripts)
- User ID doesn't exist
- Email doesn't match (check case)

**Solution:**
- Verify user exists: `node scripts/list_students.js` or `node scripts/list_faculty.js`
- Use exact email or ID from the list
- For admins, use database directly (not recommended)

### Issue: Faculty has assigned courses

**Not an issue!** The script automatically:
1. Lists all assigned courses
2. Unassigns faculty from all courses
3. Then deletes the faculty

## 🔒 Safety Features

All delete scripts include:
- ✅ User confirmation (shows details before deletion)
- ✅ Foreign key handling (deletes activity logs first)
- ✅ Course unassignment (for faculty)
- ✅ Admin protection (cannot delete admins)
- ✅ Role verification (ensures correct user type)
- ✅ Detailed output (shows what was deleted)

## 📊 Workflow Example

### Scenario: Remove a user who was added with wrong role

```bash
# Step 1: Check if user exists
node scripts/list_faculty.js
# Found: 25CE097@charusat.edu.in as faculty

# Step 2: Delete the user
node scripts/permanent_delete_user.js 25CE097@charusat.edu.in
# ✅ Faculty permanently deleted

# Step 3: Verify deletion
node scripts/check_specific_user.js
# ❌ User NOT found in database

# Step 4: Now you can add them with correct role
# Upload CSV with 25ce097@charusat.edu.in as student
# ✅ Student created successfully
```

## 🎯 Best Practices

1. **Always list before delete**
   ```bash
   node scripts/list_students.js  # or list_faculty.js
   node scripts/permanent_delete_user.js <email_or_id>
   ```

2. **Use soft delete (deactivate) when possible**
   - Deactivate from admin panel
   - Only use permanent delete when necessary

3. **Backup before bulk operations**
   - Export data before mass deletions
   - Keep activity logs for audit trail

4. **Verify after deletion**
   ```bash
   node scripts/list_students.js  # Check user is gone
   ```

5. **Use universal script for simplicity**
   ```bash
   node scripts/permanent_delete_user.js <email>
   ```
   Instead of remembering which specific script to use

---

**Created:** April 16, 2026  
**Status:** ✅ Complete and Tested
