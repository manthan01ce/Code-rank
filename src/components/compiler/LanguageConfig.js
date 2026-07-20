/**
 * LanguageConfig.js
 * Central registry for all supported languages in the CodeRank coding dashboard.
 * Each entry maps a language key → Monaco language ID, Docker image, boilerplate, etc.
 *
 * Phase 1: Python is the only *executable* language.
 * Phase 2: Add runners for cpp, java, javascript, go in src/lib/execution/.
 */

export const LANGUAGES = {
  python: {
    label: 'Python 3.12',
    monacoLang: 'python',
    dockerImage: 'python:3.12-slim',
    extension: 'py',
    runnerKey: 'python',
    executableInPhase1: true,
    boilerplate: `def solution():\n    # Write your code here\n    pass\n\n\nsolution()`,
  },
  cpp: {
    label: 'C++ 17',
    monacoLang: 'cpp',
    dockerImage: 'gcc:13',
    extension: 'cpp',
    runnerKey: 'cpp',
    executableInPhase1: false,
    boilerplate: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n\n    // Write your code here\n\n    return 0;\n}`,
  },
  java: {
    label: 'Java 21',
    monacoLang: 'java',
    dockerImage: 'openjdk:21-slim',
    extension: 'java',
    runnerKey: 'java',
    executableInPhase1: false,
    boilerplate: `import java.util.*;\nimport java.io.*;\n\npublic class Solution {\n    public static void main(String[] args) throws IOException {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n\n        // Write your code here\n    }\n}`,
  },
  javascript: {
    label: 'JavaScript (Node 20)',
    monacoLang: 'javascript',
    dockerImage: 'node:20-slim',
    extension: 'js',
    runnerKey: 'javascript',
    executableInPhase1: false, // First new language to implement in Phase 2 (no compile step)
    boilerplate: `process.stdin.resume();\nprocess.stdin.setEncoding('utf8');\n\nlet input = '';\nprocess.stdin.on('data', (d) => (input += d));\nprocess.stdin.on('end', () => {\n    const lines = input.trim().split('\\n');\n\n    // Write your code here\n    console.log('Hello, World!');\n});`,
  },
  go: {
    label: 'Go 1.22',
    monacoLang: 'go',
    dockerImage: 'golang:1.22-alpine',
    extension: 'go',
    runnerKey: 'go',
    executableInPhase1: false,
    boilerplate: `package main\n\nimport (\n    "bufio"\n    "fmt"\n    "os"\n)\n\nfunc main() {\n    reader := bufio.NewReader(os.Stdin)\n    _ = reader\n\n    // Write your code here\n    fmt.Println("Hello, World!")\n}`,
  },
};

/** The default language key shown when the workspace first loads. */
export const DEFAULT_LANGUAGE = 'python';

/**
 * Returns an initial code map with one boilerplate string per language.
 * Use as the initial value for codeByLang state in WorkspaceLayout.
 *
 * @returns {Record<string, string>}
 */
export function getInitialCodeMap() {
  return Object.fromEntries(
    Object.entries(LANGUAGES).map(([key, cfg]) => [key, cfg.boilerplate])
  );
}
