import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function spawnStudentContainer(studentId) {
  const containerName = `coderank-student-${studentId}`;
  
  try {
    // Check if it already exists and is running
    await execAsync(`docker inspect -f '{{.State.Running}}' ${containerName}`);
    // If it exists, ensure it's running
    await execAsync(`docker start ${containerName}`);
    return;
  } catch (err) {
    // Container doesn't exist, create it
    try {
      // Use the pre-built image containing compilers (GCC, Python, Java, Node.js)
      await execAsync(`docker run -d --name ${containerName} --memory="256m" --cpus="0.5" --network none coderank-base:latest tail -f /dev/null`);
    } catch (e) {
      console.error(`Failed to spawn container for student ${studentId}:`, e);
    }
  }
}

export async function destroyStudentContainer(studentId) {
  const containerName = `coderank-student-${studentId}`;
  try {
    await execAsync(`docker rm -f ${containerName}`);
  } catch (e) {
    // Ignore errors if it doesn't exist
  }
}
