import test from 'node:test';
import assert from 'node:assert/strict';
import { practicalDestination, practicalHasStarted, practicalBelongsToCourse } from '../apps/web/src/lib/practical-navigation.js';
test('practical links encode the course and never fall back to an unrelated question', () => {
  assert.equal(practicalDestination({id:42}, 'C++ / Lab'), '/student/code/practical_42?subject=C%2B%2B%20%2F%20Lab');
  for (const id of [undefined, null, '', -1, 0, 'other', Infinity, '1/../../admin']) assert.equal(practicalDestination({id}), null);
});
test('scheduled practicals remain locked until their actual start time', () => {
  const now=Date.parse('2026-10-26T12:00:00Z');
  assert.equal(practicalHasStarted({},now),true);
  assert.equal(practicalHasStarted({start_time:'2026-10-26T12:00:00Z'},now),true);
  assert.equal(practicalHasStarted({start_time:'2026-10-26T12:01:00Z'},now),false);
  assert.equal(practicalHasStarted({start_time:'invalid'},now),false);
});

test('identical course names cannot route a question into the wrong course', () => {
  assert.equal(practicalBelongsToCourse({course_id:2,course_name:'Java'}, {id:3,name:'Java'}),false);
  assert.equal(practicalBelongsToCourse({course_id:'2'}, {id:2}),true);
  assert.equal(practicalBelongsToCourse({course_code:'JAVA301'}, {course_code:'JAVA301'}),true);
});
