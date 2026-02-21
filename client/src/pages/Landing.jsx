import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useRef } from "react";
import {
  ScanSearch, Wrench, FileText, TestTube, GitMerge,
  ArrowRight, Database, Users, Lightbulb, Workflow, Rocket,
  FileCode, ShieldAlert, ShieldHalf, UsersRound, GitCommitHorizontal,
  PackageCheck, Search, Bomb, ShieldPlus, ChevronRight, ShieldCheck
} from "lucide-react";

/* ── Zero Trace Logo ── */
const ZeroTraceLogo = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="12" stroke="url(#zt-grad-land)" strokeWidth="2.5" fill="none" />
    <circle cx="16" cy="16" r="7" stroke="url(#zt-grad-land)" strokeWidth="1.5" fill="none" opacity="0.5" />
    <line x1="6" y1="26" x2="26" y2="6" stroke="url(#zt-grad-land)" strokeWidth="2" strokeLinecap="round" />
    <circle cx="16" cy="16" r="2.5" fill="url(#zt-grad-land)" />
    <defs>
      <linearGradient id="zt-grad-land" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#a855f7" />
        <stop offset="100%" stopColor="#e9d5ff" />
      </linearGradient>
    </defs>
  </svg>
);

/* ── Data ── */
const FEATURES = [
  { icon: <ShieldCheck size={20} />, title: "Multi-Agent AI", desc: "Autonomous agents collaborate like a real security team — analyst, attacker, patcher — all working in parallel." },
  { icon: <ScanSearch size={20} />, title: "Context-Aware Scanning", desc: "Goes beyond pattern matching. Understands how a logic flaw in one file can be exploited through another." },
  { icon: <Wrench size={20} />, title: "Auto Patch Generation", desc: "Not just detection — get production-ready fixes with diff previews and rollback support." },
  { icon: <FileText size={20} />, title: "Full Audit Trail", desc: "Every agent action, tool call, and reasoning step is logged. Full transparency, zero black box." },
  { icon: <TestTube size={20} />, title: "PoC Scripts", desc: "Generates proof-of-concept exploit scripts to verify every vulnerability before reporting." },
  { icon: <GitMerge size={20} />, title: "CI/CD Ready", desc: "Drop into any pipeline. GitHub Actions, GitLab CI, Jenkins — native integration out of the box." },
];

const STATS = [
  { value: "10x", label: "Faster than manual review" },
  { value: "94%", label: "Detection accuracy" },
  { value: "<1%", label: "False positive rate" },
  { value: "8", label: "Languages supported" },
];

/* ── Shared glass styles ── */
const glass = {
  background: "rgba(255,255,255,0.05)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
};

