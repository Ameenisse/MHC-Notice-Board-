import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Users,
  FileText,
  Loader2,
  Check,
  RefreshCw,
  Sparkles,
  Info,
} from 'lucide-react';
import { Staff, Department } from '../../types';
import {
  parseStaffCsv,
  downloadStaffCsvTemplate,
  StaffCsvParseResult,
  ParsedStaffRow,
} from '../../utils/staffCsv';
import { saveStaff, saveAndSyncUserForStaff, logAudit } from '../../services/db';

interface StaffCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingStaffList: Staff[];
  departments: Department[];
  currentUserEmail: string;
  isDemoMode: boolean;
}

export const StaffCsvImportModal: React.FC<StaffCsvImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingStaffList,
  departments,
  currentUserEmail,
  isDemoMode,
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<StaffCsvParseResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');

  // Options
  const [updateExisting, setUpdateExisting] = useState(true);
  const [createAccounts, setCreateAccounts] = useState(false);

  // Progress
  const [progressCount, setProgressCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [currentProcessingName, setCurrentProcessingName] = useState('');
  const [importSummary, setImportSummary] = useState<{
    added: number;
    updated: number;
    failed: number;
    accountsCreated: number;
    errors: string[];
    createdAccounts: Array<{ staffName: string; username: string; pin: string }>;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const defaultDept = departments.length > 0 ? departments[0].name : 'Clinical / OPD';

  const handleProcessCsvText = (text: string, name?: string) => {
    setCsvContent(text);
    if (name) setFileName(name);
    const result = parseStaffCsv(text, existingStaffList, defaultDept);
    setParseResult(result);
    setStep('preview');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        handleProcessCsvText(text, file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          handleProcessCsvText(text, file.name);
        }
      };
      reader.readAsText(file);
    }
  };

  const handlePasteSubmit = () => {
    if (!csvContent.trim()) return;
    handleProcessCsvText(csvContent, 'Pasted Data.csv');
  };

  const handleStartImport = async () => {
    if (!parseResult) return;
    const rowsToImport = parseResult.rows.filter((r) => r.isValid && (updateExisting || !r.isExisting));

    if (rowsToImport.length === 0) {
      alert('No valid staff records found to import.');
      return;
    }

    setStep('importing');
    setTotalToProcess(rowsToImport.length);
    setProgressCount(0);

    let added = 0;
    let updated = 0;
    let failed = 0;
    let accountsCreated = 0;
    const errors: string[] = [];
    const createdAccounts: Array<{ staffName: string; username: string; pin: string }> = [];

    for (let i = 0; i < rowsToImport.length; i++) {
      const row = rowsToImport[i];
      setCurrentProcessingName(row.fullName);
      setProgressCount(i + 1);

      try {
        const staffPayload: Omit<Staff, 'id' | 'createdAt' | 'updatedAt'> & { id?: string } = {
          id: row.isExisting ? row.existingId : undefined,
          staffId: row.staffId,
          fullName: row.fullName,
          fullNameDhivehi: row.fullNameDhivehi || '',
          designation: row.designation,
          designationDhivehi: row.designationDhivehi || '',
          department: row.department,
          departmentDhivehi: row.departmentDhivehi || '',
          phone: row.phone || '',
          email: row.email || '',
          roles: row.roles,
          active: row.active,
        };

        const saved = await saveStaff(staffPayload, currentUserEmail, isDemoMode);
        if (row.isExisting) {
          updated++;
        } else {
          added++;
        }

        // Auto-create user account if toggled
        if (createAccounts && saved.id) {
          try {
            const cleanUser = row.fullName
              .toLowerCase()
              .replace(/^dr\.\s*/i, 'dr_')
              .replace(/[^a-z0-9_]/g, '_')
              .replace(/_+/g, '_')
              .replace(/^_|_$/g, '')
              .slice(0, 20) || row.staffId.toLowerCase().replace(/[^a-z0-9_]/g, '_');
            const pin = Math.floor(1000 + Math.random() * 9000).toString();

            await saveAndSyncUserForStaff(
              {
                staffDocId: saved.id,
                staffId: saved.staffId,
                username: cleanUser,
                pin,
                roles: saved.roles || ['staff'],
                phone: saved.phone,
                email: saved.email,
                active: saved.active,
              },
              currentUserEmail,
              isDemoMode
            );
            accountsCreated++;
            createdAccounts.push({
              staffName: saved.fullName,
              username: cleanUser,
              pin,
            });
          } catch (accountErr: any) {
            console.warn(`User account sync warning for ${row.fullName}:`, accountErr);
          }
        }
      } catch (err: any) {
        failed++;
        errors.push(`Row ${row.rowNumber} (${row.fullName}): ${err.message || 'Import failed'}`);
      }

      // Small tick to ensure browser paints progress smoothly
      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    setImportSummary({
      added,
      updated,
      failed,
      accountsCreated,
      errors,
      createdAccounts,
    });
    setStep('complete');
    onSuccess();
  };

  const handleDownloadCredentialsCsv = () => {
    if (!importSummary || importSummary.createdAccounts.length === 0) return;
    const headers = ['Staff Name', 'Username', 'PIN Code', 'System'];
    const rows = importSummary.createdAccounts.map((a) => [
      `"${a.staffName.replace(/"/g, '""')}"`,
      `"${a.username}"`,
      `"${a.pin}"`,
      `"Maduvvari Health Centre Portal"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mhc_staff_login_credentials_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <span>Bulk Staff Onboarding via CSV</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300">
                  Fast Import
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload or paste staff rosters to bulk create and update personnel records
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadStaffCsvTemplate}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700"
              title="Download standard CSV template with sample data"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" />
              <span>Sample Template</span>
            </button>
            <button
              onClick={onClose}
              disabled={step === 'importing'}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: Upload or Paste */}
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Tab Selector: Upload File or Paste CSV */}
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setInputMode('file')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    inputMode === 'file'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload .CSV File</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('paste')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    inputMode === 'paste'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Paste CSV Data</span>
                </button>
              </div>

              {inputMode === 'file' ? (
                <div>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-3xl p-8 text-center transition cursor-pointer flex flex-col items-center justify-center gap-3 ${
                      isDragOver
                        ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20'
                        : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:border-teal-400 dark:hover:border-teal-600'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".csv,text/csv,text/plain"
                      className="hidden"
                    />
                    <div className="w-14 h-14 rounded-2xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center shadow-xs">
                      <Upload className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="font-black text-base text-slate-800 dark:text-slate-200">
                        Click to browse or drag & drop CSV file here
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Supports UTF-8, Excel CSV, and Google Sheets exports with English & Dhivehi text
                      </p>
                    </div>
                    <span className="mt-2 px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs">
                      Select CSV File
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Paste raw comma-separated CSV text:
                  </label>
                  <textarea
                    rows={8}
                    value={csvContent}
                    onChange={(e) => setCsvContent(e.target.value)}
                    placeholder={`Staff ID,Full Name,Designation,Department,Roles,Active\nMHC-101,Dr. Aminath Rasheed,Medical Officer,Clinical / OPD,supervisor; staff,true\nMHC-102,Fathimath Ali,Registered Nurse,Nursing,staff,true`}
                    className="w-full p-4 font-mono text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-teal-500 transition text-slate-900 dark:text-slate-100"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handlePasteSubmit}
                      disabled={!csvContent.trim()}
                      className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <span>Analyze & Preview Data</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Instructions banner */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-start gap-3 text-xs">
                <Info className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-slate-600 dark:text-slate-400">
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    Column Guidelines & Smart Recognition:
                  </p>
                  <p>
                    • Minimum required column is <strong>Full Name</strong> (or <strong>Name</strong>).
                  </p>
                  <p>
                    • <strong>Staff ID</strong>: If left blank, unique IDs (e.g. <code>MHC-101</code>) are auto-generated.
                  </p>
                  <p>
                    • <strong>Roles</strong>: Separate multiple roles with semicolons or commas (e.g. <code>supervisor; roster_manager; staff</code>).
                  </p>
                  <p>
                    • <strong>Dhivehi Support</strong>: You can include Thaana text in <code>Full Name Dhivehi</code> and <code>Designation Dhivehi</code>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Preview & Validation */}
          {step === 'preview' && parseResult && (
            <div className="space-y-5">
              {/* Summary Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Rows</div>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{parseResult.totalRows}</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 text-center">
                  <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">New Staff</div>
                  <div className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-0.5">+{parseResult.newCount}</div>
                </div>
                <div className="bg-sky-50 dark:bg-sky-950/30 p-3 rounded-2xl border border-sky-200 dark:border-sky-800/40 text-center">
                  <div className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">Updates to Existing</div>
                  <div className="text-xl font-black text-sky-700 dark:text-sky-400 mt-0.5">{parseResult.updateCount}</div>
                </div>
                <div className="bg-rose-50 dark:bg-rose-950/30 p-3 rounded-2xl border border-rose-200 dark:border-rose-800/40 text-center">
                  <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Issues / Skipped</div>
                  <div className="text-xl font-black text-rose-700 dark:text-rose-400 mt-0.5">{parseResult.errorCount}</div>
                </div>
              </div>

              {/* Import Options Checkboxes */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded-sm focus:ring-teal-500"
                  />
                  <span>Update existing staff details if Staff ID already exists</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={createAccounts}
                    onChange={(e) => setCreateAccounts(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded-sm focus:ring-teal-500"
                  />
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    <span>Auto-create user login account (Random PIN)</span>
                  </span>
                </label>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold sticky top-0 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Staff ID</th>
                      <th className="py-2.5 px-3">Full Name</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">Designation</th>
                      <th className="py-2.5 px-3">Roles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {parseResult.rows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                          !row.isValid ? 'bg-rose-50/50 dark:bg-rose-950/20' : ''
                        }`}
                      >
                        <td className="py-2 px-3 text-slate-400 font-mono">{row.rowNumber}</td>
                        <td className="py-2 px-3">
                          {!row.isValid ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                              Error
                            </span>
                          ) : row.isExisting ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                              Update
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                              New
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {row.staffId}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900 dark:text-white">{row.fullName}</div>
                          {row.fullNameDhivehi && (
                            <div className="text-[10px] text-slate-400 font-thaana" dir="rtl">
                              {row.fullNameDhivehi}
                            </div>
                          )}
                          {row.validationError && (
                            <div className="text-[10px] text-rose-600 font-semibold">{row.validationError}</div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{row.department}</td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{row.designation}</td>
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-1">
                            {row.roles.map((r) => (
                              <span
                                key={r}
                                className="px-1.5 py-0.2 rounded-sm text-[9px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  ← Choose Different File
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleStartImport}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      Import {parseResult.validCount} Staff Records
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: In-Progress */}
          {step === 'importing' && (
            <div className="py-12 px-4 text-center space-y-5">
              <div className="w-16 h-16 rounded-3xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center mx-auto shadow-xs animate-pulse">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Importing Personnel Records...
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Processing: <span className="font-bold text-teal-600">{currentProcessingName}</span>
                </p>
              </div>

              {/* Progress Bar */}
              <div className="max-w-md mx-auto space-y-2">
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                  <div
                    className="bg-teal-600 h-full transition-all duration-150 rounded-full"
                    style={{
                      width: `${totalToProcess > 0 ? (progressCount / totalToProcess) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono font-bold text-slate-400">
                  <span>{progressCount} of {totalToProcess}</span>
                  <span>{totalToProcess > 0 ? Math.round((progressCount / totalToProcess) * 100) : 0}%</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Complete */}
          {step === 'complete' && importSummary && (
            <div className="py-8 px-4 text-center space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Bulk Staff Onboarding Complete!
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Staff members have been synchronized to the roster directory, department allocations, and clinical handover boards.
                </p>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800/40">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase">New Staff Added</div>
                  <div className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {importSummary.added}
                  </div>
                </div>
                <div className="bg-sky-50 dark:bg-sky-950/30 p-3 rounded-2xl border border-sky-200 dark:border-sky-800/40">
                  <div className="text-[10px] font-bold text-sky-600 uppercase">Updated Records</div>
                  <div className="text-xl font-black text-sky-700 dark:text-sky-400 mt-0.5">
                    {importSummary.updated}
                  </div>
                </div>
                <div className="bg-teal-50 dark:bg-teal-950/30 p-3 rounded-2xl border border-teal-200 dark:border-teal-800/40">
                  <div className="text-[10px] font-bold text-teal-600 uppercase">User Accounts</div>
                  <div className="text-xl font-black text-teal-700 dark:text-teal-400 mt-0.5">
                    {importSummary.accountsCreated}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Failed / Skipped</div>
                  <div className="text-xl font-black text-slate-700 dark:text-slate-300 mt-0.5">
                    {importSummary.failed}
                  </div>
                </div>
              </div>

              {/* Accounts Download Button if accounts were generated */}
              {importSummary.createdAccounts.length > 0 && (
                <div className="bg-teal-50 dark:bg-teal-950/40 p-4 rounded-2xl border border-teal-200 dark:border-teal-800/60 max-w-xl mx-auto flex items-center justify-between text-xs text-left">
                  <div>
                    <p className="font-bold text-teal-900 dark:text-teal-200">
                      User login credentials generated ({importSummary.createdAccounts.length})
                    </p>
                    <p className="text-[11px] text-teal-700 dark:text-teal-400 mt-0.5">
                      Download the CSV containing usernames and initial PINs for distribution
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadCredentialsCsv}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PINs</span>
                  </button>
                </div>
              )}

              {/* Errors list if any */}
              {importSummary.errors.length > 0 && (
                <div className="max-w-xl mx-auto text-left bg-rose-50 dark:bg-rose-950/20 p-3 rounded-xl border border-rose-200 dark:border-rose-900/40 text-xs">
                  <p className="font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1 mb-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Some rows could not be saved:</span>
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 text-rose-600 dark:text-rose-400 max-h-24 overflow-y-auto font-mono text-[11px]">
                    {importSummary.errors.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-8 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Done & View Staff Directory
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
