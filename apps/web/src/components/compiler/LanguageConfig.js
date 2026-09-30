/**
 * LanguageConfig.js
 * Central registry for all supported languages in the CodeRank coding dashboard.
 * Each entry maps a language key → Monaco language ID, Docker image, boilerplate, etc.
 */

export const LANGUAGES = {
  python: {
    label: 'Python 3.12',
    monacoLang: 'python',
    dockerImage: 'coderank-python:latest',
    extension: 'py',
    runnerKey: 'python',
    executableInPhase1: true,
    boilerplate: `import math
import collections
import heapq
import sys
import json
import typing
from typing import List, Dict, Tuple, Optional, Set

class Solution:
    def solution(self):
        # Write your code here
        pass
`,
  },
  cpp: {
    label: 'C++',
    monacoLang: 'cpp',
    dockerImage: 'coderank-cpp:latest',
    extension: 'cpp',
    runnerKey: 'cpp',
    executableInPhase1: true,
    boilerplate: `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <map>
#include <unordered_map>
#include <set>
#include <unordered_set>
#include <queue>
#include <stack>
#include <cmath>

using namespace std;

class Solution {
public:
    // Write your code here
};
`,
  },
  c: {
    label: 'C (GCC 13)',
    monacoLang: 'c',
    dockerImage: 'coderank-c:latest',
    extension: 'c',
    runnerKey: 'c',
    executableInPhase1: true,
    boilerplate: `#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>
#include <math.h>
#include <limits.h>
#include <ctype.h>

// Write your C solution here
`,
  },
  java: {
    label: 'Java 21',
    monacoLang: 'java',
    dockerImage: 'coderank-java:latest',
    extension: 'java',
    runnerKey: 'java',
    executableInPhase1: true,
    boilerplate: `import java.util.*;
import java.io.*;
import java.math.*;

public class Solution {
    // Write your code here
}
`,
  },
  javascript: {
    label: 'JavaScript (Node 20)',
    monacoLang: 'javascript',
    dockerImage: 'coderank-javascript:latest',
    extension: 'js',
    runnerKey: 'javascript',
    executableInPhase1: true,
    boilerplate: `/**
 * @param {any} input
 * @return {any}
 */
function solution(...args) {
    // Write your code here
}

module.exports = { solution };
`,
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
