// Isolate the BullMQ internal import behind a single compatibility-checked
// boundary. Only packages/queue/src/index.js should import from this module;
// nothing outside packages/queue should ever reach bullmq internal dist paths.
//
// Expected shape (BullMQ 6.3.10):
//   addStandardJob.name    === 'addStandardJob'
//   addStandardJob.keys    === 9   (number of Redis KEYS the script expects)
//   addStandardJob.content  is a string containing the Lua body that returns jobId
//
// If any of these invariants break the build fails immediately with an
// actionable message instead of producing a silently broken Lua script.

import { addStandardJob as _addStandardJob } from 'bullmq/dist/cjs/scripts/addStandardJob-9.js';

const EXPECTED_KEYS = 9;
const EXPECTED_NAME = 'addStandardJob';

function assertCompat(script) {
  if (!script || typeof script !== 'object') {
    throw new Error(
      '[BullMQ compat] addStandardJob export is not an object. ' +
      'The internal dist layout has changed. Verify BullMQ version and update ' +
      'packages/queue/src/bullmq-scripts.js to match the new path and shape.',
    );
  }
  if (script.name !== EXPECTED_NAME) {
    throw new Error(
      `[BullMQ compat] addStandardJob.name is "${script.name}", expected "${EXPECTED_NAME}". ` +
      'The internal script was renamed. Update the wrapper accordingly.',
    );
  }
  if (script.keys !== EXPECTED_KEYS) {
    throw new Error(
      `[BullMQ compat] addStandardJob.keys is ${script.keys}, expected ${EXPECTED_KEYS}. ` +
      'The number of Redis KEYS changed. The coderankAdmitV1 Lua script embeds this ' +
      'count directly; update numberOfKeys in packages/queue/src/index.js to match.',
    );
  }
  if (typeof script.content !== 'string' || !script.content.includes('return jobId')) {
    throw new Error(
      '[BullMQ compat] addStandardJob.content is missing or does not contain "return jobId". ' +
      'The embedded Lua body changed shape. Audit the new content before updating the wrapper.',
    );
  }
}

assertCompat(_addStandardJob);

/**
 * The validated addStandardJob script object from BullMQ internals.
 * @type {{ name: string, keys: number, content: string }}
 */
export const addStandardJob = _addStandardJob;
