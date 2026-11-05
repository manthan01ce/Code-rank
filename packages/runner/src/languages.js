import { runPython } from './python.js';
import { runCpp } from './cpp.js';
import { runJava } from './java.js';
import { runC } from './c.js';
import { runJavaScript } from './javascript.js';

export { runPython, runCpp, runJava, runC, runJavaScript };
export const practiceRunners = Object.freeze({ python: runPython, cpp: runCpp, c: runC, java: runJava, javascript: runJavaScript });
export const LANGUAGE_IDS = Object.freeze(Object.keys(practiceRunners));
export const ALLOWED_LANGUAGES = new Set(LANGUAGE_IDS);
