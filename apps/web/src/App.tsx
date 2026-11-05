import React from "react";
import { WalletProvider, useWallet } from "./context/WalletContext";
import { PayrollProvider } from "./context/PayrollContext";
import { Header } from "./components/Header";
import { EmployerView } from "./views/EmployerView";
import { EmployeeView } from "./views/EmployeeView";
import { AuditorView } from "./views/AuditorView";
import { ObserverView } from "./views/ObserverView";
import { ShieldCheck, Lock, ExternalLink } from "lucide-react";

const AppContent: React.FC = () => {
  const { activeRole } = useWallet();

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 selection:bg-red-500 selection:text-white">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeRole === "employer" && <EmployerView />}
        {activeRole === "employee" && <EmployeeView />}
        {activeRole === "auditor" && <AuditorView />}
        {activeRole === "observer" && <ObserverView />}
      </main>

      {/* Global Security Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950/60 py-6 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span>CashLayer Confidential Financial Engine v0.1.0</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">Avalanche eERC Standard</span>
          </div>

          <div className="flex items-center space-x-6 text-zinc-400">
            <span className="flex items-center">
              <Lock className="w-3.5 h-3.5 mr-1 text-emerald-400" />
              BabyJubjub / Poseidon Encrypted
            </span>
            <span className="flex items-center">
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-blue-400" />
              Zero-Plaintext Invariant
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <WalletProvider>
      <PayrollProvider>
        <AppContent />
      </PayrollProvider>
    </WalletProvider>
  );
};

export default App;
