/**
 * packages/core/src/db/queries/index.js
 * Optimized SQL query fragments and query builders
 */
import sql from '../client.js';

export const Queries = {
  findUserById: (id) => sql`SELECT * FROM users WHERE id = ${id}`,
  findUserByEmail: (email) => sql`SELECT * FROM users WHERE email = ${email}`,
  getActivePracticalsByCourse: (courseId) => sql`
    SELECT * FROM practicals 
    WHERE course_id = ${courseId} AND status = 'active'
    ORDER BY id ASC
  `,
  getCourseWithFaculty: (courseId) => sql`
    SELECT c.*, cf.faculty_id, cf.is_co_coordinator
    FROM courses c
    LEFT JOIN course_faculty cf ON c.id = cf.course_id
    WHERE c.id = ${courseId}
  `
};
