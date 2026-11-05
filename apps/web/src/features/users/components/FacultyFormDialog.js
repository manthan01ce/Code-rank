'use client';

import { IconDownload, IconX } from '@tabler/icons-react';

export function FacultyFormDialog({ faculty, departmentsList, processing, showModal, setShowModal, editTarget, formErrors, setFormErrors, form, setForm, handleSubmit }) { return (<>{showModal && (
        <div
          className="fixed inset-0 bg-[#0f172a]/45 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => !processing && setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 sm:p-7 w-full max-w-lg shadow-2xl border border-[#e2e8f0] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="flex items-start justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
              <div>
                <h2 id="modal-title" className="text-lg font-bold text-[#0f172a] leading-snug">
                  {editTarget ? `Edit ${editTarget.name}` : 'Add New Faculty Member'}
                </h2>
                <p className="text-xs text-[#64748b] mt-0.5">
                  {editTarget
                    ? 'Update faculty credentials and institutional details.'
                    : 'Enter faculty details. Credentials will be securely generated.'}
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
              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">
                  Faculty ID (Max 5 digits) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={5}
                  placeholder="e.g. 1042"
                  value={form.facultyId}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 5);
                    setForm((f) => ({ ...f, facultyId: val }));
                    if (formErrors.facultyId) setFormErrors((err) => ({ ...err, facultyId: null }));
                  }}
                  className={`w-full text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${
                    formErrors.facultyId ? 'border-red-400 focus:ring-red-200' : 'border-[#dbe1ea] focus:ring-[#c7d2fe]'
                  }`}
                />
                {formErrors.facultyId && <p className="text-[11px] text-red-600 mt-1">{formErrors.facultyId}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh"
                    value={form.firstName}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, firstName: e.target.value.replace(/[^A-Za-z\s]/g, '') }));
                      if (formErrors.firstName) setFormErrors((err) => ({ ...err, firstName: null }));
                    }}
                    className={`w-full text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${
                      formErrors.firstName ? 'border-red-400 focus:ring-red-200' : 'border-[#dbe1ea] focus:ring-[#c7d2fe]'
                    }`}
                  />
                  {formErrors.firstName && <p className="text-[11px] text-red-600 mt-1">{formErrors.firstName}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Patel"
                    value={form.lastName}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, lastName: e.target.value.replace(/[^A-Za-z\s]/g, '') }));
                      if (formErrors.lastName) setFormErrors((err) => ({ ...err, lastName: null }));
                    }}
                    className={`w-full text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${
                      formErrors.lastName ? 'border-red-400 focus:ring-red-200' : 'border-[#dbe1ea] focus:ring-[#c7d2fe]'
                    }`}
                  />
                  {formErrors.lastName && <p className="text-[11px] text-red-600 mt-1">{formErrors.lastName}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">
                  Institutional Email <span className="text-red-500">*</span>
                </label>
                <div
                  className={`flex items-center border rounded-lg overflow-hidden bg-white focus-within:ring-2 ${
                    formErrors.emailPrefix ? 'border-red-400 focus-within:ring-red-200' : 'border-[#dbe1ea] focus-within:ring-[#c7d2fe]'
                  }`}
                >
                  <input
                    type="text"
                    placeholder="ramesh.patel"
                    value={form.emailPrefix}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, emailPrefix: e.target.value.replace(/[^a-zA-Z0-9.\-_]/g, '') }));
                      if (formErrors.emailPrefix) setFormErrors((err) => ({ ...err, emailPrefix: null }));
                    }}
                    disabled={!!editTarget}
                    className="flex-1 border-0 px-3 py-2 text-xs focus:outline-none"
                    style={editTarget ? { opacity: 0.6, cursor: 'not-allowed', backgroundColor: '#f8fafc' } : {}}
                  />
                  <span className="px-3 py-2 bg-[#f1f5f9] text-[#64748b] text-xs font-mono border-l border-[#dbe1ea] select-none">
                    @charusat.ac.in
                  </span>
                </div>
                {formErrors.emailPrefix && <p className="text-[11px] text-red-600 mt-1">{formErrors.emailPrefix}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">
                    Department <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.department}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, department: e.target.value }));
                      if (formErrors.department) setFormErrors((err) => ({ ...err, department: null }));
                    }}
                    className={`w-full text-xs border rounded-lg px-3 py-2 bg-white text-[#334155] focus:outline-none focus:ring-2 ${
                      formErrors.department ? 'border-red-400 focus:ring-red-200' : 'border-[#dbe1ea] focus:ring-[#c7d2fe]'
                    }`}
                  >
                    <option value="" disabled>Select Department</option>
                    {departmentsList.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name} ({d.institute_name})
                      </option>
                    ))}
                  </select>
                  {formErrors.department && <p className="text-[11px] text-red-600 mt-1">{formErrors.department}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#334155] mb-1">Designation</label>
                  <input
                    type="text"
                    placeholder="e.g. Assistant Professor"
                    value={form.designation}
                    onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                    className="w-full text-xs border border-[#dbe1ea] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#c7d2fe]"
                  />
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
                    onChange={(e) => {
                      setForm((f) => ({ ...f, password: e.target.value }));
                      if (formErrors.password) setFormErrors((err) => ({ ...err, password: null }));
                    }}
                    className={`w-full text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${
                      formErrors.password ? 'border-red-400 focus:ring-red-200' : 'border-[#dbe1ea] focus:ring-[#c7d2fe]'
                    }`}
                  />
                  {formErrors.password && <p className="text-[11px] text-red-600 mt-1">{formErrors.password}</p>}
                </div>
              )}

              {!editTarget && (
                <div className="p-3 bg-[#eff1ff]/60 border border-[#c7d2fe] rounded-lg text-xs text-[#4338ca] flex items-center gap-2">
                  <IconDownload size={16} className="text-[#4f46e5] shrink-0" />
                  <span>A secure random password will be generated and saved to a PDF credential sheet upon creation.</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 text-xs font-semibold rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
                  disabled={processing}
                >
                  {processing ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Faculty'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 px-4 text-xs font-semibold rounded-lg border border-[#dbe1ea] bg-white text-[#475569] hover:bg-[#f1f5f9] cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}</>); }
