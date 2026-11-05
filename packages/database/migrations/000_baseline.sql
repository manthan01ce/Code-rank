-- Creates an empty database without changing existing table definitions.
CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY, first_name text, last_name text, name text NOT NULL,
  email text NOT NULL UNIQUE, password text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','faculty','student')),
  status text NOT NULL DEFAULT 'active', extra_info jsonb NOT NULL DEFAULT '{}',
  session_token text, created_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS departments (
  id serial PRIMARY KEY, name text NOT NULL UNIQUE, institute_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS courses (
  id serial PRIMARY KEY, course_code text NOT NULL UNIQUE, name text NOT NULL,
  semester integer NOT NULL CHECK (semester > 0),
  assigned_faculty integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS course_faculty (
  course_id integer NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  faculty_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_co_coordinator boolean NOT NULL DEFAULT false, PRIMARY KEY(course_id, faculty_id)
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS practicals (
  id serial PRIMARY KEY, faculty_id integer NOT NULL REFERENCES users(id),
  course_id integer NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  batch_id text, title text NOT NULL, description text, instructions text,
  total_marks numeric NOT NULL DEFAULT 0 CHECK (total_marks >= 0),
  difficulty text DEFAULT 'Easy', is_challenge boolean NOT NULL DEFAULT false,
  starter_code jsonb DEFAULT '{}', input_format text, output_format text,
  constraints text, sample_input text, sample_output text, topics text,
  status text NOT NULL DEFAULT 'active', start_time timestamptz, end_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS practical_test_cases (
  id serial PRIMARY KEY, practical_id integer NOT NULL REFERENCES practicals(id) ON DELETE CASCADE,
  input text NOT NULL DEFAULT '', expected text NOT NULL DEFAULT '',
  marks numeric NOT NULL DEFAULT 0 CHECK (marks >= 0), is_hidden boolean NOT NULL DEFAULT false,
  time_limit numeric, memory_limit numeric, order_index integer NOT NULL DEFAULT 0, label text
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS practical_submissions (
  id serial PRIMARY KEY, student_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  practical_id integer NOT NULL REFERENCES practicals(id) ON DELETE CASCADE,
  code bytea NOT NULL, language text NOT NULL, status text NOT NULL,
  raw_marks numeric NOT NULL DEFAULT 0, normalized_marks numeric NOT NULL DEFAULT 0,
  execution_time_ms numeric NOT NULL DEFAULT 0, is_late boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS practical_submission_cases (
  id serial PRIMARY KEY, submission_id integer NOT NULL REFERENCES practical_submissions(id) ON DELETE CASCADE,
  test_case_id integer NOT NULL REFERENCES practical_test_cases(id) ON DELETE CASCADE,
  passed boolean NOT NULL, marks_awarded numeric NOT NULL DEFAULT 0,
  actual_output text, error_message text, execution_time_ms numeric NOT NULL DEFAULT 0
);
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS student_workspaces (
  student_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  practical_id integer NOT NULL REFERENCES practicals(id) ON DELETE CASCADE,
  language text NOT NULL, latest_code bytea NOT NULL, saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(student_id, practical_id, language)
);
-- statement-breakpoint
-- Keep audit history even after deleting a user, including fallback admin ID 0.
CREATE TABLE IF NOT EXISTS activity_logs (
  id bigserial PRIMARY KEY, user_id integer, action text NOT NULL,
  details text, created_at timestamptz NOT NULL DEFAULT now()
);
