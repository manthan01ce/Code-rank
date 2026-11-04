import { PracticalManagementService } from './practical-management.service.js';
import { StudentPracticalService } from './student-practical.service.js';
import { PracticalReportService } from './practical-report.service.js';
import { CourseReportService } from './course-report.service.js';
import { CourseService } from '@coderank/core/services/CourseService';

export class PracticalsService {
  static async getBatches(user, options = {}) {
    return CourseService.getBatches(user, options);
  }

  static async getFacultyCourses(user, options = {}) {
    return CourseService.getFacultyCourses(user, options);
  }

  static async getCourseStats(user, courseId, query = {}) {
    const params = new URLSearchParams(query);
    return CourseReportService.marks(user, courseId, params);
  }

  static async listFacultyPracticals(user, courseId, options = {}) {
    return PracticalManagementService.list(user, courseId, options);
  }

  static async createPractical(user, body) {
    PracticalManagementService.faculty(user);
    return PracticalManagementService.mutate(user, null, 'create', body);
  }

  static async getFacultyPractical(user, id) {
    return PracticalManagementService.detail(user, id);
  }

  static async updatePractical(user, id, body) {
    PracticalManagementService.faculty(user);
    return PracticalManagementService.mutate(user, id, 'update', body);
  }

  static async deletePractical(user, id) {
    return PracticalManagementService.mutate(user, id, 'delete');
  }

  static async extendPractical(user, id, body) {
    PracticalManagementService.faculty(user);
    return PracticalManagementService.mutate(user, id, 'extend', body);
  }

  static async getPracticalStats(user, id, options = {}) {
    return PracticalReportService.stats(user, id, options);
  }

  static async listStudentPracticals(user, courseId, options = {}) {
    return StudentPracticalService.list(user, courseId, options);
  }

  static async getStudentPractical(user, id) {
    return StudentPracticalService.detail(user, id);
  }
}
