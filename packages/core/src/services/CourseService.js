import sql from '../db/client.js';
import { createClient } from 'redis';
import { coalesce } from '../utils/cache-coalescer.js';

let redis = null;
let redisConnecting = null;

async function getRedis() {
  if (redis && redis.isOpen) return redis;
  if (redisConnecting) return redisConnecting;

  redisConnecting = (async () => {
    try {
      const client = createClient({
        socket: { 
          host: process.env.REDIS_HOST || '127.0.0.1', 
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          connectTimeout: 2000,
          reconnectStrategy: (retries) => (retries > 3 ? false : Math.min(retries * 500, 2000))
        }
      });
      client.on('error', () => {}); // Silently catch offline errors
      await client.connect();
      redis = client;
      return redis;
    } catch {
      redis = null;
      return null;
    } finally {
      redisConnecting = null;
    }
  })();

  return redisConnecting;
}

async function invalidateCachePattern(pattern) {
  try {
    const client = await getRedis();
    if (!client) return;

    // Use SCAN to find and delete all matching keys
    const keys = [];
    for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key);
    }
    
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (err) {
    // Fail silently - cache invalidation failure shouldn't break the request
  }
}

export class CourseService {
  /**
   * List courses with optional filtering
   */
  static async listCourses(user, { search, semester } = {}) {
    if (!user || (user.role !== 'admin' && user.role !== 'student' && user.role !== 'faculty')) {
      throw { status: 401, message: 'Unauthorized' };
    }

    // Create cache key based on query parameters
    const cacheKey = `courses:${JSON.stringify({ search, semester })}`;
    
    // Try to get from cache
    try {
      const client = await getRedis();
      if (client) {
        const cached = await client.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }
    } catch (err) {
      // Fail open - if cache fails, continue to DB
    }

    // Use coalescer to prevent thundering herd on cache miss
    return coalesce(cacheKey, async () => {
      let result;
      if (search) {
        const searchPattern = `%${search}%`;
        result = await sql`
          SELECT * FROM courses 
          WHERE name ILIKE ${searchPattern} OR course_code ILIKE ${searchPattern}
          ORDER BY created_at DESC
        `;
      } else if (semester) {
        result = await sql`
          SELECT * FROM courses 
          WHERE semester = ${parseInt(semester)}
          ORDER BY created_at DESC
        `;
      } else {
        result = await sql`
          SELECT * FROM courses 
          ORDER BY created_at DESC
        `;
      }

      // Store in cache with 60s TTL
      try {
        const client = await getRedis();
        if (client) {
          await client.setEx(cacheKey, 60, JSON.stringify(result));
        }
      } catch (err) {
        // Fail open - cache write failure shouldn't break the request
      }

      return result;
    });
  }

  /**
   * Create a course (admin only)
   */
  static async createCourse(adminUser, { course_code, name, semester }) {
    if (!adminUser || adminUser.role !== 'admin') {
      throw { status: 401, message: 'Unauthorized' };
    }

    if (!course_code || !name || !semester) {
      throw { status: 400, message: 'Missing required fields' };
    }

    const result = await sql`
      INSERT INTO courses (course_code, name, semester)
      VALUES (${course_code}, ${name}, ${semester})
      RETURNING *
    `;

    await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${adminUser.id}, 'CREATE_COURSE', ${`Created course ${name}`})`;

    // Invalidate courses cache
    await invalidateCachePattern('courses:*');

    return result[0];
  }

  /**
   * Update a course (admin only)
   */
  static async updateCourse(adminUser, id, { course_code, name, semester }) {
    if (!adminUser || adminUser.role !== 'admin') {
      throw { status: 401, message: 'Unauthorized' };
    }

    const result = await sql`
      UPDATE courses 
      SET course_code = ${course_code}, name = ${name}, semester = ${semester}
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (result.length === 0) {
      throw { status: 404, message: 'Course not found' };
    }

