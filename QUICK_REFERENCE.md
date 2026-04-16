# Quick Reference Guide - CodeRank

## 🚀 Common Commands

### Development
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Database Management

#### List Users
```bash
# List all students
node scripts/list_students.js

# List all faculty
node scripts/list_faculty.js
```

#### Permanently Delete Users
```bash
# Delete any user (student or faculty) - Unified script
node scripts/permanent_delete_user.js user@example.com
node scripts/permanent_delete_user.js 123

# Delete student specifically
node scripts/permanent_delete_student.js student@example.com

# Delete faculty specifically
node scripts/permanent_delete_faculty.js faculty@example.com
```

#### Check Students Count
```bash
node scripts/check_students.js
```

#### Initialize Database
```bash
node scripts/init_db.js
```

## 📤 Bulk Upload

### Expected CSV/Excel Format

#### For Students
| Name | Email | RollNumber | Branch | Batch |
|------|-------|------------|--------|-------|
| John Doe | john@test.com | 2021001 | CS | 2025 |
| Jane Smith | jane@test.com | 2021002 | CE | 2025 |

#### For Faculty
| Name | Email | Department | Designation |
|------|-------|------------|-------------|
| Dr. Smith | smith@test.com | Computer Science | Professor |
| Dr. Jones | jones@test.com | Civil Engineering | Associate Professor |

### Upload Behavior

1. **New Users**: Created with auto-generated password → PDF downloaded
2. **Existing Users**: Skipped → Alert shown with details
3. **Invalid Data**: Skipped → Reason shown in alert

### What Gets Skipped?

- Users with existing email addresses
- Rows with missing name or email
- Rows with invalid email format

## 🔐 User Management

### User Status
- **Active**: User can login and use the system
- **Inactive**: User is deactivated (cannot login)

### Deactivate vs Permanent Delete

#### Deactivate (Soft Delete)
- Sets status to 'inactive'
- User data remains in database
- Can be reactivated later
- **Use this by default**

```
Click "Deactivate" button in admin panel
```

#### Permanent Delete (Hard Delete)
- Completely removes user from database
- Cannot be undone
- **Use only when necessary**

```bash
node scripts/permanent_delete_student.js <email_or_id>
```

## 📊 Admin Dashboard Features

### Students Page
- View all students (active/inactive/all)
- Add student manually
- Edit student details
- Deactivate/Reactivate students
- Bulk upload via CSV/Excel
- Search by name or email

### Faculty Page
- View all faculty (active/inactive/all)
- Add faculty manually
- Edit faculty details
- Deactivate/Reactivate faculty
- Bulk upload via CSV/Excel
- Search by name or email

### Courses Page
- Create courses
- Assign faculty to courses
- View course details
- Delete courses

### Logs Page
- View all activity logs
- Filter by action type
- Search by user or details

## 🔍 Troubleshooting

### Issue: Bulk upload skips all users
**Cause**: All users already exist in database  
**Solution**: Check if users were previously uploaded. Use permanent delete if needed.

### Issue: Can't login after bulk upload
**Cause**: Password is in the downloaded PDF  
**Solution**: Check the PDF file downloaded after bulk upload for credentials.

### Issue: Student not showing in list
**Cause**: Status filter is set to "Active Only" but student is inactive  
**Solution**: Change filter to "All Students" or "Inactive Only"

### Issue: Want to remove test data
**Solution**: Use permanent delete script
```bash
node scripts/permanent_delete_student.js <email>
```

## 📝 Environment Variables

Required in `.env.local`:
```env
DATABASE_URL=your_neon_database_url
JWT_SECRET=your_jwt_secret
```

## 🎯 Best Practices

1. **Always backup** before bulk operations
2. **Use deactivate** instead of permanent delete when possible
3. **Download PDFs immediately** after bulk upload (passwords are only shown once)
4. **Check skipped users** alert to understand what was not uploaded
5. **Use filters** to view active/inactive users separately
6. **Search function** works on both name and email

## 📞 Quick Actions

### Reset Admin Password
```bash
node scripts/update_status.js
```

### View Database Schema
```bash
node scripts/check_db.js
```

### Test API Endpoints
```bash
node test_api.js
```

## 🔗 Important URLs

- **Development**: http://localhost:3000
- **Admin Login**: http://localhost:3000
- **Student Dashboard**: http://localhost:3000/student
- **Faculty Dashboard**: http://localhost:3000/faculty
- **Admin Dashboard**: http://localhost:3000/admin

## 📦 Default Credentials

After running `init_db.js`:
- **Email**: admin@coderank.com
- **Password**: admin123

**⚠️ Change this immediately in production!**

---

**Last Updated:** April 16, 2026
