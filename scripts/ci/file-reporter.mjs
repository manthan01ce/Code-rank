import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
export default async function* files(source) {
  const executed = new Set();
  for await (const event of source) {
    if (['test:pass', 'test:fail'].includes(event.type) && event.data?.file) {
      executed.add(relative(root, event.data.file).replaceAll('\\', '/'));
    }
  }
  yield JSON.stringify({ executedFiles: [...executed].sort() }) + '\n';
}
