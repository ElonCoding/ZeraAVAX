import React from "react";
import { useWallet } from "../context/WalletContext";
import { DEMO_ACCOUNTS } from "../data/demoAccounts";
import { PersonaRole } from "../types";
import {
  ShieldCheck,
  Building2,
  UserCheck,
  FileCheck2,
  Eye,
  AlertTriangle,
  Wallet,
  ChevronDown,
  Lock,
} from "lucide-react";
import { AVALANCHE_MAINNET_CHAIN_ID } from "@cashlayer/shared";

export const Header: React.FC = () => {
  const {
    account,
    activeAccount,
    chainId,
    isConnected,
    isNetworkValid,
    networkError,
    activeRole,
    setActiveRole,
    selectDemoAccount,
    disconnectWallet,
    connectWallet,
    switchNetwork,
  } = useWallet();

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
          {/* Logo & Branding */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-red-600/10 border border-red-500/30 flex items-center justify-center text-red-500">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13H5.5L12 6.5z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">CashLayer</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 font-mono font-medium">
                  Avalanche L1
                </span>
              </div>
              <p className="text-xs text-zinc-400 hidden sm:block">
                Confidential Enterprise Payroll with Audited eERC Standard
              </p>
            </div>
          </div>

          {/* Persona Tabs Navigation */}
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

          {/* Right Header Statuses & Wallet Controls */}
          <div className="flex items-center space-x-3">
            {/* Network Status Pill */}
            {isNetworkValid ? (
              <div className="hidden lg:flex items-center px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                <span className="text-zinc-300 font-medium">Avalanche L1</span>
                <span className="text-zinc-500 ml-1.5 font-mono">({chainId})</span>
              </div>
            ) : (
              <button
                onClick={() => switchNetwork(AVALANCHE_MAINNET_CHAIN_ID)}
                className="flex items-center px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs hover:bg-amber-500/20 transition-colors"
                title="Click to switch to Avalanche L1"
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                <span>Switch to Avalanche</span>
              </button>
            )}

            {/* Quick Switch Demo Account Dropdown */}
            <div className="relative group">
              <button className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-200">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="max-w-[120px] truncate">{activeAccount.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              <div className="absolute right-0 mt-1 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl py-2 hidden group-hover:block z-50">
                <div className="px-3 py-1.5 border-b border-zinc-800 text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  Switch Persona / Test Account
                </div>
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => selectDemoAccount(acc.id)}
                    className={`w-full text-left px-3 py-2 text-xs flex flex-col hover:bg-zinc-800/70 transition-colors ${
                      activeAccount.id === acc.id ? "bg-zinc-800/90 text-white font-medium" : "text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{acc.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-zinc-400 uppercase">
                        {acc.role}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono truncate mt-0.5">
                      {acc.address}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Connect / Disconnect Wallet */}
            {isConnected ? (
              <button
                onClick={disconnectWallet}
                className="hidden sm:flex items-center px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 border border-zinc-700 transition-colors"
                title="Disconnect Wallet"
              >
                <Wallet className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />
                <span className="font-mono">
                  {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Connected"}
                </span>
              </button>
            ) : (
              <button
                onClick={() => connectWallet()}
                className="flex items-center px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs text-white font-medium shadow-md shadow-red-600/20 transition-all"
              >
                <Wallet className="w-3.5 h-3.5 mr-1.5" />
                Connect Wallet
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Tabs */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-zinc-800/80">
          {(
            [
              { role: "employer", label: "Employer" },
              { role: "employee", label: "Employee" },
              { role: "auditor", label: "Auditor" },
              { role: "observer", label: "Explorer" },
            ] as const
          ).map(({ role, label }) => {
            const active = activeRole === role;
            return (
              <button
                key={role}
                onClick={() => setActiveRole(role)}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                  active ? "bg-zinc-800 text-white font-medium" : "text-zinc-400"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Network Error Notification Banner */}
      {networkError && (
        <div className="bg-amber-950/80 border-t border-amber-800/80 px-4 py-2 text-xs text-amber-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{networkError}</span>
          </div>
          <button
            onClick={() => switchNetwork(AVALANCHE_MAINNET_CHAIN_ID)}
            className="px-2.5 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs transition-colors"
          >
            Switch to Avalanche (43114)
          </button>
        </div>
      )}
    </header>
  );
};
