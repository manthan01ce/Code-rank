-- ============================================================================
-- Performance Indexes for CodeRank
-- ============================================================================
-- This migration adds indexes to frequently queried columns to improve
-- query performance and reduce full table scans.
-- 
-- Note: CREATE INDEX CONCURRENTLY cannot be combined with IF NOT EXISTS.
-- The migration script handles duplicate index errors gracefully.
-- ============================================================================

-- Courses table indexes
-- Used in: CourseService.listCourses (semester and course_code filters)
CREATE INDEX CONCURRENTLY idx_courses_semester 
ON courses(semester);

CREATE INDEX CONCURRENTLY idx_courses_course_code 
ON courses(course_code);

-- Departments table indexes
-- Used in: CourseService.listDepartments (name searches)
CREATE INDEX CONCURRENTLY idx_departments_name 
ON departments(name);

-- Users table indexes
-- Used in: Auth queries, user filtering by role/status
CREATE INDEX CONCURRENTLY idx_users_role 
ON users(role);

CREATE INDEX CONCURRENTLY idx_users_status 
ON users(status);

-- Practical submissions indexes
-- Used in: SubmissionService queries, faculty viewing submissions
CREATE INDEX CONCURRENTLY idx_practical_submissions_student 
ON practical_submissions(student_id);

CREATE INDEX CONCURRENTLY idx_practical_submissions_practical 
ON practical_submissions(practical_id);

-- Course faculty mapping indexes
-- Used in: CourseService.getFacultyCourses, faculty authorization checks
CREATE INDEX CONCURRENTLY idx_course_faculty_faculty 
ON course_faculty(faculty_id);

CREATE INDEX CONCURRENTLY idx_course_faculty_course 
ON course_faculty(course_id);
