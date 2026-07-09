# CodeRank - Architecture Overview

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Login      │  │    Admin     │  │   Student/   │      │
│  │   Page       │  │  Dashboard   │  │   Faculty    │      │
│  │  (page.js)   │  │              │  │  Dashboard   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Admin Management Pages                        │   │
│  ├──────────────┬──────────────┬──────────────┬────────┤   │
│  │   Students   │   Faculty    │   Courses    │  Logs  │   │
│  │   (CRUD)     │   (CRUD)     │   (CRUD)     │ (View) │   │
│  └──────────────┴──────────────┴──────────────┴────────┘   │
│                                                               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ HTTP Requests (JWT Token)
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                      API ROUTES (Next.js)                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  /api/auth/login          - POST (Login)             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  /api/users               - GET, POST, PUT, DELETE   │   │
│  │  /api/users/[id]          - PUT, DELETE              │   │
│  │  /api/users/bulk          - POST (CSV/Excel)         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  /api/courses             - GET, POST                │   │
│  │  /api/courses/[id]        - PUT, DELETE              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  /api/stats               - GET (Dashboard stats)    │   │
│  │  /api/logs                - GET (Activity logs)      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ SQL Queries
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                   DATABASE (Neon PostgreSQL)                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  users                                                │   │
│  │  ├─ id, name, email, password (hashed)               │   │
│  │  ├─ role (admin/faculty/student)                     │   │
│  │  ├─ status (active/inactive)                         │   │
│  │  ├─ extra_info (JSONB) ← Student/Faculty details     │   │
│  │  └─ created_at                                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  courses                                              │   │
│  │  ├─ id, name, description                            │   │
│  │  ├─ assigned_faculty (FK to users)                   │   │
│  │  ├─ status (ongoing/completed)                       │   │
│  │  └─ created_at                                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  activity_logs                                        │   │
│  │  ├─ id, user_id, action, details                     │   │
│  │  └─ created_at                                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow

### 1. User Login Flow
```
User enters credentials
    ↓
POST /api/auth/login
    ↓
Verify password (bcrypt)
    ↓
Generate JWT token (24h expiry)
    ↓
Return token + user data
    ↓
Store in localStorage
    ↓
Redirect based on role
```

### 2. Create Student Flow (Manual)
```
Admin fills form
    ↓
POST /api/users
    ↓
Generate secure password
    ↓
Hash password (bcrypt)
    ↓
Insert into database
    ↓
Return user + rawPassword
    ↓
Update frontend state (live)
    ↓
Generate PDF with credentials
    ↓
Auto-download PDF
```

### 3. Bulk Upload Flow
```
Admin selects CSV/Excel file
    ↓
POST /api/users/bulk
    ↓
Parse file (XLSX library)
    ↓
For each row:
  - Generate password
  - Hash password
  - Insert into database
    ↓
Return all created users + passwords
    ↓
Update frontend state (live)
    ↓
Generate PDF with all credentials
    ↓
Auto-download PDF
```

### 4. Edit Student Flow
```
Admin clicks Edit
    ↓
Modal opens with current data
    ↓
Admin changes fields
    ↓
PUT /api/users/[id]
    ↓
Update database
    ↓
Return updated user
    ↓
Update frontend state (live)
    ↓
Show success toast
```

### 5. Delete Student Flow
```
Admin clicks Delete
    ↓
Confirm dialog
    ↓
DELETE /api/users/[id]
    ↓
Remove from database
    ↓
Log activity
    ↓
Update frontend state (live)
    ↓
Show success toast
```

---

## 🔐 Authentication Flow