const glassSubtle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const Landing = () => {
  const { user } = useAuth();
  const canvasRef = useRef(null);

  /* ── Particle network ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const pts = Array.from({ length: 50 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.2 + 0.3,
      dx: (Math.random() - 0.5) * 0.2,
      dy: (Math.random() - 0.5) * 0.2,
      a: Math.random() * 0.15 + 0.04,
    }));

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      pts.forEach((p) => {
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > w) p.dx *= -1;
        if (p.y < 0 || p.y > h) p.dy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(124,58,237,${p.a})`;
        ctx.fill();
      });
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(124,58,237,${0.035 * (1 - d / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      raf = requestAnimationFrame(draw);
    };
    draw();

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="relative min-h-screen text-[#F9FAFB] overflow-x-hidden" style={{ background: "#0B0F1A" }}>

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes heroFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes badgeFloat1{0%,100%{transform:translateY(0) translateX(0)}50%{transform:translateY(-6px) translateX(2px)}}
        @keyframes badgeFloat2{0%,100%{transform:translateY(0) translateX(0)}50%{transform:translateY(5px) translateX(-3px)}}
        @keyframes scanPulse{0%,100%{opacity:.7}50%{opacity:1}}
        @keyframes blink{0%,50%{opacity:1}51%,100%{opacity:0}}
        .hero-float{animation:heroFloat 6s ease-in-out infinite}
        .badge-1{animation:badgeFloat1 4s ease-in-out infinite}
        .badge-2{animation:badgeFloat2 5s ease-in-out infinite 1s}
        .scan-pulse{animation:scanPulse 2s ease-in-out infinite}
        .cursor-blink{animation:blink 1s step-end infinite}
      `}</style>

      {/* ── Particle canvas ── */}
      <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />

      {/* ── Ambient background glow (only place with color blobs) ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute -top-[20%] -left-[10%] w-[700px] h-[700px] rounded-full"
          style={{ background: "radial-gradient(circle,#7C3AED 0%,transparent 70%)", opacity: 0.18, filter: "blur(120px)" }}
        />
        <div
          className="absolute -bottom-[20%] -right-[10%] w-[700px] h-[700px] rounded-full"
          style={{ background: "radial-gradient(circle,#3B82F6 0%,transparent 70%)", opacity: 0.15, filter: "blur(120px)" }}
        />
      </div>

      {/* ══════════════════ HERO ══════════════════ */}
      <section className="relative z-10 pt-32 pb-20 px-6 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-16">

          {/* ── Left column ── */}
          <div className="flex-1 text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-8" style={glass}>
              <span className="w-2 h-2 rounded-full bg-[#7C3AED]" />
              <span className="text-[10px] font-semibold tracking-[0.2em] text-[#CBD5E1] uppercase">
                Autonomous Security Intelligence
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-6xl xl:text-7xl font-extrabold leading-[1.08] tracking-tight mb-6 text-[#F9FAFB]">
              Your Code Has<br />
              <span className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">
                Hidden Threats.
              </span><br />
              We Find{" "}
              <span className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">
                All of Them.
              </span>
            </h1>

            {/* Sub */}
            <p className="text-base md:text-lg text-[#94A3B8] max-w-xl mb-10 leading-relaxed">
              ZeroTrace deploys an autonomous multi-agent AI that thinks like a
              Senior Security Engineer — discovering, verifying, and patching
              vulnerabilities without human guidance.
            </p>

            {/* CTA */}
            <div className="flex flex-wrap gap-4 mb-12">
              {user ? (
                <Link to="/dashboard"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm tracking-wide text-white transition-all duration-200 hover:brightness-110"
                  style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)" }}>
                  Open Dashboard <ArrowRight size={16} />
                </Link>
              ) : (
                <>
                  <Link to="/signup"
                    className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm tracking-wide text-white transition-all duration-200 hover:brightness-110"
                    style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)" }}>
                    Start Free Scan <ArrowRight size={16} />
                  </Link>
                  <Link to="/login"
                    className="px-8 py-3.5 rounded-xl font-semibold text-sm tracking-wide text-[#CBD5E1] transition-all duration-200 hover:bg-white/[0.06]"
                    style={glass}>
                    Sign In
                  </Link>
                </>
              )}
            </div>

            {/* Micro stats */}
            <div className="flex flex-wrap gap-8">
              {[
                { val: "50K+", lbl: "Scans Completed" },
                { val: "94%", lbl: "Detection Rate" },
                { val: "10+", lbl: "AI Agents" },
              ].map((s, i) => (
                <div key={i} className="flex flex-col gap-0.5">
                  <span className="text-2xl font-extrabold bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">
                    {s.val}
                  </span>
                  <span className="text-[11px] text-[#94A3B8]">{s.lbl}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right column — Hero Dashboard Card ── */}
          <div className="flex-1 w-full max-w-[480px] mx-auto lg:mx-0 relative hero-float">
            <div className="rounded-2xl p-6" style={glass}>

              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[10px] text-[#94A3B8] mb-0.5 font-mono uppercase tracking-widest">ZeroTrace Agent</p>
                  <p className="text-sm font-bold text-[#F9FAFB]">Live Threat Dashboard</p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={glassSubtle}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] scan-pulse" />
                  <span className="text-[11px] font-semibold text-[#CBD5E1]">Live</span>
                </div>
              </div>

              {/* Scan progress */}
              <div className="rounded-xl p-4 mb-4 relative" style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] text-[#94A3B8] mb-1 font-mono uppercase tracking-widest">Scan in Progress</p>
                <p className="flex items-center gap-2 text-lg font-extrabold text-[#F9FAFB] font-mono mb-3">
                  <FileCode size={16} className="text-[#7C3AED]" />
                  src/auth/
                  <ShieldAlert size={16} className="text-red-400" />
                  3 Critical
                </p>
                <div className="h-1.5 rounded-full mb-1.5" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#7C3AED,#3B82F6)", width: "72%" }} />
                </div>
                <p className="text-[10px] text-[#94A3B8] font-mono">72% complete</p>
                <span className="absolute top-3 right-3 px-2.5 py-1 rounded-md text-[10px] font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)" }}>
                  HIGH RISK
                </span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2.5 mb-4">
                {[
                  { val: "3", lbl: "Critical", icon: <ShieldAlert size={14} />, color: "#F87171" },
                  { val: "7", lbl: "Warnings", icon: <ShieldHalf size={14} />, color: "#FBBF24" },
                  { val: "10", lbl: "Agents", icon: <UsersRound size={14} />, color: "#7C3AED" },
                ].map((s, i) => (
                  <div key={i} className="rounded-lg p-3 text-center" style={glassSubtle}>
                    <p className="text-lg font-extrabold flex items-center justify-center gap-1.5" style={{ color: s.color }}>
                      {s.val} {s.icon}
                    </p>
                    <p className="text-[10px] text-[#94A3B8] mt-0.5">{s.lbl}</p>
                  </div>
                ))}
              </div>

              {/* Agent log */}
              <div className="rounded-lg px-4 py-3 font-mono text-xs mb-4" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[#94A3B8]">[00:03]</span>
                  <span className="text-[#F87171] font-semibold flex items-center gap-1"><GitCommitHorizontal size={11} /> ATTACKER</span>
                  <span className="text-[#CBD5E1]">JWT secret hardcoded</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#94A3B8]">[00:05]</span>
                  <span className="text-[#7C3AED] font-semibold flex items-center gap-1"><GitCommitHorizontal size={11} /> PATCHER</span>
                  <span className="text-[#CBD5E1]">Generating fix…<span className="text-[#3B82F6] cursor-blink">_</span></span>
                </div>
              </div>

              {/* Bottom row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg" style={glassSubtle}>
                  <div className="w-7 h-7 rounded-md flex items-center justify-center text-white"
                    style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)" }}>
                    <PackageCheck size={14} />
                  </div>
                  <div>
                    <p className="text-[10px] text-[#94A3B8]">Patch Ready</p>
                    <p className="text-xs font-semibold text-[#F9FAFB]">0 regressions</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-[#94A3B8] mb-0.5">Threat Score</p>
                  <p className="text-2xl font-extrabold bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">
                    8.7 / 10
                  </p>
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -top-3 -left-4 px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 text-[#CBD5E1] badge-1"
              style={glass}>
              <Database size={12} className="text-[#7C3AED]" /> SQL Injection
            </div>
            <div className="absolute -bottom-3 -right-4 px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 text-[#CBD5E1] badge-2"
              style={glass}>
              <Users size={12} className="text-[#3B82F6]" /> 10+ Agents Deployed
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════════ STATS ══════════════════ */}
      <section className="relative z-10 py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl grid grid-cols-2 md:grid-cols-4 overflow-hidden" style={glass}>
            {STATS.map((s, i) => (
              <div key={i}
                className={`py-10 text-center ${i < STATS.length - 1 ? "border-r" : ""}`}
                style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="text-4xl font-extrabold bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent mb-2">
                  {s.value}
                </div>
                <div className="text-[11px] text-[#94A3B8] font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ FEATURES ══════════════════ */}
      <section className="relative z-10 py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4 text-[10px] font-semibold tracking-[0.2em] text-[#CBD5E1] uppercase" style={glass}>
            <Lightbulb size={12} className="text-[#7C3AED]" /> Capabilities
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4 text-[#F9FAFB]">
            Built for the{" "}
            <span className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">Most Complex</span>{" "}
            Threats
          </h2>
          <p className="text-[#94A3B8] max-w-xl mx-auto text-base">
            Traditional SAST tools miss context. ZeroTrace reasons across your entire codebase like a human expert.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <div key={i}
              className="group p-6 rounded-2xl transition-all duration-300 cursor-default hover:bg-white/[0.07]"
              style={glass}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 text-[#7C3AED]" style={glassSubtle}>
                {f.icon}
              </div>
              <h3 className="text-base font-bold text-[#F9FAFB] mb-2.5 group-hover:text-white transition-colors duration-200">
                {f.title}
              </h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════ HOW IT WORKS ══════════════════ */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-5xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4 text-[10px] font-semibold tracking-[0.2em] text-[#CBD5E1] uppercase" style={glass}>
            <Workflow size={12} className="text-[#3B82F6]" /> How It Works
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#F9FAFB]">
            Three Agents.{" "}
            <span className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">One Mission.</span>
          </h2>
        </div>

        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-stretch gap-4">
          {[
            { num: "01", icon: <Search size={24} />, title: "ANALYST Agent", color: "#7C3AED",
              desc: "Reads every file. Builds a semantic map. Identifies suspicious patterns, data flows, and trust boundaries." },
            { num: "02", icon: <Bomb size={24} />, title: "ATTACKER Agent", color: "#3B82F6",
              desc: "Attempts to exploit each flaw. Generates PoC scripts. Rates severity using CVSS scoring." },
            { num: "03", icon: <ShieldPlus size={24} />, title: "PATCHER Agent", color: "#F9FAFB",
              desc: "Writes context-aware fixes. Validates patches. Produces a full audit report." },
          ].map((s, i) => (
            <div key={i} className="flex flex-col md:flex-row items-center gap-4 flex-1">
              <div className="flex-1 w-full p-6 rounded-2xl text-center transition-all duration-300 hover:bg-white/[0.07]" style={glass}>
                <div className="text-[11px] font-mono font-semibold text-[#94A3B8] mb-5 tracking-widest">{s.num}</div>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ ...glassSubtle, color: s.color }}>
                  {s.icon}
                </div>
                <h3 className="font-bold mb-3 tracking-wide text-sm" style={{ color: s.color }}>{s.title}</h3>
                <p className="text-sm text-[#94A3B8] leading-relaxed">{s.desc}</p>
              </div>
              {i < 2 && (
                <div className="text-[#94A3B8]/30 hidden md:block select-none">
                  <ChevronRight size={20} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════ CTA ══════════════════ */}
      <section className="relative z-10 py-32 px-6 text-center">
        <div className="max-w-3xl mx-auto p-10 md:p-14 rounded-3xl" style={glass}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-[10px] font-semibold tracking-[0.2em] text-[#CBD5E1] uppercase"
            style={glassSubtle}>
            <Rocket size={12} className="text-[#7C3AED]" /> Get Started Today
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4 text-[#F9FAFB]">
            Ready to Secure Your<br />
            <span className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">Codebase?</span>
          </h2>
          <p className="text-[#94A3B8] mb-10 text-base max-w-md mx-auto">
            Join ZeroTrace — the autonomous security engineer that never sleeps.
          </p>

          {user ? (
            <Link to="/dashboard"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-semibold text-white text-base tracking-wide transition-all duration-200 hover:brightness-110"
              style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)" }}>
              Go to Dashboard <ArrowRight size={16} />
            </Link>
          ) : (
            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/signup"
                className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-semibold text-white text-base tracking-wide transition-all duration-200 hover:brightness-110"
                style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)" }}>
                Create Free Account <ArrowRight size={16} />
              </Link>
              <Link to="/login"
                className="px-10 py-4 rounded-xl font-semibold text-[#CBD5E1] text-base tracking-wide transition-all duration-200 hover:bg-white/[0.06]"
                style={glass}>
                Sign In
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════ FOOTER ══════════════════ */}
      <footer className="relative z-10 py-8 px-6 flex flex-col md:flex-row items-center justify-between gap-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2.5 font-extrabold text-lg tracking-widest text-[#F9FAFB]">
          <ZeroTraceLogo size={22} />
          <span className="text-lg font-extrabold tracking-widest text-[#F9FAFB]">
          ZERO<span className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">TRACE</span>
        </span>
        </div>
        <p className="text-[11px] text-[#94A3B8]/60">© 2026 ZeroTrace — Autonomous Security Intelligence</p>
      </footer>
    </div>
  );
};

export default Landing;
