import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  ScanSearch, Wrench, FileText, TestTube, GitMerge,
  ArrowRight, Database, Users, Lightbulb, Workflow, Rocket,
  FileCode, ShieldAlert, ShieldHalf, UsersRound, GitCommitHorizontal,
  PackageCheck, Search, Bomb, ShieldPlus, ChevronRight, ShieldCheck,
  Sparkles, Zap, Eye, Monitor, Cpu, Lock, Globe, Server, KeyRound,
  BrainCircuit, CheckCircle2, BarChart3, Terminal, Download, Github
} from "lucide-react";


/* ── Intersection Observer Hook ── */
const useInView = (options = {}) => {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setIsInView(true); obs.unobserve(el); }
    }, { threshold: 0.15, ...options });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, isInView];
};

/* ── Animated Counter ── */
const AnimatedValue = ({ value, inView }) => {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (!inView) return;
    const num = parseInt(value);
    if (isNaN(num)) { setDisplay(value); return; }
    const suffix = value.replace(/[\d.]/g, "");
    let start = 0;
    const duration = 1200;
    const startTime = performance.now();
    const animate = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      start = Math.floor(eased * num);
      setDisplay(`${start}${suffix}`);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [inView, value]);
  return <span>{display}</span>;
};

/* ── Data ── */
const FEATURES = [
  { icon: <ShieldCheck size={20} />, title: "Multi-Agent AI", desc: "Autonomous agents collaborate like a real security team — analyst, attacker, patcher — all working in parallel." },
  { icon: <ScanSearch size={20} />, title: "Context-Aware Scanning", desc: "Goes beyond pattern matching. Understands how a logic flaw in one file can be exploited through another." },
  { icon: <Wrench size={20} />, title: "Auto Patch Generation", desc: "Not just detection — get production-ready fixes with diff previews and rollback support." },
  { icon: <FileText size={20} />, title: "Full Audit Trail", desc: "Every agent action, tool call, and reasoning step is logged. Full transparency, zero black box." },
  { icon: <TestTube size={20} />, title: "PoE Scripts", desc: "Generates proof-of-exploitation scripts. Automated PoE validation for each vulnerability with end-to-end execution." },
  { icon: <GitMerge size={20} />, title: "CI/CD Ready", desc: "Drop into any pipeline. GitHub Actions, GitLab CI, Jenkins — native integration out of the box." },
];

const STATS = [
  { value: "10x", label: "Faster than manual review" },
  { value: "94%", label: "Detection accuracy" },
  { value: "<1%", label: "False positive rate" },
  { value: "8", label: "Languages supported" },
];

/* ── Glass presets ── */
const glass = {
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.07)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
};

const glassHover = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 12px 40px rgba(124,58,237,0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
};

const glassSubtle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.05)",
};

