// A completed queue job can contain a compilation/runtime failure.
export function successfulExecution(job, expectedStdout) {
  return (
    job?.status === "completed" &&
    job.result?.success === true &&
    job.result.exitCode === 0 &&
    typeof job.result.stdout === "string" &&
    job.result.stdout.trim() === expectedStdout.trim()
  );
}
