import React, { useState } from "react";
import { usePayroll } from "../context/PayrollContext";
import { CryptoService } from "../services/cryptoService";
import {
  Eye,
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  Code2,
  ExternalLink,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export const ObserverView: React.FC = () => {
  const { txLogs, tokenAddress } = usePayroll();

  const [searchTxHash, setSearchTxHash] = useState<string>("");
  const [expandedTx, setExpandedTx] = useState<string | null>(txLogs[0]?.txHash || null);
  const [testPlaintext, setTestPlaintext] = useState<string>("1250000");
  const [leakCheckResult, setLeakCheckResult] = useState<{
    checked: boolean;
    isSecure: boolean;
    leakedAmounts: bigint[];
  } | null>(null);

  const filteredLogs = searchTxHash.trim()
    ? txLogs.filter((l) => l.txHash.toLowerCase().includes(searchTxHash.trim().toLowerCase()))
    : txLogs;

  const handleRunLeakCheck = () => {
    if (!testPlaintext.trim()) return;

    try {
      const amt = BigInt(testPlaintext.trim());
      // Test across all visible logs
      let hasLeak = false;
      const allLeaked: bigint[] = [];

      for (const log of txLogs) {
        const res = CryptoService.verifyZeroPlaintextLeakage(log, [amt]);
        if (!res.isSecure) {
          hasLeak = true;
          allLeaked.push(...res.leakedAmounts);
        }
      }

      setLeakCheckResult({
        checked: true,
        isSecure: !hasLeak,
        leakedAmounts: allLeaked,
      });
    } catch {
      alert("Invalid numeric plaintext test value.");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Explorer Header Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Eye className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-bold text-white tracking-tight">Public Observer Explorer</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-medium">
                Public Blockchain Node
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Audit on-chain payroll transactions to cryptographically verify zero plaintext disclosure of salaries.
            </p>
          </div>

          <div className="flex items-center space-x-2 p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-[10px] text-zinc-500 uppercase font-semibold">Privacy Shield</div>
              <div className="text-emerald-400 font-bold">100% Ciphertext Only</div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Zero-Plaintext Audit Tool Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <h3 className="font-semibold text-white text-base">Zero-Plaintext Leakage Auditor</h3>
          <p className="text-xs text-zinc-400">
            Enter any sensitive employee salary amount to cryptographically scan all transaction calldata, logs, and event topics.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={testPlaintext}
              onChange={(e) => setTestPlaintext(e.target.value)}
              placeholder="e.g. 1250000"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={handleRunLeakCheck}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center"
          >
            <Search className="w-4 h-4 mr-1.5" />
            Audit Calldata & Logs
          </button>
        </div>

        {leakCheckResult && (
          <div
            className={`p-4 rounded-xl border text-xs flex items-start space-x-3 transition-all ${
              leakCheckResult.isSecure
                ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                : "bg-red-950/40 border-red-500/40 text-red-200"
            }`}
          >
            {leakCheckResult.isSecure ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-emerald-300 block">
                    Zero-Plaintext Invariant Confirmed (PASS)
                  </span>
                  <p className="text-emerald-300/80">
                    The salary amount <span className="font-mono font-bold">{testPlaintext}</span> does NOT appear anywhere in the transaction calldata, Poseidon ciphertexts, or emitted event topics. Public observers learn zero information about employee compensation.
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-red-300 block">
                    Plaintext Leakage Detected!
                  </span>
                  <p className="text-red-300/80">
                    The value {testPlaintext} was discovered in public blockchain data.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Transaction & Calldata Explorer */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-zinc-400" />
            <h3 className="font-semibold text-white text-base">Live Confidential Transfer Transactions</h3>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              value={searchTxHash}
              onChange={(e) => setSearchTxHash(e.target.value)}
              placeholder="Search by Tx Hash..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-700"
            />
          </div>
        </div>

        <div className="p-6 space-y-4">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-xs">
              No matching on-chain transactions found.
            </div>
          ) : (
            filteredLogs.map((tx) => {
              const isExpanded = expandedTx === tx.txHash;
              return (
                <div
                  key={tx.txHash}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden transition-all"
                >
                  <div
                    onClick={() => setExpandedTx(isExpanded ? null : tx.txHash)}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer hover:bg-zinc-900/60 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-zinc-200">
                          {tx.txHash.slice(0, 16)}...{tx.txHash.slice(-8)}
                        </span>
                        <span className="px-2 py-0.2 rounded text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold uppercase">
                          Confirmed (Block {tx.blockNumber.toString()})
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono">
                        Sender: {tx.sender.slice(0, 6)}...{tx.sender.slice(-4)} → Recipient:{" "}
                        {tx.recipient.slice(0, 6)}...{tx.recipient.slice(-4)}
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-500 block uppercase">Gas Used</span>
                        <span className="text-xs font-mono text-zinc-300">
                          {tx.gasUsed.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-zinc-500">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Calldata & Topics Inspection */}
                  {isExpanded && (
                    <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/40 space-y-3 font-mono text-xs">
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                          <span className="flex items-center font-sans font-semibold">
                            <Code2 className="w-3.5 h-3.5 mr-1 text-zinc-500" />
                            Transaction Calldata Preview
                          </span>
                          <span className="text-emerald-400 text-[10px] font-sans font-medium">
                            ✓ Encrypted Proof & Ciphertexts
                          </span>
                        </div>
                        <div className="p-2.5 bg-zinc-950 rounded border border-zinc-800 text-zinc-300 text-[11px] break-all">
                          {tx.calldataPreview}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] text-zinc-400 mb-1 font-sans font-semibold">
                          BabyJubjub / Poseidon uint256[7] auditorPCT (Compliance Ciphertext):
                        </div>
                        <div className="p-2.5 bg-zinc-950 rounded border border-zinc-800 text-purple-300/80 text-[10px] space-y-1">
                          {tx.auditorPCT.map((pct, idx) => (
                            <div key={idx} className="truncate">
                              [{idx}]: {pct}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between text-[11px] font-sans text-zinc-500">
                        <span>On-Chain Settlement Verification</span>
                        <a
                          href={`https://subnets.avax.network/c-chain/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          View in Block Explorer <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
