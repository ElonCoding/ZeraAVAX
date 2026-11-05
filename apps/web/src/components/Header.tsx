import React, { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { PersonaRole } from "../types";
import {
  Building2,
  UserCheck,
  FileCheck2,
  Eye,
  AlertTriangle,
  Wallet,
  Radio,
  ExternalLink,
} from "lucide-react";
import { AVALANCHE_FUJI_CHAIN_ID } from "@cashlayer/shared";

export const Header: React.FC = () => {
  const {
    account,
    activeAccount,
    chainId,
    isConnected,
    isNetworkValid,
    networkError,
    activeRole,
    walletProviderType,
    isRealWalletConnected,
    setActiveRole,
    connectInjectedWallet,
    disconnectWallet,
    switchNetwork,
  } = useWallet();

  const [showWalletModal, setShowWalletModal] = useState(false);

  const roleIcons: Record<PersonaRole, React.ReactNode> = {
    employer: <Building2 className="w-4 h-4 mr-1.5" />,
    employee: <UserCheck className="w-4 h-4 mr-1.5" />,
    auditor: <FileCheck2 className="w-4 h-4 mr-1.5" />,
    observer: <Eye className="w-4 h-4 mr-1.5" />,
  };

  return (
    <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Avalanche Subnet Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-red-600/10 border border-red-500/30 flex items-center justify-center text-red-500 shadow-sm">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13H5.5L12 6.5z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">CashLayer</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 font-mono font-medium">
                  Avalanche Fuji
                </span>
                {isRealWalletConnected && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold flex items-center">
                    <Radio className="w-2.5 h-2.5 mr-1 animate-pulse" />
                    {walletProviderType === "core" ? "CORE CONNECTED" : "METAMASK CONNECTED"}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 hidden sm:block">
                Zero-Knowledge Enterprise Confidential Payroll on Avalanche L1
              </p>
            </div>
          </div>

          {/* Persona Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            {(
              [
                { role: "employer", label: "Employer View" },
                { role: "employee", label: "Employee Portal" },
                { role: "auditor", label: "Auditor Panel" },
                { role: "observer", label: "Public Observer" },
              ] as const
            ).map(({ role, label }) => {
              const active = activeRole === role;
              return (
                <button
                  key={role}
                  onClick={() => setActiveRole(role)}
                  className={`flex items-center px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? "bg-zinc-800 text-white shadow-sm border border-zinc-700/80"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                  }`}
                >
                  {roleIcons[role]}
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Right Actions: Network & Real Web3 Connect Button */}
          <div className="flex items-center space-x-3">
            {/* Fuji Network Indicator */}
            {isNetworkValid ? (
              <div className="hidden lg:flex items-center px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                <span className="text-zinc-300 font-medium">Avalanche Fuji</span>
                <span className="text-zinc-500 ml-1.5 font-mono">(43113)</span>
              </div>
            ) : (
              <button
                onClick={() => switchNetwork(AVALANCHE_FUJI_CHAIN_ID)}
                className="flex items-center px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs hover:bg-amber-500/20 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                <span>Switch to Fuji</span>
              </button>
            )}

            {/* Direct Connect / Disconnect Button */}
            {isConnected && account ? (
              <div className="flex items-center space-x-2">
                <div className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="font-mono">{`${account.slice(0, 6)}...${account.slice(-4)}`}</span>
                </div>
                <button
                  onClick={disconnectWallet}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 border border-zinc-700 transition-colors"
                  title="Disconnect"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowWalletModal(true)}
                className="flex items-center px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white shadow-lg shadow-red-600/25 hover:shadow-red-600/40 transition-all cursor-pointer"
              >
                <Wallet className="w-4 h-4 mr-1.5" />
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Network Alert */}
      {networkError && (
        <div className="bg-amber-950/80 border-t border-amber-800/80 px-4 py-2 text-xs text-amber-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{networkError}</span>
          </div>
          <button
            onClick={() => switchNetwork(AVALANCHE_FUJI_CHAIN_ID)}
            className="px-2.5 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs transition-colors"
          >
            Switch to Fuji (43113)
          </button>
        </div>
      )}

      {/* Direct Injected Wallet Selection Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-1">Select Avalanche Wallet</h3>
            <p className="text-xs text-zinc-400 mb-6">
              Connect your Web3 browser extension to sign payroll batches and verify on-chain contracts.
            </p>

            <div className="space-y-3">
              {/* Avalanche Core Wallet Option */}
              <button
                onClick={async () => {
                  setShowWalletModal(false);
                  await connectInjectedWallet("core");
                }}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-red-500/50 hover:bg-zinc-800/60 transition-all text-left group"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/30 flex items-center justify-center text-xl">
                    🔺
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white group-hover:text-red-400 transition-colors">
                      Avalanche Core Wallet
                    </div>
                    <div className="text-xs text-zinc-400">Official native wallet for Avalanche Subnets & L1s</div>
                  </div>
                </div>
                <span className="text-xs font-semibold text-red-400">Connect &rarr;</span>
              </button>

              {/* MetaMask Option */}
              <button
                onClick={async () => {
                  setShowWalletModal(false);
                  await connectInjectedWallet("metamask");
                }}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-orange-500/50 hover:bg-zinc-800/60 transition-all text-left group"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-xl">
                    🦊
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white group-hover:text-orange-400 transition-colors">
                      MetaMask
                    </div>
                    <div className="text-xs text-zinc-400">Ethereum & EVM compatible browser extension</div>
                  </div>
                </div>
                <span className="text-xs font-semibold text-orange-400">Connect &rarr;</span>
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-end">
              <button
                onClick={() => setShowWalletModal(false)}
                className="text-xs px-4 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