const Landing = () => {
  const { user } = useAuth();
  const canvasRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  /* ── Mouse tracking for spotlight ── */
  const handleMouseMove = useCallback((e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  /* ── Intersection observer refs ── */
  const [heroRef, heroInView] = useInView();
  const [statsRef, statsInView] = useInView();
  const [featRef, featInView] = useInView();
  const [howRef, howInView] = useInView();
  const [extRef, extInView] = useInView();
  const [ctaRef, ctaInView] = useInView();

  /* ── Particle network ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const pts = Array.from({ length: 60 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.5 + 0.3,
      dx: (Math.random() - 0.5) * 0.15,
      dy: (Math.random() - 0.5) * 0.15,
      a: Math.random() * 0.12 + 0.03,
      pulse: Math.random() * Math.PI * 2,
    }));

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      pts.forEach((p) => {
        p.x += p.dx;
        p.y += p.dy;
        p.pulse += 0.01;
        if (p.x < 0 || p.x > w) p.dx *= -1;
        if (p.y < 0 || p.y > h) p.dy *= -1;
        const pulsedAlpha = p.a * (0.7 + 0.3 * Math.sin(p.pulse));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(124,58,237,${pulsedAlpha})`;
        ctx.fill();
      });
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 140) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(124,58,237,${0.03 * (1 - d / 140)})`;
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
    <div className="relative min-h-screen text-[#F9FAFB] overflow-x-hidden" style={{ background: "#060910" }}>

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes heroFloat{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-12px) rotate(0.5deg)}}
        @keyframes badgeFloat1{0%,100%{transform:translateY(0) translateX(0) scale(1)}50%{transform:translateY(-8px) translateX(3px) scale(1.02)}}
        @keyframes badgeFloat2{0%,100%{transform:translateY(0) translateX(0) scale(1)}50%{transform:translateY(6px) translateX(-4px) scale(1.02)}}
        @keyframes scanPulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}
        @keyframes blink{0%,50%{opacity:1}51%,100%{opacity:0}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes scaleIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
        @keyframes slideLeft{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
        @keyframes slideRight{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:translateX(0)}}
        @keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        @keyframes borderGlow{0%,100%{border-color:rgba(124,58,237,0.1)}50%{border-color:rgba(124,58,237,0.3)}}
        @keyframes progressPulse{0%,100%{width:72%}50%{width:74%}}
        @keyframes typewriter{from{width:0}to{width:100%}}
        @keyframes orbFloat{0%{transform:translate(0,0) scale(1)}33%{transform:translate(30px,-20px) scale(1.05)}66%{transform:translate(-20px,15px) scale(0.95)}100%{transform:translate(0,0) scale(1)}}

        .hero-float{animation:heroFloat 7s ease-in-out infinite}
        .badge-1{animation:badgeFloat1 5s ease-in-out infinite}
        .badge-2{animation:badgeFloat2 6s ease-in-out infinite 1.5s}
        .scan-pulse{animation:scanPulse 2s ease-in-out infinite}
        .cursor-blink{animation:blink 1s step-end infinite}
        .shimmer{background:linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent);background-size:200% 100%;animation:shimmer 3s ease-in-out infinite}
        .gradient-shift{background-size:200% 200%;animation:gradientShift 4s ease infinite}
        .border-glow{animation:borderGlow 3s ease-in-out infinite}
        .progress-pulse{animation:progressPulse 2s ease-in-out infinite}
        .orb-1{animation:orbFloat 12s ease-in-out infinite}
        .orb-2{animation:orbFloat 15s ease-in-out infinite 3s}
        .orb-3{animation:orbFloat 18s ease-in-out infinite 6s}

        @keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .marquee-track{
          display:flex;
          width:max-content;
          padding:20px;
          animation:marquee 32s linear infinite;
 
        }
        .marquee-track:hover{animation-play-state:paused}
        .marquee-wrap{overflow:hidden;-webkit-mask:linear-gradient(90deg,transparent,black 8%,black 92%,transparent);mask:linear-gradient(90deg,transparent,black 8%,black 92%,transparent);}

        @keyframes meshPulse{0%,100%{transform:scale(1);opacity:0.6}50%{transform:scale(1.15);opacity:1}}
        @keyframes dataFlow{0%{stroke-dashoffset:100}100%{stroke-dashoffset:0}}
        @keyframes nodeGlow{0%,100%{filter:drop-shadow(0 0 8px var(--glow-color))}50%{filter:drop-shadow(0 0 20px var(--glow-color))}}
        @keyframes orbitPulse{0%,100%{opacity:0.3;transform:scale(0.95)}50%{opacity:0.7;transform:scale(1.05)}}
        @keyframes nodePulse{0%,100%{box-shadow:0 0 20px var(--node-color),0 0 40px var(--node-color)}50%{box-shadow:0 0 30px var(--node-color),0 0 60px var(--node-color)}}
        .mesh-node{animation:meshPulse 3s ease-in-out infinite}
        .mesh-line{stroke-dasharray:8 4;animation:dataFlow 2s linear infinite}
        .orbit-ring{animation:orbitPulse 4s ease-in-out infinite}
        
        .agent-node{
          position:relative;
          cursor:pointer;
          transition:all 0.4s cubic-bezier(0.16,1,0.3,1);
        }
        .agent-node:hover{transform:scale(1.18)}
        .agent-node:hover .node-tooltip{opacity:1;visibility:visible;transform:translateX(-50%) translateY(0)}
        .agent-node:hover .node-ring{transform:scale(1.5);opacity:1}
        .agent-node:hover .node-core{animation:nodePulse 0.8s ease-in-out infinite;filter:drop-shadow(0 0 30px var(--node-color))}
        .node-tooltip{
          position:absolute;
          bottom:calc(100% + 20px);
          left:50%;
          transform:translateX(-50%) translateY(10px);
          width:280px;
          padding:20px;
          border-radius:16px;
          opacity:0;
          visibility:hidden;
          transition:all 0.4s cubic-bezier(0.16,1,0.3,1);
          z-index:50;
          pointer-events:none;
        }
        .node-tooltip-bottom{
          bottom:auto !important;
          top:calc(100% + 20px);
          transform:translateX(-50%) translateY(-10px);
        }
        .agent-node:hover .node-tooltip-bottom{
          transform:translateX(-50%) translateY(0);
        }
        .node-ring{transition:all 0.4s cubic-bezier(0.16,1,0.3,1);opacity:0.5}

        .fade-up{opacity:0;transform:translateY(30px);transition:all 0.8s cubic-bezier(0.16,1,0.3,1)}
        .fade-up.visible{opacity:1;transform:translateY(0)}
        .fade-in{opacity:0;transition:all 0.6s ease}
        .fade-in.visible{opacity:1}
        .scale-in{opacity:0;transform:scale(0.95);transition:all 0.7s cubic-bezier(0.16,1,0.3,1)}
        .scale-in.visible{opacity:1;transform:scale(1)}
        .slide-left{opacity:0;transform:translateX(40px);transition:all 0.8s cubic-bezier(0.16,1,0.3,1)}
        .slide-left.visible{opacity:1;transform:translateX(0)}
        .slide-right{opacity:0;transform:translateX(-40px);transition:all 0.8s cubic-bezier(0.16,1,0.3,1)}
        .slide-right.visible{opacity:1;transform:translateX(0)}

        .glass-card{
          background:rgba(255,255,255,0.03);
          backdrop-filter:blur(20px);
          -webkit-backdrop-filter:blur(20px);
          border:1px solid rgba(255,255,255,0.06);
          box-shadow:0 8px 32px rgba(0,0,0,0.25),inset 0 1px 0 rgba(255,255,255,0.04);
          transition:background 0.35s ease,border-color 0.35s ease,box-shadow 0.35s ease,transform 0.35s cubic-bezier(0.16,1,0.3,1),opacity 0.8s cubic-bezier(0.16,1,0.3,1),translateY 0.8s cubic-bezier(0.16,1,0.3,1);
        }
        .glass-card:hover{
          background:rgba(255,255,255,0.06);
          border-color:rgba(124,58,237,0.2);
          box-shadow:0 16px 48px rgba(124,58,237,0.12),inset 0 1px 0 rgba(255,255,255,0.08);
          transform:translateY(-4px);
          transition-delay:0s !important;
        }
        .glass-card:hover .card-icon{
          background:rgba(124,58,237,0.15);
          border-color:rgba(124,58,237,0.3);
          transform:scale(1.1) rotate(-5deg);
        }
        .glass-card:hover .card-title{
          color:#fff;
        }
        .glass-card:hover .card-arrow{
          opacity:1;transform:translateX(0);
        }

        .cta-btn{
          position:relative;
          overflow:hidden;
          transition:all 0.3s cubic-bezier(0.16,1,0.3,1);
        }
        .cta-btn::before{
          content:'';
          position:absolute;
          inset:0;
          background:linear-gradient(135deg,rgba(255,255,255,0.15),transparent);
          opacity:0;
          transition:opacity 0.3s;
        }
        .cta-btn:hover::before{opacity:1}
        .cta-btn:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(124,58,237,0.4)}
        .cta-btn:active{transform:translateY(0);box-shadow:0 4px 15px rgba(124,58,237,0.3)}

        .cta-secondary{
          transition:all 0.3s cubic-bezier(0.16,1,0.3,1);
        }
        .cta-secondary:hover{
          background:rgba(255,255,255,0.08) !important;
          border-color:rgba(255,255,255,0.15) !important;
          transform:translateY(-2px);
        }

        .step-card{
          transition:all 0.4s cubic-bezier(0.16,1,0.3,1);
        }
        .step-card:hover{
          background:rgba(255,255,255,0.06);
          border-color:rgba(124,58,237,0.2);
          transform:translateY(-6px);
        }
        .step-card:hover .step-icon{
          transform:scale(1.1);
          box-shadow:0 0 30px rgba(124,58,237,0.2);
        }
        .step-card:hover .step-num{
          color:#7C3AED;
        }

        .stat-cell{
          position:relative;
          transition:all 0.3s ease;
        }
        .stat-cell:hover{
          background:rgba(255,255,255,0.03);
        }
        .stat-cell::after{
          content:'';
          position:absolute;
          bottom:0;
          left:50%;
          transform:translateX(-50%) scaleX(0);
          width:40px;
          height:2px;
          background:linear-gradient(90deg,#7C3AED,#3B82F6);
          border-radius:1px;
          transition:transform 0.3s ease;
        }
        .stat-cell:hover::after{
          transform:translateX(-50%) scaleX(1);
        }

        .nav-glass{
          background:rgba(6,9,16,0.7);
          backdrop-filter:blur(20px);
          -webkit-backdrop-filter:blur(20px);
          border-bottom:1px solid rgba(255,255,255,0.05);
        }

        .glow-line{
          height:1px;
          background:linear-gradient(90deg,transparent,rgba(124,58,237,0.3),rgba(59,130,246,0.3),transparent);
        }
      `}</style>

      {/* ── Particle canvas ── */}
      <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />

      {/* ── Mouse spotlight ── */}
      <div
        className="fixed inset-0 pointer-events-none z-[1] transition-opacity duration-300"
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(124,58,237,0.04), transparent 60%)`,
        }}
      />

      {/* ── Ambient orbs ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute -top-[25%] -left-[15%] w-[800px] h-[800px] rounded-full orb-1"
          style={{ background: "radial-gradient(circle,rgba(124,58,237,0.12) 0%,transparent 65%)", filter: "blur(80px)" }}
        />
        <div
          className="absolute top-[40%] -right-[20%] w-[600px] h-[600px] rounded-full orb-2"
          style={{ background: "radial-gradient(circle,rgba(59,130,246,0.08) 0%,transparent 65%)", filter: "blur(80px)" }}
        />
        <div
          className="absolute -bottom-[25%] left-[30%] w-[700px] h-[700px] rounded-full orb-3"
          style={{ background: "radial-gradient(circle,rgba(124,58,237,0.06) 0%,transparent 65%)", filter: "blur(80px)" }}
        />
      </div>

      {/* ── Floating Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 nav-glass">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12">
              <img src="/logo.png" width={36} height={36} alt="Zero Trace" className="object-contain" />
            </div>
            <span className="brand-name text-sm text-[#F9FAFB]">
              ZERO<span className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">TRACE</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Link to="/dashboard"
                className="cta-btn inline-flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm text-white"
                style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)" }}>
                Dashboard <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link to="/login"
                  className="px-5 py-2 rounded-lg font-medium text-sm text-[#CBD5E1] transition-all duration-300 hover:text-white hover:bg-white/[0.05]">
                  Sign In
                </Link>
                <Link to="/signup"
                  className="cta-btn inline-flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm text-white"
                  style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)" }}>
                  Get Started <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ══════════════════ HERO ══════════════════ */}
      <section ref={heroRef} className="relative z-10 pt-36 pb-24 px-6 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-20">

          {/* ── Left column ── */}
          <div className={`flex-1 text-left fade-up ${heroInView ? "visible" : ""}`}>
            {/* Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-8 border-glow" style={glass}>
              <Sparkles size={12} className="text-[#7C3AED]" />
              <span className="text-[10px] font-semibold tracking-[0.2em] text-[#CBD5E1] uppercase">
                Autonomous Security Intelligence
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-6xl xl:text-7xl font-extrabold leading-[1.06] tracking-tight mb-7 text-[#F9FAFB]">
              Your Code Has<br />
              <span className="bg-gradient-to-r from-[#7C3AED] via-[#6366F1] to-[#3B82F6] bg-clip-text text-transparent gradient-shift">
                Hidden Threats.
              </span><br />
              We Find{" "}
              <span className="bg-gradient-to-r from-[#7C3AED] via-[#6366F1] to-[#3B82F6] bg-clip-text text-transparent gradient-shift">
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
            <div className="flex flex-wrap gap-4 mb-14">
              {user ? (
                <Link to="/dashboard"
                  className="cta-btn inline-flex items-center gap-2.5 px-9 py-4 rounded-xl font-semibold text-sm tracking-wide text-white"
                  style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)" }}>
                  Open Dashboard <ArrowRight size={16} />
                </Link>
              ) : (
                <>
                  <Link to="/signup"
                    className="cta-btn inline-flex items-center gap-2.5 px-9 py-4 rounded-xl font-semibold text-sm tracking-wide text-white"
                    style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)" }}>
                    Start Free Scan <ArrowRight size={16} />
                  </Link>
                  <Link to="/login"
                    className="cta-secondary px-9 py-4 rounded-xl font-semibold text-sm tracking-wide text-[#CBD5E1]"
                    style={glass}>
                    Sign In
                  </Link>
                </>
              )}
            </div>

            {/* Micro stats */}
            <div className="flex flex-wrap gap-10">
              {[
                { val: "50K+", lbl: "Scans Completed" },
                { val: "94%", lbl: "Detection Rate" },
                { val: "10+", lbl: "AI Agents" },
              ].map((s, i) => (
                <div key={i} className="flex flex-col gap-1 group cursor-default">
                  <span className="text-2xl font-extrabold bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent transition-transform duration-300 group-hover:scale-110 inline-block origin-left">
                    {s.val}
                  </span>
                  <span className="text-[11px] text-[#64748B] group-hover:text-[#94A3B8] transition-colors duration-300">{s.lbl}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right column — Hero Dashboard Card ── */}
          <div className={`flex-1 w-full max-w-[500px] mx-auto lg:mx-0 relative hero-float slide-left ${heroInView ? "visible" : ""}`}
            style={{ transitionDelay: "0.3s" }}>
            <div className="rounded-2xl p-6 border-glow" style={{
              ...glass,
              boxShadow: "0 20px 60px rgba(0,0,0,0.4), 0 0 80px rgba(124,58,237,0.06), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}>

              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-[10px] text-[#64748B] mb-1 font-mono uppercase tracking-widest">ZeroTrace Agent</p>
                  <p className="text-sm font-bold text-[#F9FAFB]">Live Threat Dashboard</p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={glassSubtle}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 scan-pulse" />
                  <span className="text-[11px] font-semibold text-[#CBD5E1]">Live</span>
                </div>
              </div>

              {/* Scan progress */}
              <div className="rounded-xl p-4 mb-4 relative overflow-hidden"
                style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.05)" }}>
                {/* Shimmer overlay */}
                <div className="absolute inset-0 shimmer" />
                <p className="text-[10px] text-[#64748B] mb-1.5 font-mono uppercase tracking-widest relative z-10">Scan in Progress</p>
                <p className="flex items-center gap-2 text-base font-extrabold text-[#F9FAFB] font-mono mb-3 relative z-10">
                  <FileCode size={15} className="text-[#7C3AED]" />
                  src/auth/
                  <span className="flex items-center gap-1 text-red-400 text-sm">
                    <ShieldAlert size={14} /> 3 Critical
                  </span>
                </p>
                <div className="h-1.5 rounded-full mb-2 relative z-10" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full progress-pulse relative overflow-hidden"
                    style={{ background: "linear-gradient(90deg,#7C3AED,#3B82F6)", width: "72%" }}>
                    <div className="absolute inset-0 shimmer" style={{
                      background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                      backgroundSize: "200% 100%",
                    }} />
                  </div>
                </div>
                <p className="text-[10px] text-[#64748B] font-mono relative z-10">72% complete</p>
                <span className="absolute top-3 right-3 px-2.5 py-1 rounded-md text-[10px] font-bold text-white z-10"
                  style={{ background: "linear-gradient(135deg,#EF4444,#DC2626)" }}>
                  HIGH RISK
                </span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2.5 mb-4">
                {[
                  { val: "3", lbl: "Critical", icon: <ShieldAlert size={13} />, color: "#F87171" },
                  { val: "7", lbl: "Warnings", icon: <ShieldHalf size={13} />, color: "#FBBF24" },
                  { val: "10", lbl: "Agents", icon: <UsersRound size={13} />, color: "#7C3AED" },
                ].map((s, i) => (
                  <div key={i} className="rounded-lg p-3 text-center transition-all duration-300 hover:bg-white/[0.04] cursor-default"
                    style={glassSubtle}>
                    <p className="text-lg font-extrabold flex items-center justify-center gap-1.5 transition-transform duration-300 hover:scale-110"
                      style={{ color: s.color }}>
                      {s.val} {s.icon}
                    </p>
                    <p className="text-[10px] text-[#64748B] mt-0.5">{s.lbl}</p>
                  </div>
                ))}
              </div>

              {/* Agent log */}
              <div className="rounded-xl px-4 py-3.5 font-mono text-xs mb-4"
                style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.03)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#4B5563]">[00:03]</span>
                  <span className="text-[#F87171] font-semibold flex items-center gap-1"><GitCommitHorizontal size={10} /> ATTACKER</span>
                  <span className="text-[#94A3B8]">JWT secret hardcoded</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#4B5563]">[00:05]</span>
                  <span className="text-[#7C3AED] font-semibold flex items-center gap-1"><GitCommitHorizontal size={10} /> PATCHER</span>
                  <span className="text-[#94A3B8]">Generating fix…<span className="text-[#3B82F6] cursor-blink">▊</span></span>
                </div>
              </div>

              {/* Separator */}
              <div className="glow-line mb-4" />

              {/* Bottom row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-300 hover:bg-white/[0.04]"
                  style={glassSubtle}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                    style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)" }}>
                    <PackageCheck size={14} />
                  </div>
                  <div>
                    <p className="text-[10px] text-[#64748B]">Patch Ready</p>
                    <p className="text-xs font-semibold text-[#F9FAFB]">0 regressions</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-[#64748B] mb-1">Threat Score</p>
                  <p className="text-2xl font-extrabold bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">
                    6.7<span className="text-sm text-[#64748B] ml-0.5">/ 10</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -top-4 -left-5 px-3.5 py-2 rounded-full text-[11px] font-semibold flex items-center gap-1.5 text-[#CBD5E1] badge-1"
              style={{
                ...glass,
                boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(124,58,237,0.1)",
              }}>
              <Database size={12} className="text-[#F87171]" /> SQL Injection
            </div>
            <div className="absolute -bottom-4 -right-5 px-3.5 py-2 rounded-full text-[11px] font-semibold flex items-center gap-1.5 text-[#CBD5E1] badge-2"
              style={{
                ...glass,
                boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(59,130,246,0.1)",
              }}>
              <Users size={12} className="text-[#3B82F6]" /> 10+ Agents Active
            </div>
          </div>

        </div>
      </section>

      {/* ── Glow divider ── */}
      <div className="relative z-10 max-w-4xl mx-auto px-6">
        <div className="glow-line" />
      </div>

      {/* ══════════════════ STATS ══════════════════ */}
      <section ref={statsRef} className={`relative z-10 py-20 px-6 scale-in ${statsInView ? "visible" : ""}`}>
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl grid grid-cols-2 md:grid-cols-4 overflow-hidden" style={{
            ...glass,
            boxShadow: "0 16px 48px rgba(0,0,0,0.3), 0 0 60px rgba(124,58,237,0.04)",
          }}>
            {STATS.map((s, i) => (
              <div key={i}
                className={`py-12 text-center stat-cell ${i < STATS.length - 1 ? "border-r" : ""}`}
                style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <div className="text-4xl font-extrabold bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent mb-2">
                  <AnimatedValue value={s.value} inView={statsInView} />
                </div>
                <div className="text-[11px] text-[#64748B] font-medium tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ FEATURES ══════════════════ */}
      <section ref={featRef} className="relative z-10 py-28">
        <div className={`text-center  mx-12 px-6 fade-up ${featInView ? "visible" : ""}`}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5 text-[10px] font-semibold tracking-[0.2em] text-[#CBD5E1] uppercase" style={glass}>
            <Lightbulb size={12} className="text-[#7C3AED]" /> Capabilities
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-5 text-[#F9FAFB] leading-tight">
            Built for the{" "}
            <span className="bg-gradient-to-r from-[#7C3AED] via-[#6366F1] to-[#3B82F6] bg-clip-text text-transparent">Most Complex</span>{" "}
            Threats
          </h2>
          <p className="text-[#94A3B8] max-w-lg mx-auto text-base leading-relaxed">
            Traditional SAST tools miss context. ZeroTrace reasons across your entire codebase like a human expert.
          </p>
        </div>

        {/* Infinite marquee */}
        <div className="marquee-wrap">
          <div className="marquee-track">
            {[...FEATURES, ...FEATURES].map((f, i) => (
              <div
                key={i}
                className="glass-card flex-shrink-0 w-72 mx-3 rounded-2xl overflow-hidden cursor-default transition-all duration-300"
                style={{ border: "1px solid rgba(255,255,255,0.07)" }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 0 20px rgba(124,58,237,0.25), 0 8px 32px rgba(0,0,0,0.2)"}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
              >
                {/* Icon banner */}
                <div
                  className="h-36 flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg,rgba(124,58,237,0.15),rgba(59,130,246,0.1))",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-[#7C3AED]"
                    style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)" }}
                  >
                    {f.icon && <span style={{ transform: "scale(1.6)" }}>{f.icon}</span>}
                  </div>
                </div>
                {/* Text */}
                <div className="p-5">
                  <h3 className="text-[14px] font-bold text-[#F9FAFB] mb-2">{f.title}</h3>
                  <p className="text-xs text-[#94A3B8] leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Glow divider ── */}
      <div className="relative z-10 max-w-4xl mx-auto px-6">
        <div className="glow-line" />
      </div>

      {/* ══════════════════ HOW IT WORKS ══════════════════ */}
      <section ref={howRef} className="relative z-10 py-28 px-6 ">
        <div className={`max-w-6xl mx-auto text-center mb-16 fade-up ${howInView ? "visible" : ""}`}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5 text-[10px] font-semibold tracking-[0.2em] text-[#CBD5E1] uppercase" style={glass}>
            <Workflow size={12} className="text-[#3B82F6]" /> How It Works
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#F9FAFB] leading-tight">
            10 Agents.{" "}
            <span className="bg-gradient-to-r from-[#7C3AED] via-[#6366F1] to-[#3B82F6] bg-clip-text text-transparent">One Misson.</span>
          </h2>
          <p className="text-[#94A3B8] max-w-lg mx-auto text-base leading-relaxed mt-4">
            Hover over each node to discover what every agent does in the security pipeline.
          </p>
        </div>

        {/* Network Mesh — 10 agents around central orchestrator */}
        {(() => {
          const AGENTS = [
            { icon: <FileCode size={18} />,    title: "FILE SCAN",    color: "#7C3AED", desc: "Discovers & indexes all relevant source files in the workspace for the pipeline." },
            { icon: <Search size={18} />,       title: "PATTERN",      color: "#6366F1", desc: "Regex-based detection of hardcoded secrets, unsafe functions, SQLi, XSS & CMDi." },
            { icon: <Lock size={18} />,          title: "AUTH",         color: "#3B82F6", desc: "JWT misuse, missing auth guards, session management flaws & RBAC bypass detection." },
            { icon: <ShieldAlert size={18} />,   title: "BIZ LOGIC",   color: "#8B5CF6", desc: "IDOR, privilege escalation, mass assignment & insecure direct object references." },
            { icon: <Globe size={18} />,         title: "API SEC",     color: "#0EA5E9", desc: "Unprotected endpoints, GraphQL introspection & broken object-level authorization." },
            { icon: <Monitor size={18} />,      title: "FRONTEND",    color: "#06B6D4", desc: "Missing CSP headers, unsafe HTML sinks, open redirects & client-side XSS vectors." },
            { icon: <Server size={18} />,        title: "INFRA",       color: "#10B981", desc: "Exposed env files, insecure Docker & CI configs, missing .gitignore rules." },
            { icon: <KeyRound size={18} />,      title: "CRYPTO",      color: "#F59E0B", desc: "Weak algorithms (MD5, SHA1), missing audit trails & sensitive data in logs." },
            { icon: <BrainCircuit size={18} />,  title: "AI DEEP",     color: "#EC4899", desc: "Mistral-powered contextual reasoning for complex & chained vulnerabilities." },
            { icon: <CheckCircle2 size={18} />,  title: "VERIFY",      color: "#14B8A6", desc: "Deduplication, false-positive filtering & final severity scoring." },
          ];

          // Hand-placed positions for a natural scattered graph layout
          // Orchestrator at center, agents spread across the full span
          const cx = 48;
          const cy = 45;

          // Manually positioned to fill the space like a network graph
          const positions = [
            { x: 8,  y: 22 },  // FILE SCAN — top-left
            { x: 88, y: 18 },  // PATTERN — top-right
            { x: 25, y: 48 },  // AUTH — mid-left
            { x: 82, y: 72 },  // BIZ LOGIC — bottom-right
            { x: 62, y: 22 },  // API SEC — top-center-right
            { x: 32, y: 76 },  // FRONTEND — bottom-left
            { x: 90, y: 45 },  // INFRA — mid-right
            { x: 55, y: 67 },  // CRYPTO — center-bottom
            { x: 28, y: 13 },  // AI DEEP — upper-left area
            { x: 68, y: 48 },  // VERIFY — right
          ];

          return (
            <div className="max-w-6xl mx-auto relative " style={{ height: "550px" }}>
              {/* SVG connection lines from each agent to center */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <defs>
                  <filter id="meshGlow">
                    <feGaussianBlur stdDeviation="0.3" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {/* Lines from each agent to center */}
                {positions.map((pos, i) => (
                  <line
                    key={`line-${i}`}
                    className="mesh-line"
                    x1={pos.x}
                    y1={pos.y}
                    x2={cx}
                    y2={cy}
                    stroke={AGENTS[i].color}
                    strokeWidth="0.15"
                    strokeOpacity="0.5"
                    filter="url(#meshGlow)"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
                {/* Cross-connections between nearby agents for mesh look */}
                {positions.map((pos, i) =>
                  positions.map((other, j) => {
                    if (j <= i) return null;
                    const dx = pos.x - other.x;
                    const dy = pos.y - other.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 45) return null; // only connect nearby nodes
                    return (
                      <line
                        key={`mesh-${i}-${j}`}
                        x1={pos.x}
                        y1={pos.y}
                        x2={other.x}
                        y2={other.y}
                        stroke={AGENTS[i].color}
                        strokeWidth="0.1"
                        strokeOpacity={0.15 + (1 - dist / 45) * 0.15}
                      />
                    );
                  })
                )}
                {/* Data particles flowing to center */}
                {positions.map((pos, i) => (
                  <circle key={`p-${i}`} r="0.5" fill={AGENTS[i].color} filter="url(#meshGlow)">
                    <animateMotion
                      dur={`${2 + (i % 3)}s`}
                      repeatCount="indefinite"
                      path={`M ${pos.x} ${pos.y} L ${cx} ${cy}`}
                      begin={`${i * 0.3}s`}
                    />
                  </circle>
                ))}
              </svg>

              {/* Central Orchestrator Node */}
              <div
                className="absolute z-20"
                style={{
                  left: `${cx}%`,
                  top: `${cy}%`,
                  marginLeft: "-48px",
                  marginTop: "-48px",
                }}
              >
                <div className={`agent-node fade-up ${howInView ? "visible" : ""}`}
                  style={{ "--node-color": "rgba(99,102,241,0.4)" }}>
                  {/* Tooltip */}
                  <div
                    className="node-tooltip"
                    style={{
                      background: "rgba(11,15,26,0.95)",
                      backdropFilter: "blur(20px)",
                      border: "1px solid rgba(99,102,241,0.4)",
                      boxShadow: "0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(99,102,241,0.2)",
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "rgba(99,102,241,0.2)", color: "#6366F1" }}>
                        <Cpu size={20} />
                      </div>
                      <h4 className="font-bold text-sm tracking-wide text-[#6366F1]">ORCHESTRATOR</h4>
                    </div>
                    <p className="text-[13px] text-[#94A3B8] leading-relaxed">
                      Powered by LangGraph — coordinates all 10 agents, manages the execution pipeline, aggregates results, and produces the final security report.
                    </p>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45"
                      style={{ background: "rgba(11,15,26,0.95)", borderRight: "1px solid rgba(99,102,241,0.4)", borderBottom: "1px solid rgba(99,102,241,0.4)" }} />
                  </div>
                  {/* Ring */}
                  <div className="node-ring absolute rounded-full orbit-ring"
                    style={{
                      width: "120px", height: "120px",
                      left: "50%", top: "50%", transform: "translate(-50%, -50%)",
                      border: "1px solid rgba(99,102,241,0.3)",
                      background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)",
                    }} />
                  {/* Core */}
                  <div className="node-core relative w-24 h-24 rounded-full flex flex-col items-center justify-center"
                    style={{
                      background: "rgba(22,27,49,0.95)",
                      backdropFilter: "blur(50px)",
                      border: "2px solid #6366F1",
                      boxShadow: "0 0 30px rgba(99,102,241,0.4), 0 0 60px rgba(99,102,241,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
                      "--node-color": "rgba(99,102,241,0.4)",
                    }}>
                    <Cpu size={22} className="text-[#6366F1]" />
                    <span className="text-[8px] font-bold mt-1 tracking-wider text-[#6366F1]">ORCHESTRATOR</span>
                  </div>
                </div>
              </div>

              {/* 10 Agent Nodes around the circle */}
              {AGENTS.map((agent, i) => {
                const pos = positions[i];
                const isBottom = pos.y > cy;
                // Smaller nodes
                const nodeSize = 70;
                const halfNode = nodeSize / 2;
                return (
                  <div
                    key={i}
                    className="absolute z-10"
                    style={{
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      marginLeft: `-${halfNode}px`,
                      marginTop: `-${halfNode}px`,
                    }}
                  >
                    <div
                      className={`agent-node fade-up ${howInView ? "visible" : ""}`}
                      style={{
                        transitionDelay: `${i * 0.08 + 0.2}s`,
                        "--node-color": `${agent.color}40`,
                      }}
                    >
                      {/* Tooltip */}
                      <div
                        className={`node-tooltip${isBottom ? " node-tooltip-bottom" : ""}`}
                        style={{
                          background: "rgba(11,15,26,0.95)",
                          backdropFilter: "blur(20px)",
                          border: `1px solid ${agent.color}40`,
                          boxShadow: `0 20px 50px rgba(0,0,0,0.5), 0 0 30px ${agent.color}20`,
                          width: "240px",
                        }}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `${agent.color}20`, color: agent.color }}>
                            {agent.icon}
                          </div>
                          <h4 className="font-bold text-xs tracking-wide" style={{ color: agent.color }}>
                            {agent.title}
                          </h4>
                        </div>
                        <p className="text-[12px] text-[#94A3B8] leading-relaxed">{agent.desc}</p>
                        {isBottom ? (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45"
                            style={{ background: "rgba(11,15,26,0.95)", borderLeft: `1px solid ${agent.color}40`, borderTop: `1px solid ${agent.color}40` }} />
                        ) : (
                          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45"
                            style={{ background: "rgba(11,15,26,0.95)", borderRight: `1px solid ${agent.color}40`, borderBottom: `1px solid ${agent.color}40` }} />
                        )}
                      </div>

                      {/* Ring */}
                      <div className="node-ring absolute rounded-full"
                        style={{
                          width: `${nodeSize + 16}px`, height: `${nodeSize + 16}px`,
                          left: "50%", top: "50%", transform: "translate(-50%, -50%)",
                          border: `1px solid ${agent.color}25`,
                          background: `radial-gradient(circle, ${agent.color}06 0%, transparent 70%)`,
                        }} />

                      {/* Core */}
                      <div
                        className="node-core relative rounded-full flex flex-col items-center justify-center"
                        style={{
                          width: `${nodeSize}px`, height: `${nodeSize}px`,
                          background: "rgba(22,27,49,0.9)",
                          backdropFilter: "blur(50px)",
                          border: `2px solid ${agent.color}`,
                          boxShadow: `0 0 15px ${agent.color}30, 0 0 30px ${agent.color}10, inset 0 1px 0 rgba(255,255,255,0.05)`,
                          "--node-color": `${agent.color}40`,
                        }}
                      >
                        <div style={{ color: agent.color }}>{agent.icon}</div>
                        <span className="text-[7px] font-bold mt-1 tracking-wider" style={{ color: agent.color }}>
                          {agent.title}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

          
            </div>
          );
        })()}
      </section>

      {/* ══════════════════ VS CODE EXTENSION ══════════════════ */}
      <section ref={extRef} className="relative z-10 pt -10 pb-28 px-6">
        <div className={`max-w-6xl mx-auto fade-up ${extInView ? "visible" : ""}`}>
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5 text-[10px] font-semibold tracking-[0.2em] text-[#CBD5E1] uppercase" style={glass}>
              <Monitor size={12} className="text-[#7C3AED]" /> VS Code Extension
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#F9FAFB] leading-tight mb-5">
              Security Scanning{" "}
              <span className="bg-gradient-to-r from-[#7C3AED] via-[#6366F1] to-[#3B82F6] bg-clip-text text-transparent">Inside Your Editor</span>
            </h2>
            <p className="text-[#94A3B8] max-w-2xl mx-auto text-base leading-relaxed">
              ZeroTrace deploys 10 specialized AI agents directly in VS Code — powered by Mistral AI and LangGraph.Scan your entire codebase in seconds. Get AI-powered insights with proof-of-exploitation payloads and remediation code.</p>
          </div>

          {/* Interactive Report Features as Separate Cards */}
          <div className="mb-16">
            <h3 className="text-lg font-bold text-[#F9FAFB] mb-8 flex items-center gap-2">
              <BarChart3 size={18} className="text-[#3B82F6]" /> Interactive Report Features
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: "Risk Dashboard", desc: "Risk score dashboard with CRITICAL / HIGH / MEDIUM / LOW breakdown" },
                { title: "Findings Table", desc: "Filterable findings table with expandable rows" },
                { title: "Exploitation PoC", desc: "Proof-of-exploitation payloads & remediation code examples" },
                { title: "OWASP Mapping", desc: "OWASP Top 10 mapping & CWE classification" },
                { title: "Attack Chains", desc: "Attack chain explorer for chained vulnerabilities" },
                { title: "Pipeline Logs", desc: "Full agent pipeline execution log" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-6 transition-all duration-300 hover:scale-105"
                  style={{ 
                    ...glass,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                    border: "1px solid rgba(99,102,241,0.3)"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 0 25px rgba(99,102,241,0.3), 0 8px 24px rgba(0,0,0,0.15)"}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.2)"}
                >
                  <div className="flex items-start gap-4">
                    <div className="shrink-0">
                      <CheckCircle2 size={24} className="text-[#10B981]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#F9FAFB] mb-2">{item.title}</h4>
                      <p className="text-sm text-[#CBD5E1] leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Button */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
            <a
              href="https://marketplace.visualstudio.com/items?itemName=santhsim.zerotrace"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center gap-2 group"
              style={{
                background: "linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)",
                color: "#F9FAFB",
                boxShadow: "0 8px 24px rgba(124,58,237,0.4)",
              }}
            >
              <Download size={16} />
              Get ZeroTrace on VS Code Marketplace
            </a>
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="px-7 py-3 rounded-xl font-semibold text-sm transition-all duration-300 border"
              style={{
                borderColor: "rgba(124,58,237,0.4)",
                color: "#CBD5E1",
                background: "rgba(124,58,237,0.05)",
              }}
            >
              <Github size={16} className="inline mr-2" />
              View on GitHub
            </a>
          </div>

        </div>
      </section>

      {/* ── Glow divider ── */}
      <div className="relative z-10 max-w-4xl mx-auto px-6">
        <div className="glow-line" />
      </div>

      {/* ══════════════════ CTA ══════════════════ */}
      <section ref={ctaRef} className={`relative z-10 py-36 px-6 text-center overflow-hidden scale-in ${ctaInView ? "visible" : ""}`}>
        {/* Full-section grid background */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `linear-gradient(rgba(124,58,237,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.12) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />
        {/* Center glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(124,58,237,0.08) 0%, transparent 70%)",
        }} />

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-7 text-[10px] font-semibold tracking-[0.2em] text-[#CBD5E1] uppercase"
            style={glassSubtle}>
            <Rocket size={12} className="text-[#7C3AED]" /> Get Started Today
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-5 text-[#F9FAFB] leading-tight">
            Ready to Secure Your<br />
            <span className="bg-gradient-to-r from-[#7C3AED] via-[#6366F1] to-[#3B82F6] bg-clip-text text-transparent">Codebase?</span>
          </h2>
          <p className="text-[#94A3B8] mb-10 text-base max-w-md mx-auto leading-relaxed">
            Join ZeroTrace — the autonomous security engineer that never sleeps.
          </p>

          {user ? (
            <Link to="/dashboard"
              className="cta-btn inline-flex items-center gap-2.5 px-10 py-4 rounded-xl font-semibold text-white text-base tracking-wide"
              style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)" }}>
              Go to Dashboard <ArrowRight size={16} />
            </Link>
          ) : (
            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/signup"
                className="cta-btn inline-flex items-center gap-2.5 px-10 py-4 rounded-xl font-semibold text-white text-base tracking-wide"
                style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)" }}>
                Create Free Account <ArrowRight size={16} />
              </Link>
              <Link to="/login"
                className="cta-secondary px-10 py-4 rounded-xl font-semibold text-[#CBD5E1] text-base tracking-wide"
                style={glass}>
                Sign In
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════ FOOTER ══════════════════ */}
      <footer className="relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="glow-line" />
        </div>
        <div className="py-10 px-6 flex flex-col md:flex-row items-center justify-between gap-4 max-w-7xl mx-auto">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12">
              <img src="/logo.png" width={32} height={32} alt="Zero Trace" className="object-contain" />
            </div>
            <span className="brand-name text-sm text-[#F9FAFB]">
              ZERO<span className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">TRACE</span>
            </span>
          </Link>
          <p className="text-[11px] text-[#4B5563]">© 2026 ZeroTrace — Autonomous Security Intelligence</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;