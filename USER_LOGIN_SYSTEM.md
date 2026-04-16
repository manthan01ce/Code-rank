# User Login System - Complete Guide

## 🎯 Overview

The CodeRank system allows newly created users (students and faculty) to log in using their email and auto-generated password. Each user gets unique credentials that are provided in a downloadable PDF.

## 🔐 How It Works

### 1. User Creation Flow

#### Manual Creation (Admin Panel)
1. Admin clicks "Add Student" or "Add Faculty"
2. Admin enters: Name, Email, and other details
3. System automatically:
   - Generates a secure random password
   - Hashes the password using bcrypt
   - Stores user in database
   - Returns plain password in response
   - Downloads PDF with credentials

#### Bulk Upload (CSV/Excel)
1. Admin uploads CSV/Excel file with user details
2. For each user, system:
   - Generates unique secure password
   - Hashes and stores in database
   - Collects all credentials
3. Downloads single PDF with all user credentials

### 2. Password Generation

**Function:** `generateSecurePassword(length = 10)`

**Password Requirements:**
- Length: 10 characters (default)
- Contains at least:
  - 1 uppercase letter (A-Z)
  - 1 lowercase letter (a-z)
  - 1 digit (2-9)
  - 1 special character (!@#$%)
- Randomly shuffled for security

**Example Passwords:**
- `K7m@Pq3nR!`
- `B9#xTw2Lp@`
- `F4!Hn8Yz@m`

### 3. Login Process

1. User receives email and password (from PDF)
2. User goes to: http://localhost:3000 (or your domain)
3. User enters email and password
4. System:
   - Validates credentials
   - Checks account status (must be 'active')
   - Generates JWT token (valid for 24 hours)
   - Logs activity
   - Redirects based on role

### 4. Role-Based Redirection

| Role | Redirect URL | Message Shown |
|------|-------------|---------------|
| Admin | `/admin` | Admin Dashboard |
| Student | `/student` | "Student Logged In Successfully" |
| Faculty | `/faculty` | "Faculty Logged In Successfully" |

## 📋 Current Dashboard Pages

### Student Dashboard (`/student`)
**Display:**
```
✓ (green checkmark icon)

Student Logged In Successfully

Welcome, [Name]!
Your student account is active and ready to use.

┌─────────────────────────────┐
│ Email: student@example.com  │
│ Role: Student               │
└─────────────────────────────┘

[← Back to Login]
```

### Faculty Dashboard (`/faculty`)
**Display:**
```
🎓 (graduation cap icon)

Faculty Logged In Successfully

Welcome, [Name]!
Your faculty account is active and ready to use.

┌─────────────────────────────┐
│ Email: faculty@example.com  │
│ Role: Faculty               │
└─────────────────────────────┘

[← Back to Login]
```

## 🧪 Testing

### Test Users Created
Run the test script to create sample users:
```bash
node test_user_login.js
```

**Test Credentials:**

**Student:**
- Email: `test.student@example.com`
- Password: `Student123!`

**Faculty:**
- Email: `test.faculty@example.com`
- Password: `Faculty123!`

### Manual Testing Steps

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Open Browser**
   ```
   http://localhost:3000
   ```

3. **Test Student Login**
   - Enter student email and password
   - Click "Sign In"
   - Should redirect to `/student`
   - Should show "Student Logged In Successfully"

4. **Test Faculty Login**
   - Click "Back to Login"
   - Enter faculty email and password
   - Click "Sign In"
   - Should redirect to `/faculty`
   - Should show "Faculty Logged In Successfully"

## 📄 PDF Credentials Format

When users are created, a PDF is downloaded with this format:

```
CodeRank — Student Credentials
Generated: 4/16/2026, 10:30:45 PM | CONFIDENTIAL — delete after distribution

┌──────────────┬─────────────────────────┬──────────┬────────┬───────┬──────────────┐
│ Name         │ Email                   │ Roll No  │ Branch │ Batch │ Password     │
├──────────────┼─────────────────────────┼──────────┼────────┼───────┼──────────────┤
│ John Doe     │ john.doe@example.com    │ 2021001  │ CS     │ 2025  │ K7m@Pq3nR!   │
│ Jane Smith   │ jane.smith@example.com  │ 2021002  │ CE     │ 2025  │ B9#xTw2Lp@   │
└──────────────┴─────────────────────────┴──────────┴────────┴───────┴──────────────┘
```

## 🔒 Security Features

### Password Security
- ✅ Passwords are hashed using bcrypt (10 rounds)
- ✅ Plain passwords never stored in database
- ✅ Passwords only shown once (in PDF)
- ✅ Each user gets unique password

### Authentication Security
- ✅ JWT tokens expire after 24 hours
- ✅ Tokens include user ID, email, role, name
- ✅ Inactive accounts cannot login
- ✅ Failed login attempts logged

### Session Management
- ✅ Token stored in localStorage
- ✅ User data cached in localStorage
- ✅ Logout clears all local data
- ✅ Protected routes check authentication

## 🔄 User Lifecycle

### 1. Creation
```
Admin creates user → Password generated → PDF downloaded
```

### 2. First Login
```
User receives PDF → Enters credentials → Redirected to dashboard
```

### 3. Subsequent Logins
```
User enters credentials → Token generated → Dashboard shown
```

### 4. Logout
```
User clicks logout → Token cleared → Redirected to login
```

### 5. Deactivation
```
Admin deactivates → Status = 'inactive' → Login blocked
```

### 6. Reactivation
```
Admin reactivates → Status = 'active' → Login allowed
```

## 📊 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,  -- bcrypt hash
  role VARCHAR(50) NOT NULL,       -- 'admin', 'student', 'faculty'
  status VARCHAR(50) DEFAULT 'active',  -- 'active', 'inactive'
  extra_info JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Activity Logs Table
```sql
CREATE TABLE activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,  -- 'LOGIN', 'LOGOUT', etc.
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🛠️ API Endpoints

### Login
**POST** `/api/auth/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "K7m@Pq3nR!"
}
```

**Response (Success):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 252,
    "name": "John Doe",
    "email": "user@example.com",
    "role": "student"
  }
}
```

