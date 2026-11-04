import { UserService } from '@coderank/core/services/UserService';

export class ProfileService {
  static async getProfileByUsername(actor, username) {
    if (!actor) {
      throw { status: 401, message: 'Unauthorized' };
    }
    if (typeof username !== 'string' || !/^[a-zA-Z0-9.@+_-]{1,254}$/.test(username)) {
      throw { status: 400, message: 'Invalid profile handle' };
    }
    return UserService.getStudentProfileByUsername(username);
  }

  static async updateProfile(actor, body) {
    if (!actor) {
      throw { status: 401, message: 'Unauthorized' };
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw { status: 400, message: 'Invalid profile payload' };
    }
    return UserService.updateProfile(actor, body);
  }
}
