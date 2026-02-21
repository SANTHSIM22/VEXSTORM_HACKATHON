import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useRef } from "react";

const FEATURES = [
  { icon: "", title: "Multi-Agent AI", desc: "Autonomous agents collaborate like a real security team — analyst, attacker, patcher — all working in parallel." },
  { icon: "", title: "Context-Aware Scanning", desc: "Goes beyond pattern matching. Understands how a logic flaw in one file can be exploited through another." },
  { icon: "", title: "Auto Patch Generation", desc: "Not just detection — get production-ready fixes with diff previews and rollback support." },
  { icon: "", title: "Full Audit Trail", desc: "Every agent action, tool call, and reasoning step is logged. Full transparency, zero black box." },
  { icon: "", title: "PoC Scripts", desc: "Generates proof-of-concept exploit scripts to verify every vulnerability before reporting." },
  { icon: "", title: "CI/CD Ready", desc: "Drop into any pipeline. GitHub Actions, GitLab CI, Jenkins — native integration out of the box." }
];

const STATS = [
  { value: "10x", label: "Faster than manual review" },
  { value: "94%", label: "Detection accuracy" },
  { value: "0", label: "False positive tolerance" },
  { value: "", label: "Codebases supported" }
];

const Landing = () => {
  const { user } = useAuth();
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.5, dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4, alpha: Math.random() * 0.5 + 0.1
    }));
    let animId;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,255,170,${p.alpha})`; ctx.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0,255,170,${0.06*(1-dist/120)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y); ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    const onResize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", onResize); };
  }, []);

  return (
    <div className="relative min-h-screen bg-[#0d1117] text-white overflow-x-hidden">
      <canvas ref={canvasRef} className="particle-canvas" />

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-40 pb-24 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#00ffaa11] border border-[#00ffaa33] text-[#00ffaa] text-xs font-semibold tracking-widest mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ffaa] animate-pulse" />
          AUTONOMOUS SECURITY INTELLIGENCE
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight mb-6">
          Your Codebase Has<br />
          <span className="gradient-text">Hidden Vulnerabilities.</span><br />
          We Find <span className="gradient-text">All of Them.</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-10 leading-relaxed">
          VexStorm deploys an autonomous multi-agent AI that thinks like a Senior Security Engineer.
          It discovers, verifies, and patches vulnerabilities without human guidance.
        </p>
        <div className="flex flex-wrap gap-4 justify-center mb-16">
          {user ? (
            <Link to="/dashboard" className="px-8 py-3.5 bg-[#00ffaa] text-[#0d1117] font-bold rounded-xl hover:bg-[#00e699] transition-all duration-200 shadow-[0_0_30px_#00ffaa44]">
              Open Dashboard 
            </Link>
          ) : (
            <>
              <Link to="/signup" className="px-8 py-3.5 bg-[#00ffaa] text-[#0d1117] font-bold rounded-xl hover:bg-[#00e699] transition-all duration-200 shadow-[0_0_30px_#00ffaa44]">
                Start Free Scan 
              </Link>
              <Link to="/login" className="px-8 py-3.5 border border-[#1f2937] text-gray-300 font-semibold rounded-xl hover:border-[#00ffaa44] hover:text-white transition-all duration-200">
                Sign In
              </Link>
            </>
          )}
        </div>

        {/* Terminal */}
        <div className="w-full max-w-2xl rounded-xl overflow-hidden border border-[#1f2937] shadow-2xl text-left">
          <div className="flex items-center gap-2 px-4 py-3 bg-[#161b22] border-b border-[#1f2937]">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span className="ml-3 text-xs text-gray-500 font-mono">vexstorm — agent.log</span>
          </div>
          <div className="bg-[#0d1117] p-5 font-mono text-sm space-y-2">
            {[
              { time: "00:01", agent: "ANALYST", color: "text-blue-400", msg: "Scanning src/auth/middleware.js..." },
              { time: "00:03", agent: "ATTACKER", color: "text-orange-400", msg: "JWT secret hardcoded  CVE candidate" },
              { time: "00:05", agent: "ANALYST", color: "text-blue-400", msg: "Cross-referencing with routes/user.js..." },
              { time: "00:08", agent: "ATTACKER", color: "text-red-400", msg: " CRITICAL: Auth bypass via forged token", critical: true },
              { time: "00:10", agent: "PATCHER", color: "text-[#00ffaa]", msg: "Generating PoC + applying fix..." },
              { time: "00:12", agent: "PATCHER", color: "text-[#00ffaa]", msg: " Patch ready. 0 regressions detected", blink: true },
            ].map((l, i) => (
              <div key={i} className={`flex gap-2 ${l.critical ? "bg-red-500/5 border border-red-500/20 rounded px-2 py-0.5" : ""}`}>
                <span className="text-gray-600">[{l.time}]</span>
                <span className={`font-bold ${l.color}`}>[{l.agent}]</span>
                <span className={l.critical ? "text-red-300" : "text-gray-300"}>
                  {l.msg}{l.blink && <span className="cursor text-[#00ffaa]">_</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative z-10 py-16 border-y border-[#1f2937] bg-[#111827]/50">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((s, i) => (
            <div key={i}>
              <div className="text-4xl font-extrabold gradient-text mb-1">{s.value}</div>
              <div className="text-sm text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <div className="text-xs text-[#00ffaa] font-semibold tracking-widest mb-3">CAPABILITIES</div>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4">Built for the Most Complex Threats</h2>
          <p className="text-gray-400 max-w-xl mx-auto">Traditional SAST tools miss context. VexStorm reasons across your entire codebase like a human expert.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <div key={i} className="p-6 rounded-xl bg-[#111827] border border-[#1f2937] hover:border-[#00ffaa44] hover:shadow-[0_0_30px_#00ffaa0a] transition-all duration-300 group">
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-bold mb-2 group-hover:text-[#00ffaa] transition-colors duration-200">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 py-24 px-6 bg-[#111827]/30">
        <div className="max-w-5xl mx-auto text-center mb-14">
          <div className="text-xs text-[#00ffaa] font-semibold tracking-widest mb-3">HOW IT WORKS</div>
          <h2 className="text-4xl md:text-5xl font-extrabold">Three Agents. One Mission.</h2>
        </div>
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-4">
          {[
            { num: "01", icon: "", title: "ANALYST Agent", desc: "Reads every file. Builds a semantic map. Identifies suspicious patterns, data flows, and trust boundaries." },
            { num: "02", icon: "", title: "ATTACKER Agent", desc: "Attempts to exploit each flaw. Generates PoC scripts. Rates severity using CVSS scoring." },
            { num: "03", icon: "", title: "PATCHER Agent", desc: "Writes context-aware fixes. Validates patches. Produces a full audit report." }
          ].map((s, i) => (
            <div key={i} className="flex flex-col md:flex-row items-center gap-4 flex-1">
              <div className="flex-1 p-6 rounded-xl bg-[#111827] border border-[#1f2937] text-center">
                <div className="text-xs text-[#00ffaa44] font-mono font-bold mb-3">{s.num}</div>
                <div className="text-4xl mb-3">{s.icon}</div>
                <h3 className="font-bold mb-2 text-[#00ffaa]">{s.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
              {i < 2 && <div className="text-2xl text-[#1f2937] font-bold hidden md:block"></div>}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-28 px-6 text-center">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-80 h-80 rounded-full bg-[#00ffaa] opacity-5 blur-3xl" />
        </div>
        <h2 className="relative text-4xl md:text-5xl font-extrabold mb-4">Ready to Secure Your Codebase?</h2>
        <p className="relative text-gray-400 mb-10 text-lg">Join VexStorm — the autonomous security engineer that never sleeps.</p>
        {user ? (
          <Link to="/dashboard" className="relative px-10 py-4 bg-[#00ffaa] text-[#0d1117] font-bold rounded-xl hover:bg-[#00e699] transition-all shadow-[0_0_40px_#00ffaa55] text-lg">
            Go to Dashboard 
          </Link>
        ) : (
          <Link to="/signup" className="relative px-10 py-4 bg-[#00ffaa] text-[#0d1117] font-bold rounded-xl hover:bg-[#00e699] transition-all shadow-[0_0_40px_#00ffaa55] text-lg">
            Create Free Account 
          </Link>
        )}
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#1f2937] py-8 px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-bold text-lg tracking-widest">
          <span className="text-[#00ffaa]"></span>
          VEX<span className="text-[#00ffaa]">STORM</span>
        </div>
        <p className="text-sm text-gray-600"> 2026 VexStorm  Built for VEXSTORM Hackathon</p>
      </footer>
    </div>
  );
};

export default Landing;
