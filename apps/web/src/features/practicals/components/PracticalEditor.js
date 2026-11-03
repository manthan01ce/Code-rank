'use client';

/**
 * Modal dialog for authoring and editing a coding practical.
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Object|null} props.editingPractical
 * @param {Object} props.formData
 * @param {Object} props.formHandlers
 * @param {boolean} props.processing
 * @param {Function} props.onSubmit (e) => Promise<void>
 * @param {Function} props.onClose () => void
 */
export function PracticalEditor({
  isOpen,
  editingPractical,
  formData,
  formHandlers,
  processing,
  onSubmit,
  onClose,
}) {
  if (!isOpen) return null;

  const {
    pracTitle,
    pracDesc,
    pracTopics,
    pracStartTime,
    pracEndTime,
    pracInst,
    pracDiff,
    pracInputFormat,
    pracOutputFormat,
    pracConstraints,
    sampleTestCases,
    allowedLanguages,
    testCases,
  } = formData;

  const {
    setPracTitle,
    setPracDesc,
    setPracTopics,
    setPracStartTime,
    setPracEndTime,
    setPracInst,
    setPracDiff,
    setPracInputFormat,
    setPracOutputFormat,
    setPracConstraints,
    setSampleTestCases,
    setAllowedLanguages,
    handleAddTestCaseRow,
    handleRemoveTestCaseRow,
    handleTestCaseChange,
  } = formHandlers;

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      overflowY: 'auto', padding: '40px 0'
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', padding: '32px',
        width: '100%', maxWidth: '850px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        <h3 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: 700 }}>
          {editingPractical ? `Edit Practical: ${editingPractical.title}` : 'Add New Coding Practical'}
        </h3>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Title *</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Reverse an array"
                value={pracTitle}
                onChange={e => setPracTitle(e.target.value)}
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Difficulty</label>
              <select
                className="input-field"
                value={pracDiff}
                onChange={e => setPracDiff(e.target.value)}
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Start Time (Optional)</label>
              <input
                type="datetime-local"
                className="input-field"
                value={pracStartTime}
                onChange={e => setPracStartTime(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>End Time (Optional)</label>
              <input
                type="datetime-local"
                className="input-field"
                value={pracEndTime}
                onChange={e => setPracEndTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Allowed Programming Languages *</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <select
                className="input-field"
                value=""
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'all') {
                    setAllowedLanguages(['python', 'cpp', 'java', 'c', 'javascript']);
                  } else if (val && !allowedLanguages.includes(val)) {
                    setAllowedLanguages([...allowedLanguages, val]);
                  }
                }}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white' }}
              >
                <option value="">Add language...</option>
                {allowedLanguages.length < 5 && <option value="all">All Languages</option>}
                {!allowedLanguages.includes('python') && <option value="python">Python</option>}
                {!allowedLanguages.includes('cpp') && <option value="cpp">C++</option>}
                {!allowedLanguages.includes('java') && <option value="java">Java</option>}
                {!allowedLanguages.includes('c') && <option value="c">C</option>}
                {!allowedLanguages.includes('javascript') && <option value="javascript">JavaScript</option>}
              </select>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                {allowedLanguages.map(lang => (
                  <span
                    key={lang}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      backgroundColor: '#eff1ff',
                      color: '#4338ca',
                      fontSize: '12px',
                      fontWeight: '600',
                      border: '1px solid #bfdbfe'
                    }}
                  >
                    {lang === 'cpp' ? 'C++' : lang === 'javascript' ? 'JavaScript' : lang.charAt(0).toUpperCase() + lang.slice(1)}
                    <button
                      type="button"
                      onClick={() => {
                        if (allowedLanguages.length <= 1) {
                          alert('At least one language must be enabled.');
                          return;
                        }
                        setAllowedLanguages(allowedLanguages.filter(l => l !== lang));
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#b91c1c',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        padding: '0 2px',
                        lineHeight: 1
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Description / Problem Statement *</label>
            <textarea
              className="input-field"
              rows={4}
              placeholder="Describe the coding challenge in detail (Supports HTML/Markdown)..."
              value={pracDesc}
              onChange={e => setPracDesc(e.target.value)}
              required
              style={{ fontFamily: 'monospace' }}
            />
          </div>

          <div style={{ marginTop: '15px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Topics (comma separated)</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Arrays, Sorting, Dynamic Programming"
              value={pracTopics}
              onChange={e => setPracTopics(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Instructions / Constraints (Optional)</label>
            <textarea
              className="input-field"
              rows={2}
              placeholder="e.g. 1 <= N <= 10^5"
              value={pracInst}
              onChange={e => setPracInst(e.target.value)}
              style={{ fontFamily: 'monospace' }}
            />
          </div>

          <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600 }}>Challenge Specific Inputs / Formatting</h4>
            <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Input Format *</label>
                <textarea className="input-field" rows={2} value={pracInputFormat} onChange={e => setPracInputFormat(e.target.value)} required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Output Format *</label>
                <textarea className="input-field" rows={2} value={pracOutputFormat} onChange={e => setPracOutputFormat(e.target.value)} required />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px', color: '#1e293b' }}>Sample Test Cases (Shown to students)</p>
              {sampleTestCases.map((tc, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', borderBottom: '1px solid #f1f5f9', pb: '10px', marginBottom: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <textarea
                      className="input-field"
                      rows={2}
                      placeholder={`Sample Input ${idx + 1}`}
                      value={tc.input}
                      onChange={e => {
                        const updated = [...sampleTestCases];
                        updated[idx].input = e.target.value;
                        setSampleTestCases(updated);
                      }}
                      required
                      style={{ padding: '6px', fontFamily: 'monospace', resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <textarea
                      className="input-field"
                      rows={2}
                      placeholder={`Sample Output ${idx + 1}`}
                      value={tc.expected}
                      onChange={e => {
                        const updated = [...sampleTestCases];
                        updated[idx].expected = e.target.value;
                        setSampleTestCases(updated);
                      }}
                      required
                      style={{ padding: '6px', fontFamily: 'monospace', resize: 'vertical' }}
                    />
                  </div>
                  <button type="button" style={{ border: 'none', background: 'none', color: '#b91c1c', fontWeight: 'bold', cursor: 'pointer', fontSize: '18px', padding: '0 5px' }} onClick={() => {
                    if (sampleTestCases.length <= 1) {
                      alert('At least 1 sample test case must remain.');
                      return;
                    }
                    setSampleTestCases(sampleTestCases.filter((_, i) => i !== idx));
                  }}>
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setSampleTestCases([...sampleTestCases, { input: '', expected: '' }])} style={{ background: '#f8fafc', color: '#0066b1', border: '1px dashed #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                + Add Sample Test Case
              </button>
            </div>
          </div>

          {/* Test Cases configuration */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600 }}>Test Cases Config ({testCases.length} / 20)</h4>
              <button type="button" className="btn-small" style={{ backgroundColor: 'var(--primary)', color: 'white' }} onClick={handleAddTestCaseRow}>
                + Add Case Row
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {testCases.map((tc, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', borderBottom: '1px solid #f1f5f9', pb: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <textarea
                      className="input-field"
                      rows={2}
                      placeholder="Input arguments (e.g. 3 5) *"
                      value={tc.input}
                      onChange={e => handleTestCaseChange(idx, 'input', e.target.value)}
                      required
                      style={{ padding: '6px', fontFamily: 'monospace', resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <textarea
                      className="input-field"
                      rows={2}
                      placeholder="Expected result (e.g. 8) *"
                      value={tc.expected}
                      onChange={e => handleTestCaseChange(idx, 'expected', e.target.value)}
                      required
                      style={{ padding: '6px', fontFamily: 'monospace', resize: 'vertical' }}
                    />
                  </div>
                  <div style={{ width: '80px' }}>
                    <select
                      className="input-field"
                      value={tc.marks}
                      onChange={e => handleTestCaseChange(idx, 'marks', e.target.value)}
                      required
                      style={{ padding: '6px' }}
                    >
                      {[...Array(11).keys()].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <button type="button" style={{ border: 'none', background: 'none', color: '#b91c1c', fontWeight: 'bold', cursor: 'pointer', fontSize: '18px', padding: '0 5px' }} onClick={() => handleRemoveTestCaseRow(idx)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Form Buttons */}
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', marginTop: '15px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '10px 20px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button type="submit" disabled={processing} className="btn-primary" style={{ width: 'auto', padding: '10px 30px', margin: 0 }}>
              {processing ? 'Saving...' : 'Save Practical'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
