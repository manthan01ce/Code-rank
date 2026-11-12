import { gradePractical } from '@coderank/core/grading';
import { measureExecutionPhase } from '@coderank/runner/timing';
import { Executor } from '@coderank/runner';

export function runDynamicPractical(payload) {
  return gradePractical(payload, (...args) => new Executor(...args), operation => measureExecutionPhase('persist',operation));
}
