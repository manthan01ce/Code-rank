# CodeRank - Testing Guide

## ✅ All Issues Fixed!

The following issues have been resolved:
1. ✅ Database schema updated (extra_info column added)
2. ✅ API routes fixed for Next.js 15+ compatibility
3. ✅ Live updates working for all CRUD operations
4. ✅ Manual add student/faculty working
5. ✅ Bulk upload (CSV/Excel) working
6. ✅ PDF generation working
7. ✅ Build successful with no errors

---

## Quick Start

### 1. Start the Development Server
```bash
npm run dev
```

The app will be available at: http://localhost:3000

### 2. Login as Admin
- **Email**: manthanraithatha01@gmail.com
- **Password**: 12345678

---

## Testing Checklist

### ✅ Test 1: Manual Student Creation
1. Navigate to **Student Management**
2. Click **"+ Add Student"**
3. Fill in the form:
   - Name: Test Student
   - Email: test.student@example.com
   - Roll Number: CS999
   - Branch: Computer Science
   - Batch: 2024
4. Click **"Create Student"**

**Expected Result**:
- ✅ Student appears in table immediately
- ✅ PDF downloads automatically with credentials
- ✅ Success toast notification appears
- ✅ Modal closes automatically

---

### ✅ Test 2: Bulk Student Upload
1. Navigate to **Student Management**
2. Click **"⬆ Bulk Upload (Excel/CSV)"**
3. Select the file: `sample_students.csv` (provided in root directory)
4. Wait for processing

**Expected Result**:
- ✅ All 5 students appear in table immediately
- ✅ PDF downloads with all 5 credentials
- ✅ Success toast shows "5 students created"
- ✅ No errors in console

**Sample CSV Format**:
```csv
Name,Email,RollNumber,Branch,Batch
John Doe,john.doe@example.com,CS001,Computer Science,2024
Jane Smith,jane.smith@example.com,CS002,Computer Science,2024
```

---

### ✅ Test 3: Edit Student
1. Click **"✏️ Edit"** on any student
2. Change the name to "Updated Name"
3. Change branch to "Information Technology"
4. Click **"💾 Save Changes"**

**Expected Result**:
- ✅ Changes appear in table immediately
- ✅ No page refresh needed
- ✅ Success toast appears
- ✅ Modal closes

---

### ✅ Test 4: Delete Student
1. Click **"🗑 Delete"** on any student
2. Confirm deletion in the popup
3. Wait for processing

**Expected Result**:
- ✅ Student disappears from table immediately
- ✅ Success toast appears
- ✅ No errors

---

### ✅ Test 5: Search Students
1. Type a student name in the search bar
2. Wait for results

**Expected Result**:
- ✅ Table filters to show matching students only
- ✅ Search is case-insensitive
- ✅ Works for both name and email

---

### ✅ Test 6: Manual Faculty Creation
1. Navigate to **Faculty Management**
2. Click **"+ Add Faculty Member"**
3. Fill in the form:
   - Name: Dr. Test Professor
   - Email: test.prof@example.com
   - Department: Computer Science
   - Designation: Professor
4. Click **"Create Faculty"**

**Expected Result**:
- ✅ Faculty appears in table immediately
- ✅ PDF downloads with credentials
- ✅ Success toast appears

---

### ✅ Test 7: Bulk Faculty Upload
1. Navigate to **Faculty Management**
2. Click **"⬆ Bulk Upload (Excel/CSV)"**
3. Select the file: `sample_faculty.csv`

**Expected Result**:
- ✅ All 5 faculty members appear immediately
- ✅ PDF downloads with all credentials
- ✅ Success toast appears

**Sample CSV Format**:
```csv
Name,Email,Department,Designation
Dr. Robert Anderson,robert.anderson@example.com,Computer Science,Professor
```

---

### ✅ Test 8: Course Management
1. Navigate to **Courses**
2. Click **"+ Add New Course"**
3. Fill in:
   - Course Name: Data Structures
   - Description: Introduction to data structures
   - Assigned Faculty: Select any faculty
4. Click **"Create Course"**

**Expected Result**:
- ✅ Course appears in table immediately
- ✅ Faculty name shows correctly
- ✅ Status shows as "ONGOING"

---

### ✅ Test 9: Dashboard Stats
1. Navigate to **Dashboard Overview**
2. Check the stat cards

**Expected Result**:
- ✅ Faculty count is accurate
- ✅ Student count is accurate
- ✅ Course count is accurate
- ✅ Recent activity logs show latest actions

---

### ✅ Test 10: Activity Logs
1. Navigate to **Activity Logs**
2. Check the logs table

**Expected Result**:
- ✅ All create/update/delete actions are logged
- ✅ User names appear correctly
- ✅ Timestamps are accurate
- ✅ Action badges are color-coded

---

## Common Issues & Solutions

### Issue: "Email already exists" error
**Solution**: Each email must be unique. Use different emails or delete existing users first.

### Issue: PDF not downloading
**Solution**: 
- Check browser popup blocker settings
- Ensure jsPDF is properly installed: `npm install jspdf jspdf-autotable`

### Issue: "Unauthorized" error
**Solution**: 
- Token may have expired (24 hours)
- Logout and login again

### Issue: Changes not appearing
**Solution**: 
- Check browser console for errors
- Ensure database connection is working
- Verify .env.local has correct DATABASE_URL

---

## Sample Test Data Files

Two CSV files are provided in the root directory:
1. **sample_students.csv** - 5 sample students
2. **sample_faculty.csv** - 5 sample faculty members

You can use these to test bulk upload functionality.

---

## Excel File Format

For Excel files (.xlsx), use the same column headers:

**Students**:
| Name | Email | RollNumber | Branch | Batch |
|------|-------|------------|--------|-------|
| John | john@example.com | CS001 | CS | 2024 |

**Faculty**:
| Name | Email | Department | Designation |
|------|-------|------------|-------------|
| Dr. Smith | smith@example.com | CS | Professor |

---

## Browser Console

Open browser console (F12) to see:
- API request/response logs
- Any JavaScript errors
- Network activity

All operations should complete without errors.

---

## Next Steps

After testing, you can:
1. ✅ Deploy to production (Vercel recommended)
2. ✅ Add more features (assignments, grades, etc.)
3. ✅ Customize the UI/styling
4. ✅ Add email notifications
5. ✅ Integrate with Insforge for advanced features

---

## Support

If you encounter any issues:
1. Check the browser console for errors
2. Verify database connection in .env.local
3. Ensure all npm packages are installed
4. Try rebuilding: `npm run build`

**Everything should now work perfectly! 🎉**
