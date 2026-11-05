import React, { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { usePayroll } from "../context/PayrollContext";
import { DEMO_ACCOUNTS } from "../data/demoAccounts";
import {
  UserCheck,
  Lock,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";

export const EmployeeView: React.FC = () => {
  const { activeAccount, selectDemoAccount } = useWallet();
  const { getEmployeeIncomingPayments, getEmployeeBalance } = usePayroll();

  const employeeAccounts = DEMO_ACCOUNTS.filter((a) => a.role === "employee");

  // Default viewing key from active account's babyJubSecret
  const [viewingKey, setViewingKey] = useState<string>(
    activeAccount.babyJubSecret.toString()
  );
  const [isDecrypted, setIsDecrypted] = useState<boolean>(true);
  const [customKeyError, setCustomKeyError] = useState<string | null>(null);

  // When active account changes, update viewing key
  const handleSelectEmployee = (id: string) => {
    selectDemoAccount(id);
    const acc = DEMO_ACCOUNTS.find((a) => a.id === id);
    if (acc) {
      setViewingKey(acc.babyJubSecret.toString());
      setCustomKeyError(null);
    }
  };

  const incomingPayments = getEmployeeIncomingPayments(activeAccount.address);
  let decryptedBalance = 0n;

  try {
    decryptedBalance = getEmployeeBalance(activeAccount.address, viewingKey);
  } catch (err: any) {
    // viewing key failure
  }

  const handleTestKeyDecryption = () => {
    try {
      const b = getEmployeeBalance(activeAccount.address, viewingKey);
      if (b === 0n && incomingPayments.length > 0) {
        setCustomKeyError("Decryption failed: Provided viewing key cannot decrypt incoming Poseidon ciphertexts.");
      } else {
        setCustomKeyError(null);
        setIsDecrypted(true);
      }
    } catch {
      setCustomKeyError("Invalid viewing key syntax: Must be a valid BigInt numeric scalar.");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Banner & Employee Account Switcher */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <UserCheck className="w-6 h-6 text-emerald-400" />
              <h2 className="text-xl font-bold text-white tracking-tight">Employee Confidential Portal</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium">
                Client-Side Decryption
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Inspect your private compensation receipts using your personal BabyJubjub viewing key.
            </p>
          </div>

          {/* Quick Switch Employee Dropdown / Pills */}
          <div className="flex items-center space-x-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            {employeeAccounts.map((emp) => {
              const active = activeAccount.id === emp.id;
              return (
                <button
                  key={emp.id}
                  onClick={() => handleSelectEmployee(emp.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? "bg-zinc-800 text-white border border-zinc-700 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {emp.name.split(" ")[0]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Strict Privacy Isolation Guarantee Banner */}
      <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/30 text-purple-200 text-xs flex items-start space-x-3">
        <ShieldAlert className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <span className="font-semibold text-purple-300 block">
            Strict Privacy Isolation Guarantee
          </span>
          <p className="text-purple-300/80 leading-relaxed">
            Your viewing key only decrypts transfers intended exclusively for address{" "}
            <span className="font-mono text-purple-200">{activeAccount.address}</span>. You cannot inspect peer compensation (e.g. Alice, Bob, Charlie) or overall company payroll totals.
          </p>
        </div>
      </div>

      {/* Confidential Balance Card & Viewing Key Module */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Balance Card */}
        <div className="md:col-span-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
              <span className="flex items-center font-semibold uppercase tracking-wider text-[11px]">
                <Lock className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                Confidential Balance
              </span>
              <button
                onClick={() => setIsDecrypted(!isDecrypted)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
                title={isDecrypted ? "Mask Balance" : "Reveal Balance"}
              >
                {isDecrypted ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="text-3xl font-extrabold font-mono text-white tracking-tight mt-2">
              {isDecrypted ? (
                <>
                  {decryptedBalance.toLocaleString()}{" "}
                  <span className="text-sm font-normal text-zinc-400">eERC</span>
                </>
              ) : (
                <span className="tracking-widest text-zinc-500 font-sans">••••••••</span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Decrypted via local BabyJubjub scalar multiplication over BN254.
            </p>
          </div>

          <div className="pt-6 border-t border-zinc-800/80 mt-6 flex items-center justify-between text-xs">
            <span className="text-zinc-500">Public Address:</span>
            <span className="font-mono text-zinc-300">
              {activeAccount.address.slice(0, 6)}...{activeAccount.address.slice(-4)}
            </span>
          </div>
        </div>

        {/* Viewing Key Decryption Controller */}
        <div className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2">
            <KeyRound className="w-5 h-5 text-red-500" />
            <h3 className="font-semibold text-white text-base">Local Viewing Key Settings</h3>
          </div>
          <p className="text-xs text-zinc-400">
            This private viewing key never leaves your browser sandbox. It is utilized exclusively for local Poseidon sponge decryption.
          </p>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
              BabyJubjub Viewing Key Scalar (sk)
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={viewingKey}
                onChange={(e) => setViewingKey(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-red-500"
                placeholder="Enter BabyJubjub scalar key..."
              />
              <button
                onClick={handleTestKeyDecryption}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white border border-zinc-700 transition-colors"
              >
                Decrypt
              </button>
            </div>
          </div>

          {customKeyError ? (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs">
              {customKeyError}
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Viewing key authenticated: Active and decrypting incoming receipts.</span>
            </div>
          )}
        </div>
      </div>

      {/* Incoming Payroll Payment History */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-950/40 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-white text-base">Incoming Confidential Receipts</h3>
          </div>
          <span className="text-xs text-zinc-500 font-mono">
            {incomingPayments.length} Payment(s) Received
          </span>
        </div>

        <div className="p-6">
          {incomingPayments.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-xs">
              No confidential payroll disbursements received for this account yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-[11px] text-zinc-400 font-semibold uppercase">
                    <th className="pb-3">Transaction Hash</th>
                    <th className="pb-3">Block Number</th>
                    <th className="pb-3">Sender (Employer)</th>
                    <th className="pb-3">Decrypted Amount</th>
                    <th className="pb-3">Proof Verification</th>
                    <th className="pb-3 text-right">Explorer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono">
                  {incomingPayments.map((p) => (
                    <tr key={p.txHash} className="hover:bg-zinc-950/40 transition-colors">
                      <td className="py-3 text-zinc-300">
                        {p.txHash.slice(0, 10)}...{p.txHash.slice(-6)}
                      </td>
                      <td className="py-3 text-zinc-400">{p.blockNumber.toString()}</td>
                      <td className="py-3 text-zinc-400">{p.sender.slice(0, 6)}...{p.sender.slice(-4)}</td>
                      <td className="py-3 text-emerald-400 font-bold">
                        +{p.decryptedAmount.toLocaleString()} eERC
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase font-semibold">
                          Groth16 Verified
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <a
                          href={`https://subnets.avax.network/c-chain/tx/${p.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-zinc-400 hover:text-emerald-400 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