**Response (Error):**
```json
{
  "error": "Invalid email or password"
}
```

### Create User
**POST** `/api/users`

**Request:**
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "role": "student",
  "extra_info": {
    "roll_number": "2021001",
    "branch": "CS",
    "batch": "2025"
  }
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 252,
    "name": "John Doe",
    "email": "john.doe@example.com",
    "role": "student",
    "status": "active",
    "extra_info": { ... }
  },
  "rawPassword": "K7m@Pq3nR!"
}
```

## 🎨 Frontend Flow

### Login Page (`/`)
```javascript
1. User enters email and password
2. POST to /api/auth/login
3. On success:
   - Store token in localStorage
   - Store user data in localStorage
   - Redirect based on role:
     - admin → /admin
     - student → /student
     - faculty → /faculty
4. On error:
   - Show error message
```

### Protected Pages
```javascript
1. Check if token exists in localStorage
2. If no token → redirect to /
3. If token exists → show dashboard
4. Logout button clears localStorage and redirects to /
```

## 🔧 Configuration

### Environment Variables
```env
# .env.local
DATABASE_URL=your_neon_database_url
JWT_SECRET=your_jwt_secret_key
```

### JWT Configuration
- **Algorithm:** HS256
- **Expiration:** 24 hours
- **Payload:** id, email, role, name

## 📝 Common Scenarios

### Scenario 1: New Student Registration
```
1. Admin uploads CSV with student details
2. System generates passwords for all students
3. PDF downloaded with all credentials
4. Admin distributes PDF to students
5. Students login with their credentials
6. Students see "Student Logged In Successfully"
```

### Scenario 2: Forgot Password
```
Currently not implemented. Options:
1. Admin can reset password manually
2. Admin creates new user with same email (after deleting old)
3. Future: Implement password reset flow
```

### Scenario 3: Bulk User Creation
```
1. Prepare CSV with columns: Name, Email, RollNumber, Branch, Batch
2. Upload via admin panel
3. System creates all users with unique passwords
4. Download PDF with all credentials
5. Distribute to users
```

## 🚀 Future Enhancements

Potential improvements:
1. **Password Reset:** Email-based password reset
2. **Change Password:** Allow users to change their password
3. **Two-Factor Authentication:** Add 2FA for security
4. **Session Management:** View active sessions
5. **Password Policy:** Enforce password complexity
6. **Login History:** Show login attempts and history

## 🧹 Cleanup Test Users

After testing, remove test users:
```bash
node scripts/permanent_delete_user.js test.student@example.com
node scripts/permanent_delete_user.js test.faculty@example.com
```

---

**Last Updated:** April 16, 2026  
**Status:** ✅ Fully Functional
