import { gradePractical } from '@coderank/core/services/GradingService';
import { Executor } from './Executor.js';

export function runDynamicPractical(payload) {
  return gradePractical(payload, (...args) => new Executor(...args));
}
