import { gradePractical } from '@coderank/core/grading';
import { Executor } from '@coderank/runner';

export function runDynamicPractical(payload) {
  return gradePractical(payload, (...args) => new Executor(...args));
}
