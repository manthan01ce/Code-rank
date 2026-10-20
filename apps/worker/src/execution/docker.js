import { dockerCommand } from '@coderank/runner';
export async function checkDockerHealth() {
  try {
    const { stdout } = await dockerCommand(['info', '--format', '{{.ServerVersion}}'], { timeout: 3000 });
    await dockerCommand(['image', 'inspect', process.env.RUNNER_IMAGE || 'coderank-base:latest'], { timeout: 3000 });
    return { healthy: true, version: stdout.trim() };
  } catch (error) { return { healthy: false, error: error.message }; }
}
