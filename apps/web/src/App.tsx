import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WalletProvider, useWallet } from "./context/WalletContext";
import { PayrollProvider } from "./context/PayrollContext";
import { Header } from "./components/Header";
import { EmployerView } from "./views/EmployerView";
import { EmployeeView } from "./views/EmployeeView";
import { AuditorView } from "./views/AuditorView";
import { ObserverView } from "./views/ObserverView";
import { ShieldCheck, Lock } from "lucide-react";

// Landing page lazy-loaded (heavy 3D deps)
const LandingPage = lazy(() =>
  import("./views/LandingPage").then((m) => ({ default: m.LandingPage }))
);

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center animate-pulse shadow-lg shadow-red-500/40">
        <Lock className="w-6 h-6 text-white" />
      </div>
      <p className="text-zinc-500 text-sm">Loading CashLayer…</p>
    </div>
  </div>
);

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

      <footer className="border-t border-zinc-800/80 bg-zinc-950/60 py-6 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>CashLayer Confidential Financial Engine v0.1.0</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">ElonDADA L1 · Chain 111522</span>
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

const AppShell: React.FC = () => (
  <WalletProvider>
    <PayrollProvider>
      <AppContent />
    </PayrollProvider>
  </WalletProvider>
);

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Landing page */}
          <Route path="/" element={<LandingPage />} />

          {/* App shell */}
          <Route path="/app" element={<AppShell />} />

          {/* Convenience redirects */}
          <Route path="/dashboard" element={<Navigate to="/app" replace />} />
          <Route path="/payroll" element={<Navigate to="/app" replace />} />
          <Route path="/launch" element={<Navigate to="/app" replace />} />
          <Route path="/home" element={<Navigate to="/" replace />} />

          {/* 404 → landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
