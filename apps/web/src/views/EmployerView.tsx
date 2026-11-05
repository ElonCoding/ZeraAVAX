import React, { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { usePayroll } from "../context/PayrollContext";
import { WebPayrollItem, WebBatchPreflightSummary } from "../types";
import { CryptoService } from "../services/cryptoService";
import { PreflightModal } from "../components/PreflightModal";
import {
  Building2,
  Plus,
  Trash2,
  UploadCloud,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Wallet,
} from "lucide-react";

export const EmployerView: React.FC = () => {
  const { account, isConnected, connectInjectedWallet } = useWallet();
  const { batches, employerBalance, createAndSubmitBatch } = usePayroll();

  const [items, setItems] = useState<WebPayrollItem[]>([
    {
      id: "row-1",
      address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      amount: "1500000",
      department: "Engineering",
    },
    {
      id: "row-2",
      address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      amount: "1200000",
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

  const handleRemoveRow = (id: string) => {
    setItems((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRow = (id: string, field: keyof WebPayrollItem, val: string) => {
    setItems((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: val } : r))
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      const res = CryptoService.parseRosterCsvString(content);
      if (res.errors && res.errors.length > 0) {
        setFormErrors(res.errors);
        setCsvStatus(null);
      } else {
        setItems(res.items);
        setFormErrors([]);
        setCsvStatus(`Loaded ${res.items.length} employee entries from CSV`);
      }
    };
    reader.readAsText(file);
  };

  const handleOpenPreflight = () => {
    setFormErrors([]);
    setSuccessMsg(null);

    const validation = CryptoService.validateAndSummarizeBatch(items);
    if (!validation.valid || !validation.summary) {
      setFormErrors(validation.errors);
      return;
    }

    setPreflightSummary(validation.summary);
    setIsPreflightOpen(true);
  };

  const handleConfirmBatch = async () => {
    if (!account) {
      alert("Please connect your wallet first.");
      return;
    }

    setIsSubmitting(true);
    setFormErrors([]);

    try {
      await createAndSubmitBatch({
        items,
        employerAddress: account,
        onProgress: (status) => setSubmissionState(status),
      });

      setIsPreflightOpen(false);
      setSuccessMsg("Payroll batch created & encrypted successfully on Avalanche Fuji!");
    } catch (err: any) {
      setFormErrors([err.message || "Execution failed"]);
    } finally {
      setIsSubmitting(false);
      setSubmissionState(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Wallet Check */}
      {!isConnected && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Wallet className="w-5 h-5 text-red-400" />
            <div>
              <div className="text-sm font-semibold text-white">Wallet Not Connected</div>
              <div className="text-xs text-zinc-400">Connect Core Wallet or MetaMask to create encrypted batches on Avalanche.</div>
            </div>
          </div>
          <button
            onClick={() => connectInjectedWallet()}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white shadow-md shadow-red-600/30"
          >
            Connect Wallet
          </button>
        </div>
      )}

      {/* Main Roster Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-zinc-800 gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center">
              <Building2 className="w-5 h-5 mr-2 text-red-500" />
              Enterprise Payroll Dispatch
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Draft compensation roster. Salaries are client-encrypted with BabyJubJub curve prior to submission.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <label className="flex items-center px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 font-medium cursor-pointer transition-all">
              <UploadCloud className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />
              Upload CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={handleAddRow}
              className="flex items-center px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-white font-medium transition-all"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Row
            </button>
          </div>
        </div>

        {csvStatus && (
          <div className="mt-4 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {csvStatus}
          </div>
        )}

        {formErrors.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-red-950/50 border border-red-500/30 text-red-300 text-xs space-y-1">
            {formErrors.map((err, idx) => (
              <div key={idx} className="flex items-center">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-red-400 flex-shrink-0" />
                {err}
              </div>
            ))}
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-xs flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" />
            {successMsg}
          </div>
        )}

        {/* Roster Table */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Employee Avalanche Address</th>
                <th className="py-2.5 px-3">Compensation (Tokens)</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {items.map((row, idx) => (
                <tr key={row.id} className="hover:bg-zinc-800/30">
                  <td className="py-2.5 px-3 text-zinc-500">{idx + 1}</td>
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      value={row.address}
                      placeholder="0x..."
                      onChange={(e) => handleUpdateRow(row.id, "address", e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-zinc-200 focus:outline-none focus:border-red-500"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      value={row.amount}
                      placeholder="1000000"
                      onChange={(e) => handleUpdateRow(row.id, "amount", e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-zinc-200 focus:outline-none focus:border-red-500"
                    />
                  </td>
                  <td className="py-2.5 px-3 font-sans">
                    <input
                      type="text"
                      value={row.department || ""}
                      placeholder="e.g. Core Dev"
                      onChange={(e) => handleUpdateRow(row.id, "department", e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-zinc-200 focus:outline-none focus:border-red-500"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => handleRemoveRow(row.id)}
                      className="text-zinc-500 hover:text-red-400 p-1"
                      title="Delete row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleOpenPreflight}
            disabled={items.length === 0}
            className="flex items-center px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-xs font-semibold text-white shadow-lg shadow-red-600/25 transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 mr-1.5" />
            Review & Sign Batch
          </button>
        </div>
      </div>

      {/* Executed Batches Table */}
      {batches.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center">
            <Layers className="w-4 h-4 mr-2 text-red-500" />
            On-Chain Batch History ({batches.length})
          </h3>
          <div className="space-y-3">
            {batches.map((batch) => (
              <div key={batch.batchId} className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
                <div>
                  <div className="font-mono text-zinc-200 font-semibold">{batch.batchId.slice(0, 18)}...</div>
                  <div className="text-zinc-500 text-[11px] mt-0.5">
                    {batch.employeeCount} recipients • Status: <span className="text-emerald-400">{batch.status}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-zinc-400 text-[11px]">
                    Commitment: {batch.rosterCommitment.slice(0, 10)}...
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preflight Modal */}
      {isPreflightOpen && preflightSummary && (
        <PreflightModal
          isOpen={isPreflightOpen}
          summary={preflightSummary}
          isSubmitting={isSubmitting}
          submissionState={submissionState}
          onConfirm={handleConfirmBatch}
          onClose={() => {
            setIsPreflightOpen(false);
            setSubmissionState(null);
          }}
        />
      )}
    </div>
  );
};
