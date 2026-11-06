import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Scene3D } from "../components/Scene3D";
import { Shield, Lock, Zap, Eye, ChevronRight, Github, Twitter } from "lucide-react";

const Feature: React.FC<{ icon: React.ReactNode; title: string; desc: string }> = ({ icon, title, desc }) => (
  <div className="relative group p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm hover:border-red-500/50 transition-all duration-300 hover:-translate-y-1">
    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    <div className="relative">
      <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 text-red-400">
        {icon}
      </div>
      <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
      <p className="text-zinc-400 text-sm leading-relaxed">{desc}</p>
    </div>
  </div>
);

const Stat: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <div className="text-center">
    <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400 mb-1">
      {value}
    </div>
    <div className="text-zinc-500 text-sm uppercase tracking-widest">{label}</div>
  </div>
);

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Staggered entrance animation via CSS classes
    const el = heroRef.current;
    if (el) {
      el.style.opacity = "0";
      el.style.transform = "translateY(30px)";
      setTimeout(() => {
        el.style.transition = "opacity 0.9s ease, transform 0.9s ease";
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      }, 100);
    }
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-x-hidden selection:bg-red-500 selection:text-white">

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-zinc-800/60 backdrop-blur-xl bg-zinc-950/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/30">
            <Lock className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-lg tracking-tight">
            Cash<span className="text-red-500">Layer</span>
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
          <a href="#stats" className="hover:text-white transition-colors">Stats</a>
        </div>
        <button
          onClick={() => navigate("/app")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-all duration-200 shadow-lg shadow-red-500/30 hover:shadow-red-500/50 hover:scale-105"
        >
          Launch App <ChevronRight className="w-4 h-4" />
        </button>
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* 3D canvas background */}
        <div className="absolute inset-0 z-0">
          <Scene3D />
        </div>

        {/* gradient overlay */}
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-zinc-950/40 via-zinc-950/20 to-zinc-950" />

        {/* hero content */}
        <div ref={heroRef} className="relative z-20 text-center max-w-5xl mx-auto px-6 pt-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-medium mb-8">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Live on Avalanche ElonDADA L1 Testnet
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-tight mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
              Private Payroll
            </span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-red-500 to-orange-500">
              Zero-Knowledge
            </span>
          </h1>

          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Encrypted, auditable, on-chain payroll using BabyJubjub + Poseidon cryptography.
            Salaries stay private. Compliance stays provable.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate("/app")}
              className="group flex items-center gap-3 px-8 py-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-lg transition-all duration-200 shadow-2xl shadow-red-500/40 hover:shadow-red-500/60 hover:scale-105"
            >
              Enter App
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a
              href="https://github.com/ElonCoding/ZeraAVAX"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 px-8 py-4 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-semibold text-lg transition-all duration-200 hover:bg-zinc-800/50"
            >
              <Github className="w-5 h-5" />
              View Source
            </a>
          </div>

          {/* scroll hint */}
          <div className="mt-20 flex flex-col items-center gap-2 animate-bounce text-zinc-600 text-xs uppercase tracking-widest">
            <span>Scroll</span>
            <div className="w-px h-10 bg-gradient-to-b from-zinc-600 to-transparent" />
          </div>
        </div>
      </section>

      {/* ── STATS ───────────────────────────────────────────── */}
      <section id="stats" className="relative z-10 py-20 border-y border-zinc-800/60 bg-zinc-900/30">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-10">
          <Stat value="0" label="Plaintext Leaked" />
          <Stat value="ZK" label="Proof System" />
          <Stat value="L1" label="Avalanche Native" />
          <Stat value="4" label="Contracts Live" />
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────── */}
      <section id="features" className="relative z-10 py-24 max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            Built for Real <span className="text-red-500">Privacy</span>
          </h2>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            Not just encrypted at rest — provably zero-knowledge on every transaction.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Feature
            icon={<Lock className="w-6 h-6" />}
            title="Zero-Plaintext Payroll"
            desc="Salary amounts are encrypted with BabyJubjub. No one — not even the validator — sees raw figures."
          />
          <Feature
            icon={<Shield className="w-6 h-6" />}
            title="Compliance-Provable"
            desc="Authorized auditors decrypt via PCT keys and post on-chain attestations. Full audit trail without data exposure."
          />
          <Feature
            icon={<Zap className="w-6 h-6" />}
            title="Avalanche L1 Speed"
            desc="Deployed on ElonDADA — a custom Avalanche L1 subnet with sub-second finality and near-zero gas fees."
          />
          <Feature
            icon={<Eye className="w-6 h-6" />}
            title="Observer Verifiable"
            desc="Public observers can confirm zero plaintext leakage on-chain without any decryption key."
          />
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section id="how-it-works" className="relative z-10 py-24 bg-zinc-900/40">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              How It <span className="text-red-500">Works</span>
            </h2>
          </div>

          <div className="relative">
            {/* vertical line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-red-500 via-orange-500 to-transparent hidden md:block" />

            {[
              { step: "01", title: "Employer Connects Wallet", desc: "Connect Core Wallet or MetaMask. The app routes you to ElonDADA L1 (chain 111522) automatically." },
              { step: "02", title: "Build Payroll Batch", desc: "Upload CSV or add employees manually. Addresses and amounts are Poseidon-encrypted client-side before any chain interaction." },
              { step: "03", title: "Sign & Submit On-Chain", desc: "Wallet popup prompts you to sign. The encrypted batch is committed to the PrivatePayroll contract — no plaintext ever leaves the browser." },
              { step: "04", title: "Auditor Attests Compliance", desc: "An authorized auditor decrypts via their PCT key, verifies totals match, and posts a signed attestation on-chain." },
            ].map((item, i) => (
              <div key={i} className="relative flex gap-8 mb-12 group">
                <div className="relative z-10 flex-shrink-0 w-16 h-16 rounded-full bg-zinc-900 border-2 border-red-500/50 group-hover:border-red-500 transition-colors flex items-center justify-center">
                  <span className="text-red-400 font-black text-sm">{item.step}</span>
                </div>
                <div className="pt-3">
                  <h3 className="text-white font-bold text-xl mb-2">{item.title}</h3>
                  <p className="text-zinc-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="relative z-10 py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 via-transparent to-orange-900/10" />
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none select-none">
          <span className="text-[20rem] font-black text-red-500 leading-none">ZK</span>
        </div>
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-5xl md:text-6xl font-black text-white mb-6">
            Ready to run <span className="text-red-500">private</span> payroll?
          </h2>
          <p className="text-zinc-400 text-xl mb-10">
            Connect your wallet. No registration. No custody. 100% on-chain.
          </p>
          <button
            onClick={() => navigate("/app")}
            className="group inline-flex items-center gap-3 px-10 py-5 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-black text-xl transition-all duration-200 shadow-2xl shadow-red-500/40 hover:shadow-red-500/70 hover:scale-105"
          >
            Launch CashLayer
            <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-zinc-800/60 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
              <Lock className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-black text-zinc-400">
              Cash<span className="text-red-500">Layer</span>
            </span>
          </div>
          <div className="text-zinc-600 text-sm text-center">
            Deployed on Avalanche ElonDADA L1 Testnet · Chain ID 111522 · Zero-Plaintext Invariant
          </div>
          <div className="flex items-center gap-4 text-zinc-500">
            <a href="https://github.com/ElonCoding/ZeraAVAX" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              <Github className="w-5 h-5" />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              <Twitter className="w-5 h-5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
