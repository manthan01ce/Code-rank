'use client';

import { IconDownload, IconX } from '@tabler/icons-react';

export function StudentFormDialog({ departmentsList, processing, showModal, setShowModal, editTarget, form, setForm, handleSubmit }) { return (<>{showModal && (
        <div
          className="fixed inset-0 bg-[#0f172a]/45 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => !processing && setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 sm:p-7 w-full max-w-lg shadow-2xl border border-[#e2e8f0] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-modal-title"
          >
            <div className="flex items-start justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
              <div>
                <h2 id="student-modal-title" className="text-lg font-bold text-[#0f172a] leading-snug">
                  {editTarget ? `Edit ${editTarget.name}` : 'Add New Student'}
                </h2>
                <p className="text-xs text-[#64748b] mt-0.5">
                  {editTarget ? 'Update student enrollment and division information.' : 'Create student account. Password is auto-generated.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-[#94a3b8] hover:text-[#0f172a] p-1 rounded-lg hover:bg-[#f1f5f9] transition-colors"
                aria-label="Close modal"
              >
                <IconX size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">First Name *</label>
                  <input
                    aria-label="First Name"
                    placeholder="First Name *"
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value.replace(/[^A-Za-z\s]/g, '') }))}
                    required
                    className="w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Last Name *</label>
                  <input
                    aria-label="Last Name"
                    placeholder="Last Name *"
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value.replace(/[^A-Za-z\s]/g, '') }))}
                    required
                    className="w-full text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Roll / ID Number *</label>
                  <input
                    aria-label="Roll Number"
                    placeholder="Roll Number (e.g. 25ce097 or D25ce097) *"
                    value={form.roll}
                    onChange={(e) => setForm((f) => ({ ...f, roll: e.target.value.toUpperCase() }))}
                    required
                    disabled={!!editTarget}
                    className="w-full text-xs font-mono"
                    style={editTarget ? { opacity: 0.6, cursor: 'not-allowed', backgroundColor: '#f8fafc' } : {}}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Semester *</label>
                  <select
                    value={form.semester}
                    onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))}
                    required
                    className="w-full text-xs"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>Semester {s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Department / Branch *</label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                    required
                    className="w-full text-xs"
                  >
                    <option value="" disabled>Select Department</option>
                    {departmentsList.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name} ({d.institute_name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Division (e.g. CE1) *</label>
                  <input
                    aria-label="Division"
                    placeholder="Division (e.g. CE1, IT2) *"
                    value={form.division}
                    onChange={(e) => setForm((f) => ({ ...f, division: e.target.value.toUpperCase() }))}
                    required
                    className="w-full text-xs font-mono"
                  />
                </div>
              </div>
              <p className="text-[11px] text-[#64748b]">
                Division must contain at least 2 letters and 1 digit (e.g. <strong>CE1</strong>, <strong>IT2</strong>, <strong>CSE1</strong>).
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">Institutional Email</label>
                <div className="flex items-center border border-[#dbe1ea] rounded-lg overflow-hidden bg-white">
                  <input
                    aria-label="Email"
                    value={form.roll ? form.roll.toLowerCase() : ''}
                    disabled
                    className="flex-1 border-0 rounded-none text-xs font-mono bg-[#f8fafc] text-[#64748b]"
                  />
                  <span className="px-3 py-2 bg-[#f1f5f9] text-[#64748b] text-xs font-mono border-l border-[#dbe1ea]">
                    @charusat.edu.in
                  </span>
                </div>
              </div>

              {editTarget && (
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">
                    New Password (leave blank to keep unchanged)
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full text-xs"
                  />
                </div>
              )}

              {!editTarget && (
                <div className="p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg text-xs text-[#64748b] flex items-center gap-2">
                  <IconDownload size={16} className="text-[#4f46e5] shrink-0" />
                  <span>A secure password will be generated and downloaded as a PDF immediately.</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  className="btn-primary flex-1 py-2.5 text-xs font-semibold rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-xs cursor-pointer disabled:opacity-50"
                  disabled={processing}
                >
                  {processing ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Student'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-lg border border-[#dbe1ea] bg-white text-[#475569] hover:bg-[#f1f5f9] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}</>); }