```
┌─────────────────────────────────────────────────────────┐
│                    Login Request                         │
│  { email: "admin@example.com", password: "12345678" }   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Verify Credentials (bcrypt)                 │
│  - Query user from database                              │
│  - Compare hashed password                               │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Generate JWT Token                          │
│  Payload: { id, email, role, name }                     │
│  Secret: JWT_SECRET from .env                            │
│  Expiry: 24 hours                                        │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Return to Client                            │
│  { token: "eyJhbGc...", user: {...} }                   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│         Store in localStorage                            │
│  localStorage.setItem('token', token)                    │
│  localStorage.setItem('user', JSON.stringify(user))      │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│         All Future Requests Include Token                │
│  Authorization: Bearer <token>                           │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Component Structure

```
src/
├── app/
│   ├── page.js                    # Login page
│   ├── layout.js                  # Root layout
│   ├── globals.css                # Global styles
│   │
│   ├── admin/
│   │   ├── layout.js              # Admin layout (with sidebar)
│   │   ├── page.js                # Dashboard
│   │   ├── students/page.js       # Student management
│   │   ├── faculty/page.js        # Faculty management
│   │   ├── courses/page.js        # Course management
│   │   ├── logs/page.js           # Activity logs
│   │   └── settings/page.js       # Settings
│   │
│   ├── student/page.js            # Student dashboard
│   ├── faculty/page.js            # Faculty dashboard
│   │
│   └── api/
│       ├── auth/login/route.js    # Login endpoint
│       ├── users/
│       │   ├── route.js           # User CRUD
│       │   ├── [id]/route.js      # Single user operations
│       │   └── bulk/route.js      # Bulk upload
│       ├── courses/
│       │   ├── route.js           # Course CRUD
│       │   └── [id]/route.js      # Single course operations
│       ├── stats/route.js         # Dashboard stats
│       └── logs/route.js          # Activity logs
│
├── components/
│   ├── AdminSidebar.js            # Navigation sidebar
│   └── LoadingOverlay.js          # Loading spinner
│
└── lib/
    ├── db.js                      # Database connection
    ├── auth.js                    # Auth utilities (JWT, bcrypt)
    └── pdfGenerator.js            # PDF generation
```

---

## 🔧 Utility Functions

### lib/auth.js
```javascript
- generateToken(user)           // Create JWT token
- verifyToken(token)             // Verify JWT token
- hashPassword(password)         // Hash password with bcrypt
- comparePassword(pass, hash)    // Compare password with hash
- generateSecurePassword()       // Generate random password
- getUserFromRequest(request)    // Extract user from JWT
```

### lib/db.js
```javascript
- sql                            // Neon database connection
```

### lib/pdfGenerator.js
```javascript
- generateUserCredentialsPDF()   // Create PDF with credentials
```

---

## 🎨 UI Components

### Reusable Elements
- `.btn-primary` - Primary action button
- `.btn-small` - Small action button
- `.input-field` - Text input field
- `.search-bar` - Search input
- `.table-container` - Table wrapper
- `.stat-card` - Dashboard stat card
- `.status-badge` - Status indicator
- `.toast` - Notification message

### Layouts
- `.login-container` - Login page layout
- `.dashboard-layout` - Admin dashboard layout
- `.sidebar` - Navigation sidebar
- `.main-content` - Main content area

---

## 🔄 State Management

### Local State (useState)
- Form inputs
- Modal visibility
- Loading states
- Toast notifications
- Search queries

### Persistent State (localStorage)
- JWT token
- User data (id, name, email, role)

### Server State
- Users list
- Courses list
- Activity logs
- Dashboard statistics

---

## 🚀 Performance Optimizations

1. **Live Updates**: No page refresh needed for CRUD operations
2. **Optimistic UI**: Updates appear immediately
3. **Efficient Queries**: Only fetch necessary data
4. **Indexed Columns**: Email (unique index)
5. **Connection Pooling**: Neon serverless handles this
6. **Static Generation**: Login/dashboard pages pre-rendered

---

## 🔒 Security Features

1. **Password Hashing**: bcrypt with 10 salt rounds
2. **JWT Authentication**: 24-hour token expiry
3. **Role-Based Access**: Admin-only routes protected
4. **SQL Injection Prevention**: Parameterized queries
5. **HTTPS**: Required for production
6. **Unique Constraints**: Email uniqueness enforced

---

## 📊 Database Relationships

```
users (1) ──────────── (many) activity_logs
  │
  │ (1 to many)
  │
  └──────────────────── (many) courses
                        (assigned_faculty FK)
```

---

This architecture provides:
- ✅ Scalability
- ✅ Maintainability
- ✅ Security
- ✅ Performance
- ✅ User Experience