    await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${adminUser.id}, 'UPDATE_COURSE', ${`Updated course ${name}`})`;
    
    // Invalidate courses cache
    await invalidateCachePattern('courses:*');
    
    return result[0];
  }

  /**
   * Delete a course (admin only)
   */
  static async deleteCourse(adminUser, id) {
    if (!adminUser || adminUser.role !== 'admin') {
      throw { status: 401, message: 'Unauthorized' };
    }

    const courseRows = await sql`SELECT name FROM courses WHERE id = ${parseInt(id)}`;
    if (courseRows.length === 0) {
      throw { status: 404, message: 'Course not found' };
    }

    const courseName = courseRows[0].name;
    await sql`DELETE FROM courses WHERE id = ${parseInt(id)}`;

    await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${adminUser.id}, 'DELETE_COURSE', ${`Deleted course ${courseName}`})`;
    
    // Invalidate courses cache
    await invalidateCachePattern('courses:*');
    
    return { success: true };
  }

  /**
   * List departments
   */
  static async listDepartments(adminUser, { search } = {}) {
    if (!adminUser || adminUser.role !== 'admin') {
      throw { status: 401, message: 'Unauthorized' };
    }

    // Create cache key based on query parameters
    const cacheKey = `departments:${JSON.stringify({ search })}`;
    
    // Try to get from cache
    try {
      const client = await getRedis();
      if (client) {
        const cached = await client.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }
    } catch (err) {
      // Fail open - if cache fails, continue to DB
    }

    // Use coalescer to prevent thundering herd on cache miss
    return coalesce(cacheKey, async () => {
      let result;
      if (search) {
        const searchPattern = `%${search}%`;
        result = await sql`
          SELECT * FROM departments 
          WHERE name ILIKE ${searchPattern} OR institute_name ILIKE ${searchPattern}
          ORDER BY created_at DESC
        `;
      } else {
        result = await sql`
          SELECT * FROM departments 
          ORDER BY created_at DESC
        `;
      }

      // Store in cache with 60s TTL
      try {
        const client = await getRedis();
        if (client) {
          await client.setEx(cacheKey, 60, JSON.stringify(result));
        }
      } catch (err) {
        // Fail open - cache write failure shouldn't break the request
      }

      return result;
    });
  }

  /**
   * Create department
   */
  static async createDepartment(adminUser, { name, institute_name }) {
    if (!adminUser || adminUser.role !== 'admin') {
      throw { status: 401, message: 'Unauthorized' };
    }

    if (!name || !institute_name) {
      throw { status: 400, message: 'Name and Institute are required' };
    }

    const result = await sql`
      INSERT INTO departments (name, institute_name)
      VALUES (${name}, ${institute_name})
      RETURNING *
    `;

    await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${adminUser.id}, 'CREATE_DEPARTMENT', ${`Created department ${name}`})`;
    
    // Invalidate departments cache
    await invalidateCachePattern('departments:*');
    
    return result[0];
  }

  /**
   * Update department
   */
  static async updateDepartment(adminUser, id, { name, institute_name }) {
    if (!adminUser || adminUser.role !== 'admin') {
      throw { status: 401, message: 'Unauthorized' };
    }

    const result = await sql`
      UPDATE departments 
      SET name = ${name}, institute_name = ${institute_name}
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;

    if (result.length === 0) {
      throw { status: 404, message: 'Department not found' };
    }

    await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${adminUser.id}, 'UPDATE_DEPARTMENT', ${`Updated department ${name}`})`;
    
    // Invalidate departments cache
    await invalidateCachePattern('departments:*');
    
    return result[0];
  }

  /**
   * Delete department
   */
  static async deleteDepartment(adminUser, id) {
    if (!adminUser || adminUser.role !== 'admin') {
      throw { status: 401, message: 'Unauthorized' };
    }

    const result = await sql`
      DELETE FROM departments 
      WHERE id = ${parseInt(id)}
      RETURNING id, name
    `;

    if (result.length === 0) {
      throw { status: 404, message: 'Department not found' };
    }

    await sql`INSERT INTO activity_logs (user_id, action, details) VALUES (${adminUser.id}, 'DELETE_DEPARTMENT', ${`Deleted department ${result[0].name}`})`;
    
    // Invalidate departments cache
    await invalidateCachePattern('departments:*');
    
    return { success: true };
  }

  /**
   * Get courses assigned to a faculty member
   */
  static async getFacultyCourses(facultyUser) {
    if (!facultyUser || facultyUser.role !== 'faculty') {
      throw { status: 401, message: 'Unauthorized' };
    }

    return await sql`
      SELECT c.id, c.course_code, c.name, c.semester, cf.is_co_coordinator 
      FROM course_faculty cf 
      JOIN courses c ON cf.course_id = c.id 
      WHERE cf.faculty_id = ${facultyUser.id}
      ORDER BY c.course_code ASC
    `;
  }

  /**
   * Get distinct student batches
   */
  static async getBatches(user) {
    if (!user) throw { status: 401, message: 'Unauthorized' };

    const result = await sql`
      SELECT DISTINCT extra_info->>'batch' as batch 
      FROM users 
      WHERE role = 'student' 
        AND status = 'active' 
        AND extra_info->>'batch' IS NOT NULL 
        AND extra_info->>'batch' != ''
      ORDER BY batch DESC
    `;

    return result.map(r => r.batch);
  }
}
