import React, { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { usePayroll } from "../context/PayrollContext";
import { DEMO_ACCOUNTS } from "../data/demoAccounts";
import {
  FileCheck2,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  Stamp,
  ExternalLink,
  Info,
} from "lucide-react";

export const AuditorView: React.FC = () => {
  const { activeAccount } = useWallet();
  const {
    batches,
    attestations,
    isAuditorAuthorized,
    reconcileAuditorBatch,
    submitComplianceAttestation,
  } = usePayroll();

  const auditorAccount = DEMO_ACCOUNTS.find((a) => a.role === "auditor") || DEMO_ACCOUNTS[6];
  const isAuthorized = isAuditorAuthorized(auditorAccount.address);

  const [selectedBatchId, setSelectedBatchId] = useState<string>(
    batches[0]?.batchId || ""
  );
  const [isAttesting, setIsAttesting] = useState(false);
  const [attestationSuccess, setAttestationSuccess] = useState<string | null>(null);

  const targetBatch = batches.find((b) => b.batchId === selectedBatchId) || batches[0];

  const reconciliation = targetBatch
    ? reconcileAuditorBatch(
        targetBatch.batchId,
        auditorAccount.address,
        auditorAccount.babyJubSecret.toString()
      )
    : null;

  const handleAttest = async () => {
    if (!reconciliation || !targetBatch) return;
    setIsAttesting(true);
    try {
      const rec = await submitComplianceAttestation({
        batchId: targetBatch.batchId,
        auditorAddress: auditorAccount.address,
        reportHash: reconciliation.reportHash,
        isCompliant: reconciliation.isCompliant,
        totalDecrypted: reconciliation.totalDecrypted,
        expectedTotal: reconciliation.expectedTotal,
      });
      setAttestationSuccess(
        `Compliance Attestation successfully registered on ComplianceVerifier! Report Hash: ${rec.reportHash.slice(0, 12)}...`
      );
    } catch (err: any) {
      alert(`Attestation failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsAttesting(false);
    }
  };

  const existingAttestation = targetBatch
    ? attestations.find((a) => a.batchId === targetBatch.batchId)
    : null;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Auditor Header Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <FileCheck2 className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl font-bold text-white tracking-tight">Auditor Compliance Panel</h2>
              {isAuthorized ? (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium">
                  Authorized Auditor
                </span>
              ) : (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 font-medium">
                  Unauthorized Caller
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              Independent regulatory reconciliation of on-chain eERC transfers and immutable compliance attestations.
            </p>
          </div>

          <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs space-y-0.5">
            <div className="text-[10px] text-zinc-500 uppercase font-semibold">Registered Entity</div>
            <div className="font-semibold text-zinc-200">Apex Compliance LLC</div>
            <div className="font-mono text-[10px] text-zinc-500">
              {auditorAccount.address.slice(0, 8)}...{auditorAccount.address.slice(-6)}
            </div>
          </div>
        </div>
      </div>

      {/* Strict Non-Overreach Guardrail Banner */}
      <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs flex items-start space-x-3">
        <Info className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <span className="font-semibold text-amber-300 block">
            Auditor Disclosure & Non-Overreach Notice
          </span>
          <p className="text-amber-300/80 leading-relaxed">
            Auditor disclosure notice: eERC auditor key decrypts all private transfers on this token contract while active. Selective sub-batch masking is not claimed without separate token instances. This panel only surfaces cryptographically authorized batch reconciliations.
          </p>
        </div>
      </div>

      {attestationSuccess && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{attestationSuccess}</span>
          </div>
          <button onClick={() => setAttestationSuccess(null)} className="text-emerald-400 hover:text-white font-medium">
            Dismiss
          </button>
        </div>
      )}

      {/* Batch Selector & Reconciliation Overview */}
      {targetBatch && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Target Batch Selector */}
          <div className="md:col-span-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="font-semibold text-white text-base">Select Target Batch</h3>
            <div className="space-y-2">
              {batches.map((b) => (
                <button
                  key={b.batchId}
                  onClick={() => setSelectedBatchId(b.batchId)}
                  className={`w-full text-left p-3 rounded-xl border text-xs transition-all font-mono ${
                    (selectedBatchId || batches[0]?.batchId) === b.batchId
                      ? "bg-zinc-800 border-purple-500/50 text-white shadow-md"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-200">
                      {b.batchId.slice(0, 8)}...{b.batchId.slice(-4)}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400">
                      {b.employeeCount} pkts
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-1 font-sans">
                    Reported Total: {BigInt(b.totalGrossAmount).toLocaleString()} eERC
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Reconciliation Audit Results Card */}
          <div className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white text-base">Disbursement Reconciliation Table</h3>
                <p className="text-xs text-zinc-400">
                  Decrypted using auditor private key and matched against reported batch totals.
                </p>
              </div>

              {reconciliation?.isCompliant ? (
                <span className="flex items-center text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Audit Compliant
                </span>
              ) : (
                <span className="flex items-center text-xs font-semibold px-3 py-1 rounded-full bg-red-500/10 border border-red-500/40 text-red-400">
                  <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                  Discrepancy Detected
                </span>
              )}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
                <div className="text-[10px] text-zinc-500 uppercase font-semibold">Reported Gross</div>
                <div className="text-lg font-bold text-white font-mono mt-0.5">
                  {reconciliation?.expectedTotal.toLocaleString()}
                </div>
              </div>

              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
                <div className="text-[10px] text-zinc-500 uppercase font-semibold">Decrypted Sum</div>
                <div className="text-lg font-bold text-purple-400 font-mono mt-0.5">
                  {reconciliation?.totalDecrypted.toLocaleString()}
                </div>
              </div>

              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
                <div className="text-[10px] text-zinc-500 uppercase font-semibold">Discrepancy</div>
                <div className="text-lg font-bold font-mono mt-0.5 text-zinc-200">
                  {(
                    (reconciliation?.expectedTotal || 0n) - (reconciliation?.totalDecrypted || 0n)
                  ).toString()}{" "}
                  units
                </div>
              </div>
            </div>

            {/* Attestation Action Section */}
            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-white">Compliance Attestation Hash</div>
                <div className="font-mono text-[10px] text-zinc-400 break-all mt-0.5">
                  {reconciliation?.reportHash}
                </div>
              </div>

              {existingAttestation ? (
                <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-medium whitespace-nowrap">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Attested On-Chain</span>
                </div>
              ) : (
                <button
                  onClick={handleAttest}
                  disabled={isAttesting || !reconciliation?.isCompliant}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all flex items-center justify-center whitespace-nowrap disabled:opacity-50"
                >
                  <Stamp className="w-4 h-4 mr-1.5" />
                  {isAttesting ? "Attesting..." : "Attest Compliance On-Chain"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Granular Decrypted Transfers Table */}
      {reconciliation && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-950/40 flex items-center justify-between">
            <h3 className="font-semibold text-white text-base">Decrypted Transaction Breakdown</h3>
            <span className="text-xs text-zinc-500 font-mono">
              {reconciliation.reconciledTxs.length} Transfers Decrypted
            </span>
          </div>

          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-[11px] text-zinc-400 font-semibold uppercase">
                    <th className="pb-3">Tx Hash</th>
                    <th className="pb-3">Block</th>
                    <th className="pb-3">Sender</th>
                    <th className="pb-3">Recipient</th>
                    <th className="pb-3 text-right">Decrypted Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono">
                  {reconciliation.reconciledTxs.map((tx) => (
                    <tr key={tx.txHash} className="hover:bg-zinc-950/40 transition-colors">
                      <td className="py-3 text-zinc-300">
                        {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-6)}
                      </td>
                      <td className="py-3 text-zinc-400">{tx.blockNumber.toString()}</td>
                      <td className="py-3 text-zinc-400">{tx.sender.slice(0, 6)}...{tx.sender.slice(-4)}</td>
                      <td className="py-3 text-zinc-400">{tx.recipient.slice(0, 6)}...{tx.recipient.slice(-4)}</td>
                      <td className="py-3 text-right text-purple-400 font-bold">
                        {tx.decryptedAmount.toLocaleString()} eERC
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
