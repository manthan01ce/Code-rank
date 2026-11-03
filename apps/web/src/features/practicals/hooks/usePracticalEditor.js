'use client';

import { useState } from 'react';
import { fetchPracticalDetails, createPractical, updatePractical } from '../api/practicals-api';

/**
 * Hook to manage practical authoring form lifecycle and submissions.
 */
export function usePracticalEditor({
  selectedCourse,
  token,
  socket,
  showToast,
  onSaved,
  setProcessing,
}) {
  const [showPracticalModal, setShowPracticalModal] = useState(false);
  const [editingPractical, setEditingPractical] = useState(null);

  // Practical Form fields
  const [pracTitle, setPracTitle] = useState('');
  const [pracDesc, setPracDesc] = useState('');
  const [pracTopics, setPracTopics] = useState('');
  const [pracStartTime, setPracStartTime] = useState('');
  const [pracEndTime, setPracEndTime] = useState('');
  const [pracInst, setPracInst] = useState('');
  const [pracDiff, setPracDiff] = useState('Easy');
  const [pracIsChallenge, setPracIsChallenge] = useState(false);
  const [pracInputFormat, setPracInputFormat] = useState('');
  const [pracOutputFormat, setPracOutputFormat] = useState('');
  const [pracConstraints, setPracConstraints] = useState('');
  const [sampleTestCases, setSampleTestCases] = useState([{ input: '', expected: '' }]);
  const [allowedLanguages, setAllowedLanguages] = useState(['python', 'cpp']);

  // Starter code templates
  const [pyTemplate, setPyTemplate] = useState('# Write your Python code here\n# Read inputs using input() or sys.stdin\n');
  const [cppTemplate, setCppTemplate] = useState('#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ code here\n    // Read from cin and write to cout\n    return 0;\n}');

  // Test cases state
  const [testCases, setTestCases] = useState([{ input: '', expected: '', marks: '5', is_hidden: false, label: '' }]);
  const [hasSubmissions, setHasSubmissions] = useState(false);

  const handleOpenAddPractical = () => {
    setEditingPractical(null);
    setPracTitle('');
    setPracDesc('');
    setPracTopics('');
    setPracInst('');
    setPracDiff('Easy');
    setPracIsChallenge(true);
    setPracInputFormat('');
    setPracOutputFormat('');
    setPracConstraints('');
    setSampleTestCases([{ input: '', expected: '' }]);
    setPracStartTime('');
    setPracEndTime('');
    setAllowedLanguages(['python', 'cpp']);
    setPyTemplate('# Write your Python code here\n# Read inputs using input() or sys.stdin\n');
    setCppTemplate('#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ code here\n    // Read from cin and write to cout\n    return 0;\n}');
    setTestCases([{ input: '', expected: '', marks: '5', is_hidden: false, label: '' }]);
    setHasSubmissions(false);
    setShowPracticalModal(true);
  };

  const handleOpenEditPractical = async (p) => {
    setProcessing(true);
    try {
      const data = await fetchPracticalDetails(p.id, token());
      setEditingPractical(data);
      setPracTitle(data.title || '');
      setPracDesc(data.description || '');
      setPracTopics(data.topics || '');
      setPracInst(data.instructions || '');
      setPracDiff(data.difficulty || 'Easy');
      setPracIsChallenge(data.is_challenge || false);
      setPracInputFormat(data.input_format || '');
      setPracOutputFormat(data.output_format || '');
      setPracConstraints(data.constraints || '');
      try {
        const parsed = JSON.parse(data.sample_input);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSampleTestCases(parsed);
        } else {
          setSampleTestCases([{ input: data.sample_input || '', expected: data.sample_output || '' }]);
        }
      } catch {
        setSampleTestCases([{ input: data.sample_input || '', expected: data.sample_output || '' }]);
      }

      const formatLocalTime = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        const pad = (n) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };
      setPracStartTime(formatLocalTime(data.start_time));
      setPracEndTime(formatLocalTime(data.end_time));

      setAllowedLanguages(data.starter_code?.allowed_languages || ['python', 'cpp']);
      setPyTemplate(data.starter_code?.python || 'class Solution:\n    def solution(self):\n        pass');
      setCppTemplate(data.starter_code?.cpp || 'class Solution {\npublic:\n    void solution() {\n        \n    }\n};');
      setTestCases(data.test_cases?.length > 0 ? data.test_cases.map(tc => ({
        ...tc,
        marks: tc.marks.toString()
      })) : [{ input: '', expected: '', marks: '5', is_hidden: false, label: '' }]);
      setHasSubmissions(data.submissions_count > 0);
      setShowPracticalModal(true);
    } catch (e) {
      showToast('error', e.message || 'Failed to retrieve practical details.');
    } finally {
      setProcessing(false);
    }
  };

  const handleAddTestCaseRow = () => {
    if (testCases.length >= 20) {
      showToast('error', 'You cannot add more than 20 test cases.');
      return;
    }
    setTestCases([...testCases, { input: '', expected: '', marks: '5', is_hidden: false, label: '' }]);
  };

  const handleRemoveTestCaseRow = (idx) => {
    if (testCases.length <= 1) {
      showToast('error', 'At least 1 test case must remain.');
      return;
    }
    setTestCases(testCases.filter((_, i) => i !== idx));
  };

  const handleTestCaseChange = (idx, field, val) => {
    const updated = [...testCases];
    updated[idx][field] = val;
    setTestCases(updated);
  };

  const handleSubmitPractical = async (e) => {
    e.preventDefault();
    if (!pracTitle || !pracDesc) {
      showToast('error', 'Title and Description are required.');
      return;
    }

    setProcessing(true);

    const payload = {
      course_id: parseInt(selectedCourse),
      batch_id: 'All',
      title: pracTitle,
      description: pracDesc,
      topics: pracTopics,
      instructions: pracInst,
      difficulty: pracDiff,
      is_challenge: true,
      start_time: pracStartTime || null,
      end_time: pracEndTime || null,
      starter_code: {
        allowed_languages: allowedLanguages,
        python: pyTemplate,
        cpp: cppTemplate,
        entry: {
          type: 'class-method',
          className: 'Solution',
          methodName: 'solution'
        }
      },
      input_format: pracInputFormat,
      output_format: pracOutputFormat,
      constraints: pracConstraints,
      sample_input: JSON.stringify(sampleTestCases),
      sample_output: '',
      test_cases: testCases.map((tc, idx) => ({
        input: tc.input,
        expected: tc.expected,
        marks: parseFloat(tc.marks) || 0,
        is_hidden: !!tc.is_hidden,
        order_index: idx,
        label: tc.label || `Test Case ${idx + 1}`
      }))
    };

    try {
      let data;
      if (editingPractical) {
        data = await updatePractical(editingPractical.id, payload, token());
      } else {
        data = await createPractical(payload, token());
      }

      showToast('success', editingPractical ? 'Practical updated successfully.' : 'Practical created successfully.');
      setShowPracticalModal(false);
      onSaved?.();

      if (socket) {
        const evt = editingPractical ? 'faculty_practical_updated' : 'faculty_practical_added';
        socket.emit(evt, {
          course_id: parseInt(selectedCourse),
          practical: data.practical || { id: editingPractical?.id, title: pracTitle, course_id: parseInt(selectedCourse) }
        });
      }
    } catch (err) {
      showToast('error', err.message || 'Submission failed.');
    } finally {
      setProcessing(false);
    }
  };

  return {
    showPracticalModal,
    setShowPracticalModal,
    editingPractical,
    hasSubmissions,
    handleOpenAddPractical,
    handleOpenEditPractical,
    formData: {
      pracTitle,
      pracDesc,
      pracTopics,
      pracStartTime,
      pracEndTime,
      pracInst,
      pracDiff,
      pracIsChallenge,
      pracInputFormat,
      pracOutputFormat,
      pracConstraints,
      sampleTestCases,
      allowedLanguages,
      pyTemplate,
      cppTemplate,
      testCases,
    },
    formHandlers: {
      setPracTitle,
      setPracDesc,
      setPracTopics,
      setPracStartTime,
      setPracEndTime,
      setPracInst,
      setPracDiff,
      setPracIsChallenge,
      setPracInputFormat,
      setPracOutputFormat,
      setPracConstraints,
      setSampleTestCases,
      setAllowedLanguages,
      setPyTemplate,
      setCppTemplate,
      setTestCases,
      handleAddTestCaseRow,
      handleRemoveTestCaseRow,
      handleTestCaseChange,
    },
    handleSubmitPractical,
  };
}
