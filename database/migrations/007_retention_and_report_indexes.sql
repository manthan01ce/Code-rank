-- Bounded operational retention and ID-keyset student/grade pages.
CREATE INDEX IF NOT EXISTS idx_workspaces_retention ON student_workspaces(saved_at, student_id, practical_id, language);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_activity_logs_retention ON activity_logs(created_at, id);
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_practicals_active_id ON practicals(id DESC) WHERE status = 'active';
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_users_active_students_id ON users(id) WHERE role = 'student' AND status = 'active';
