export function practicalPassed({ isSubmit, rawMarks, totalMarks, cases }) {
  return isSubmit ? rawMarks === totalMarks : cases.length > 0 && cases.every(tc => tc.passed);
}
