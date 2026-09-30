/**
 * packages/core/src/index.js
 * Main barrel export for @coderank/core
 */
export { default as sql } from './db/client.js';
export { logger } from './utils/logger.js';
export * from './utils/auth.js';
export { UserService } from './services/UserService.js';
export { CourseService } from './services/CourseService.js';
export { SubmissionService } from './services/SubmissionService.js';
