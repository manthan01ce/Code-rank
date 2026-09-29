# CodeRank - Educational Management System

> A modern, full-stack educational management platform built with Next.js and PostgreSQL.

## 🎉 Status: All Issues Fixed & Ready to Use!

All bugs have been resolved. The application is fully functional with live updates, bulk upload, and PDF generation working perfectly.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Open Browser
Navigate to: http://localhost:3000

---

## ✨ Features

- ✅ **Authentication** - JWT-based with role-based access control
- ✅ **Student Management** - Add, edit, deactivate/reactivate students with bulk upload
- ✅ **Faculty Management** - Add, edit, deactivate/reactivate faculty with bulk upload
- ✅ **Course Management** - Create and manage courses with faculty assignment
- ✅ **User Status Management** - Active/Inactive status with filtering (no permanent deletion)
- ✅ **Bulk Upload** - CSV/Excel support with auto-generated passwords
- ✅ **PDF Generation** - Automatic credential PDF downloads
- ✅ **Live Updates** - Real-time UI updates without page refresh
- ✅ **Activity Logging** - Track all system activities including status changes
- ✅ **Dashboard** - Statistics and recent activity overview
- ✅ **Search & Filter** - Real-time search and status filtering across all entities

---

## 📚 Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture, PgBouncer pooling, and execution pipeline
- **[TEST_GUIDE.md](TEST_GUIDE.md)** - Step-by-step testing instructions
- **[LAN_TESTING_GUIDE.md](LAN_TESTING_GUIDE.md)** - Local Area Network and lab deployment guide

---

## 📊 Tech Stack

- **Frontend**: Next.js 16.3.6 (App Router, Turbopack), React 19
- **Backend**: Next.js Serverless API Routes, BullMQ (Job Queue), Node.js worker
- **Database**: Neon PostgreSQL (Serverless) with PgBouncer Connection Pooling
- **Execution Engine**: Docker (Language Daemons for secure execution isolation)
- **Authentication**: JWT (24h expiry) + bcryptjs
- **Real-Time**: Socket.io + 15-second automatic polling with Page Visibility detection
- **PDF Generation**: jsPDF + jspdf-autotable
- **File Parsing**: ExcelJS, csv-parse
- **Styling**: Vanilla CSS Modules

---

## 🗂️ Project Structure

```
CodeRank/
├── frontend/
│   ├── src/
│   │   ├── app/                    # Next.js pages and API routes
│   │   │   ├── page.js            # Landing / Homepage
│   │   │   ├── login/             # Authentication portal
│   │   │   ├── admin/             # Admin dashboard & user management
│   │   │   ├── student/           # Student dashboard & practical solving
│   │   │   ├── faculty/           # Faculty dashboard & submissions
│   │   │   ├── code/              # Coding workspace
│   │   │   ├── practice/          # Sandbox practice
│   │   │   └── api/               # Serverless API routes
│   │   ├── components/            # Reusable UI components
│   │   ├── hooks/                 # Custom hooks (usePolling, useSocket, useAdminAuth)
│   │   └── lib/                   # Database connection, auth, execution utilities
│   ├── server.js                  # Custom Next.js + Socket.IO server
│   ├── next.config.mjs            # Next.js configuration
│   └── package.json               # Frontend dependencies
├── backend/                       # Standalone worker and services
├── vercel.json                    # Vercel deployment settings
├── ARCHITECTURE.md                # System architecture documentation
└── README.md                      # Main project documentation
```

---

## 🔧 Environment Variables

Create a `.env.local` file with:

```env
# Neon Serverless Postgres (Direct or PgBouncer Connection Pooler)
DATABASE_URL=postgresql://user:password@ep-xyz-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connection_limit=1
JWT_SECRET=your_secret_key
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_password
```

---

## 📦 Sample Data

Two CSV files are provided for testing bulk upload:
- `sample_students.csv` - 5 sample students
- `sample_faculty.csv` - 5 sample faculty members

---

## 🎯 What's Working

### Student Management
- ✅ Add manually → PDF downloads
- ✅ Bulk upload CSV/Excel → All added, PDF downloads
- ✅ Edit → Changes appear immediately
- ✅ Deactivate/Reactivate → Status changes immediately (no permanent deletion)
- ✅ Filter by status → Active/Inactive/All
- ✅ Search → Real-time filtering

### Faculty Management
- ✅ Add manually → PDF downloads
- ✅ Bulk upload CSV/Excel → All added, PDF downloads
- ✅ Edit → Changes appear immediately
- ✅ Deactivate/Reactivate → Status changes immediately (no permanent deletion)
- ✅ Filter by status → Active/Inactive/All
- ✅ Search → Real-time filtering

### Course Management
- ✅ Create → Appears immediately
- ✅ Edit → Changes appear immediately
- ✅ Delete → Removed immediately
- ✅ Assign faculty → Works correctly

### Dashboard
- ✅ Live statistics
- ✅ Recent activity logs
- ✅ Color-coded badges

---

## 🚀 Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Connect to Vercel
3. Add environment variables
4. Deploy

### Other Platforms
- Netlify
- Railway
- Render
- AWS/Azure/GCP

---

## 📝 Database Schema

### Users
- id, name, email, password (hashed), role, status, extra_info (JSONB), created_at

### Courses
- id, name, description, assigned_faculty, status, created_at

### Activity Logs
- id, user_id, action, details, created_at

---

## 🆘 Troubleshooting

### Issue: Changes not appearing
- Check browser console (F12) for errors
- Verify database connection in .env.local
- Clear browser cache and localStorage

### Issue: PDF not downloading
- Check browser popup blocker
- Ensure jsPDF is installed: `npm install jspdf jspdf-autotable`

### Issue: "Unauthorized" error
- Token may have expired (24 hours)
- Logout and login again

---

## 📞 Support

For detailed help, check:
1. **TESTING_GUIDE.md** - Step-by-step testing
2. **FIXES_APPLIED.md** - Technical details
3. **ARCHITECTURE.md** - System design
4. Browser console (F12) for errors

---

## 🎨 Features Roadmap (Optional)

- [ ] Student portal (view courses, submit assignments)
- [ ] Faculty portal (grade students, manage courses)
- [ ] Assignment submission system
- [ ] Grading system
- [ ] Email notifications
- [ ] Dark mode
- [ ] Mobile app

---

## 📄 License

This project is private and proprietary.

---

## 🙏 Credits

Built with Next.js, React, and Neon PostgreSQL.

---

**Everything is working perfectly! Start testing and enjoy! 🎉**

For detailed testing instructions, see [TESTING_GUIDE.md](TESTING_GUIDE.md)
