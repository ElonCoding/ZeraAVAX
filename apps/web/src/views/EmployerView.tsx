import React, { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { usePayroll } from "../context/PayrollContext";
import { WebPayrollItem, WebBatchPreflightSummary } from "../types";
import { CryptoService } from "../services/cryptoService";
import { PreflightModal } from "../components/PreflightModal";
import { DEMO_ACCOUNTS } from "../data/demoAccounts";
import {
  Building2,
  Plus,
  Trash2,
  UploadCloud,
  FileSpreadsheet,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Layers,
} from "lucide-react";

export const EmployerView: React.FC = () => {
  const { account, activeAccount, isConnected, isNetworkValid } = useWallet();
  const { batches, employerBalance, createAndSubmitBatch } = usePayroll();

  const [items, setItems] = useState<WebPayrollItem[]>([
    {
      id: "row-1",
      address: DEMO_ACCOUNTS[1].address,
      amount: "1250000",
      department: "Engineering",
    },
    {
      id: "row-2",
      address: DEMO_ACCOUNTS[2].address,
      amount: "1100000",
      department: "Product",
    },
  ]);

  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [csvStatus, setCsvStatus] = useState<string | null>(null);
  const [isPreflightOpen, setIsPreflightOpen] = useState(false);
  const [preflightSummary, setPreflightSummary] = useState<WebBatchPreflightSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState<"Draft" | "Ready" | "Submitted" | "Confirmed" | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add manual recipient row
  const handleAddRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}`,
        address: "",
        amount: "",
        department: "",
      },
    ]);
  };

  // Remove row
  const handleRemoveRow = (id: string) => {
    setItems((prev) => prev.filter((r) => r.id !== id));
  };

  // Update row
  const handleRowChange = (id: string, field: keyof WebPayrollItem, value: string) => {
    setItems((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  // Quick fill demo sample roster
  const handleLoadSampleRoster = () => {
    setItems([
      { id: "s-1", address: DEMO_ACCOUNTS[1].address, amount: "1250000", department: "Engineering" },
      { id: "s-2", address: DEMO_ACCOUNTS[2].address, amount: "1100000", department: "Product" },
      { id: "s-3", address: DEMO_ACCOUNTS[3].address, amount: "950000", department: "Design" },
      { id: "s-4", address: DEMO_ACCOUNTS[4].address, amount: "980000", department: "Quality" },
    ]);
    setFormErrors([]);
    setCsvStatus("Sample 4-employee roster loaded.");
  };

  // CSV Drag and Drop / File handler
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const parsed = CryptoService.parseRosterCsvString(content);
      if (parsed.errors && parsed.errors.length > 0) {
        setFormErrors(parsed.errors);
        setCsvStatus(null);
      } else {
        setItems(parsed.items);
        setFormErrors([]);
        setCsvStatus(`Imported ${parsed.items.length} employees from CSV with format validation.`);
      }
    };
    reader.readAsText(file);
  };

  // Initiate Pre-Flight Check
  const handleInitiatePreflight = () => {
    const validation = CryptoService.validateAndSummarizeBatch(items);
    if (!validation.valid || !validation.summary) {
      setFormErrors(validation.errors);
      return;
    }

    if (validation.summary.totalPlaintextGross > employerBalance) {
      setFormErrors([
        `Insufficient confidential treasury balance: Required ${validation.summary.totalPlaintextGross.toString()}, Available ${employerBalance.toString()}`,
      ]);
      return;
    }

    setFormErrors([]);
    setPreflightSummary(validation.summary);
    setIsPreflightOpen(true);
  };

  // Confirm and Execute Batch
  const handleConfirmExecute = async () => {
    if (!account) return;
    setIsSubmitting(true);

    try {
      const created = await createAndSubmitBatch({
        items,
        employerAddress: account,
        onProgress: (status) => setSubmissionState(status),
      });

      setSuccessMsg(`Confidential Batch ${created.batchId.slice(0, 10)}... successfully settled on Avalanche L1!`);
      setIsPreflightOpen(false);
      setSubmissionState(null);
    } catch (err: any) {
      setFormErrors([err?.message || "Batch submission failed"]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Employer Overview Header Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Building2 className="w-6 h-6 text-red-500" />
              <h2 className="text-xl font-bold text-white tracking-tight">Employer Payroll Workspace</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium">
                Authorized Operator
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Draft, encrypt, and dispatch confidential eERC compensation batches with zero plaintext on-chain leakage.
            </p>
          </div>

          {/* Confidential Balance Card */}
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center space-x-4">
            <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
              <Lock className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase font-semibold">Treasury Balance</div>
              <div className="text-lg font-bold font-mono text-white">
                {employerBalance.toLocaleString()} <span className="text-xs text-zinc-400 font-normal">eERC Units</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white font-medium">
            Dismiss
          </button>
        </div>
      )}

      {formErrors.length > 0 && (
        <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-xl text-red-200 text-xs space-y-1">
          <div className="flex items-center space-x-2 font-semibold text-red-300">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span>Validation Errors ({formErrors.length}):</span>
          </div>
          <ul className="list-disc pl-6 space-y-0.5">
            {formErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Batch Creation Form Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white text-base">Create Confidential Payroll Batch</h3>
            <p className="text-xs text-zinc-400">
              Specify employee addresses and gross payout amounts. Auto-deduplication and range checks are enforced.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {/* Quick Sample Button */}
            <button
              onClick={handleLoadSampleRoster}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 border border-zinc-700 transition-colors"
            >
              Load Sample Roster
            </button>

            {/* CSV Upload Button */}
            <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 border border-zinc-700 transition-colors flex items-center">
              <UploadCloud className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />
              Upload CSV
              <input type="file" accept=".csv" onChange={handleCsvFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        {csvStatus && (
          <div className="px-6 py-2 bg-zinc-950/80 border-b border-zinc-800 text-xs text-zinc-400 flex items-center">
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-zinc-500" />
            {csvStatus}
          </div>
        )}

        {/* Recipients Form Rows Table */}
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-12 gap-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-2">
            <div className="col-span-6 sm:col-span-5">Recipient EVM Address</div>
            <div className="col-span-4 sm:col-span-3">Confidential Amount</div>
            <div className="hidden sm:block sm:col-span-3">Department (Optional)</div>
            <div className="col-span-2 sm:col-span-1 text-center">Action</div>
          </div>

          {items.map((item, index) => (
            <div
              key={item.id}
              className="grid grid-cols-12 gap-3 items-center p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700 transition-colors"
            >
              <div className="col-span-6 sm:col-span-5">
                <input
                  type="text"
                  placeholder="0x..."
                  value={item.address}
                  onChange={(e) => handleRowChange(item.id, "address", e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="col-span-4 sm:col-span-3">
                <input
                  type="text"
                  placeholder="e.g. 1000000"
                  value={item.amount}
                  onChange={(e) => handleRowChange(item.id, "amount", e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="hidden sm:block sm:col-span-3">
                <input
                  type="text"
                  placeholder="e.g. Engineering"
                  value={item.department || ""}
                  onChange={(e) => handleRowChange(item.id, "department", e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                />
              </div>

              <div className="col-span-2 sm:col-span-1 flex justify-center">
                <button
                  onClick={() => handleRemoveRow(item.id)}
                  disabled={items.length <= 1}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:hover:text-zinc-500"
                  title="Remove row"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-4 gap-3">
            <button
              onClick={handleAddRow}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 border border-zinc-700 transition-colors flex items-center justify-center"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Recipient
            </button>

            <button
              onClick={handleInitiatePreflight}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-600/20 transition-all flex items-center justify-center"
            >
              <ShieldCheck className="w-4 h-4 mr-1.5" />
              Pre-Flight Review & Execute
            </button>
          </div>
        </div>
      </div>

      {/* Batch History Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-950/40 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-zinc-400" />
            <h3 className="font-semibold text-white text-base">Dispatched Payroll Batch History</h3>
          </div>
          <span className="text-xs text-zinc-500 font-mono">{batches.length} Batches Recorded</span>
        </div>

        <div className="p-6">
          {batches.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-xs">
              No payroll batches dispatched yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-[11px] text-zinc-400 font-semibold uppercase">
                    <th className="pb-3">Batch ID</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Recipients</th>
                    <th className="pb-3">Total Gross</th>
                    <th className="pb-3">Roster Commitment</th>
                    <th className="pb-3 text-right">Explorer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono">
                  {batches.map((batch) => (
                    <tr key={batch.batchId} className="hover:bg-zinc-950/40 transition-colors">
                      <td className="py-3 text-zinc-300">
                        {batch.batchId.slice(0, 10)}...{batch.batchId.slice(-6)}
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                            batch.status === "Confirmed"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : batch.status === "Submitted"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {batch.status}
                        </span>
                      </td>
                      <td className="py-3 text-zinc-300">{batch.employeeCount}</td>
                      <td className="py-3 text-zinc-300">{BigInt(batch.totalGrossAmount).toLocaleString()}</td>
                      <td className="py-3 text-zinc-500 truncate max-w-[140px]">
                        {batch.rosterCommitment.slice(0, 12)}...
                      </td>
                      <td className="py-3 text-right">
                        {batch.txHashes.length > 0 ? (
                          <a
                            href={`https://subnets.avax.network/c-chain/tx/${batch.txHashes[0]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-zinc-400 hover:text-red-400 transition-colors"
                            title="Inspect on Avalanche Explorer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Pre-Flight Review Modal */}
      <PreflightModal
        isOpen={isPreflightOpen}
        onClose={() => setIsPreflightOpen(false)}
        onConfirm={handleConfirmExecute}
        summary={preflightSummary}
        isSubmitting={isSubmitting}
        submissionState={submissionState}
      />
    </div>
  );
};
