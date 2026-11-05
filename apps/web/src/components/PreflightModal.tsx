import React from "react";
import { WebBatchPreflightSummary } from "../types";
import { ShieldCheck, Lock, AlertCircle, Fuel, Users, Hash, CheckCircle2, X } from "lucide-react";

interface PreflightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  summary: WebBatchPreflightSummary | null;
  isSubmitting: boolean;
  submissionState: "Draft" | "Ready" | "Submitted" | "Confirmed" | null;
}

export const PreflightModal: React.FC<PreflightModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  summary,
  isSubmitting,
  submissionState,
}) => {
  if (!isOpen || !summary) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-white text-base">Pre-Flight Confidential Batch Review</h3>
          </div>
          {!isSubmitting && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Zero-Plaintext Privacy Shield Banner */}
          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs flex items-start space-x-3">
            <Lock className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold text-emerald-300 block mb-0.5">
                Zero-Plaintext Privacy Shield Enforced
              </span>
              All individual salaries will be encrypted client-side using BabyJubjub public keys and Poseidon ciphertexts. Plaintext amounts NEVER appear in transaction calldata or on-chain events.
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-xl">
              <div className="flex items-center text-xs text-zinc-400 mb-1">
                <Users className="w-3.5 h-3.5 mr-1.5 text-zinc-500" />
                Recipients
              </div>
              <div className="text-xl font-bold text-white">{summary.employeeCount}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">
                {summary.deduplicatedCount} unique addresses verified
              </div>
            </div>

            <div className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-xl">
              <div className="flex items-center text-xs text-zinc-400 mb-1">
                <Lock className="w-3.5 h-3.5 mr-1.5 text-zinc-500" />
                Gross Batch Amount
              </div>
              <div className="text-xl font-bold text-white font-mono">
                {summary.totalPlaintextGross.toLocaleString()}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Confidential eERC Token Units</div>
            </div>
          </div>

          {/* Roster Commitment Hash */}
          <div className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-xl">
            <div className="flex items-center text-xs text-zinc-400 mb-1">
              <Hash className="w-3.5 h-3.5 mr-1.5 text-zinc-500" />
              Cryptographic Roster Commitment
            </div>
            <div className="text-xs font-mono text-zinc-300 break-all bg-zinc-900 p-2 rounded border border-zinc-800">
              {summary.rosterCommitment}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1">
              Poseidon hash binding recipient addresses and encrypted amounts on-chain
            </div>
          </div>

          {/* Gas & Fee Estimates */}
          <div className="flex items-center justify-between px-3 py-2 bg-zinc-950/40 rounded-lg border border-zinc-800/50 text-xs">
            <div className="flex items-center text-zinc-400">
              <Fuel className="w-3.5 h-3.5 mr-1.5 text-zinc-500" />
              Estimated Gas Cost
            </div>
            <div className="font-mono text-zinc-300">{summary.estimatedGas.toString()} gas units</div>
          </div>

          {/* Execution State Machine Indicator if Submitting */}
          {isSubmitting && (
            <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
              <div className="text-xs font-semibold text-zinc-300">Execution Progress:</div>
              <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono">
                {(["Draft", "Ready", "Submitted", "Confirmed"] as const).map((step) => {
                  const isCurrent = submissionState === step;
                  const isPast =
                    (step === "Draft" && ["Draft", "Ready", "Submitted", "Confirmed"].includes(submissionState || "")) ||
                    (step === "Ready" && ["Ready", "Submitted", "Confirmed"].includes(submissionState || "")) ||
                    (step === "Submitted" && ["Submitted", "Confirmed"].includes(submissionState || "")) ||
                    (step === "Confirmed" && submissionState === "Confirmed");

                  return (
                    <div
                      key={step}
                      className={`p-1.5 rounded border transition-all ${
                        isCurrent
                          ? "bg-red-500/20 border-red-500 text-red-300 font-bold animate-pulse"
                          : isPast
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                          : "bg-zinc-900 border-zinc-800 text-zinc-600"
                      }`}
                    >
                      {step}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 transition-all flex items-center disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2"></div>
                Executing ({submissionState})...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Confirm & Submit Batch
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
