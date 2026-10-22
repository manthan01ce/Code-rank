import { checkDeployment } from "./lib/deployment-readiness.mjs";

try {
  const base = process.argv[2];
  if (!base)
    throw Error(
      "Usage: npm run deployment:check -- https://your-deployment.example",
    );
  console.log(JSON.stringify(await checkDeployment(base)));
} catch (error) {
  console.error("Deployment check failed:", error.message);
  process.exitCode = 1;
}
