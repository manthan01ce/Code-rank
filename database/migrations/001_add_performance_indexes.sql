-- Idempotent indexes; migration transaction is recorded only on success.
CREATE INDEX IF NOT EXISTS idx_courses_semester ON courses(semester);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_courses_course_code ON courses(course_code);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_practical_submissions_student ON practical_submissions(student_id);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_practical_submissions_practical ON practical_submissions(practical_id);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_course_faculty_faculty ON course_faculty(faculty_id);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_course_faculty_course ON course_faculty(course_id);
