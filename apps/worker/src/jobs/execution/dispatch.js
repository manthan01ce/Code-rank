import { practiceRunners } from '@coderank/runner/languages';
import { runDynamicPractical } from './dynamic.js';
import { executeCode } from './playground.js';

export function createExecutionDispatcher({ dynamic = runDynamicPractical, playground = executeCode, practice = practiceRunners } = {}) {
  return async (job) => {
    const { type, payload, userId } = job.data;
    if (type === 'dynamic') return dynamic({ ...payload, userId, jobId: job.id, enqueuedAt: job.data.enqueuedAt || job.timestamp });
    if (type === 'playground') return playground(payload.language, payload.code, payload.input);
    if (type === 'practice') {
      if (!Object.hasOwn(practice, payload.language)) throw new Error(`Unsupported practice language: ${payload.language}`);
      return practice[payload.language](payload);
    }
    throw new Error(`Unknown job type: ${type}`);
  };
}
export const dispatchExecution = createExecutionDispatcher();
