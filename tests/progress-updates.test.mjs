import test from 'node:test';
import assert from 'node:assert/strict';
import { profilePracticals } from '../apps/web/src/lib/progress-updates.js';
test('profile progress reflects accepted submissions and keeps solved status after a failed retry', () => {
  const base = { practical_id: 5, practical_title: 'Arrays', course_code: 'CS', course_name: 'Algorithms' };
  const rows = profilePracticals([{ ...base, status: 'Accepted', normalized_marks: 10 }, { ...base, status: 'Wrong Answer', normalized_marks: 2 }]);
  assert.equal(rows.length, 1); assert.equal(rows[0].status, 'done'); assert.equal(rows[0].marks, 10);
  assert.equal(rows[0].id, 5);
  assert.equal(profilePracticals([{ ...base, status: 'Wrong Answer', normalized_marks: 2 }])[0].status, 'not_started');
});
test('an accepted retry updates the profile and empty history stays empty', () => {
  assert.deepEqual(profilePracticals(), []);
  const rows = profilePracticals([{ practical_id: 5, status: 'Wrong Answer', normalized_marks: 2 }, { practical_id: 5, status: 'Accepted', normalized_marks: 10 }]);
  assert.equal(rows[0].status, 'done'); assert.equal(rows[0].marks, 10);
});
