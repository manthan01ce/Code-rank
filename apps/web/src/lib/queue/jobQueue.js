// Compatibility adapter: queue ownership and configuration live in core.
import { SubmissionService } from '@coderank/core/services/SubmissionService';
export const enqueueJob = (...args) => SubmissionService.enqueueJob(...args);
export const getJobStatus = (...args) => SubmissionService.getJobStatus(...args);
