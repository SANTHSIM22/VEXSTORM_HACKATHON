import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  ScanSearch, Wrench, FileText, TestTube, GitMerge,
  ArrowRight, Database, Users, Lightbulb, Workflow, Rocket,
  FileCode, ShieldAlert, ShieldHalf, UsersRound, GitCommitHorizontal,
  PackageCheck, Search, Bomb, ShieldPlus, ChevronRight, ShieldCheck,
  Sparkles, Zap, Eye
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
              <img src="/logo.png" width={24} height={24} alt="Zero Trace" className="object-contain" />
            </div>
            <span className="brand-name text-xs text-[#F9FAFB]">
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
        <div className={`text-center mb-20 px-6 fade-up ${featInView ? "visible" : ""}`}>
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
                className="glass-card flex-shrink-0 w-72 mx-3 rounded-2xl overflow-hidden cursor-default"
                style={{ border: "1px solid rgba(255,255,255,0.07)" }}
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
      <section ref={howRef} className="relative z-10 py-28 px-6 overflow-hidden">
        <div className={`max-w-5xl mx-auto text-center mb-16 fade-up ${howInView ? "visible" : ""}`}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5 text-[10px] font-semibold tracking-[0.2em] text-[#CBD5E1] uppercase" style={glass}>
            <Workflow size={12} className="text-[#3B82F6]" /> How It Works
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#F9FAFB] leading-tight">
            Three Agents.{" "}
            <span className="bg-gradient-to-r from-[#7C3AED] via-[#6366F1] to-[#3B82F6] bg-clip-text text-transparent">One Mission.</span>
          </h2>
        </div>

        {/* Network Mesh Visualization */}
        <div className="max-w-5xl mx-auto relative" style={{ height: "500px" }}>
          {/* SVG Mesh Background */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 1000 500"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="lineGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#6366F1" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="lineGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366F1" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="lineGradient3" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="lineGradientArc" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.5" />
                <stop offset="50%" stopColor="#6366F1" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.5" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Connection lines: node centers at x=160(16%), x=500(50%), x=840(84%) all at y=250(50%) */}
            <g filter="url(#glow)">
              <path className="mesh-line" d="M 160 250 Q 330 160 500 250" fill="none" stroke="url(#lineGradient1)" strokeWidth="2" />
              <path className="mesh-line" d="M 500 250 Q 670 160 840 250" fill="none" stroke="url(#lineGradient2)" strokeWidth="2" style={{ animationDelay: "0.5s" }} />
              <path className="mesh-line" d="M 160 250 Q 500 430 840 250" fill="none" stroke="url(#lineGradientArc)" strokeWidth="1.5" style={{ animationDelay: "1s" }} />
            </g>

            {/* Floating data particles */}
            <g>
              <circle r="5" fill="#7C3AED" filter="url(#glow)">
                <animateMotion dur="2.5s" repeatCount="indefinite" path="M 160 250 Q 330 160 500 250" />
              </circle>
              <circle r="5" fill="#3B82F6" filter="url(#glow)">
                <animateMotion dur="2.5s" repeatCount="indefinite" path="M 500 250 Q 670 160 840 250" begin="0.8s" />
              </circle>
              <circle r="4" fill="#10B981" filter="url(#glow)">
                <animateMotion dur="4s" repeatCount="indefinite" path="M 160 250 Q 500 430 840 250" begin="0.3s" />
              </circle>
            </g>

            {/* Scattered secondary nodes */}
            <g opacity="0.5">
              <circle cx="300" cy="130" r="4" fill="#7C3AED" className="mesh-node" style={{ animationDelay: "0.3s" }} />
              <circle cx="700" cy="130" r="4" fill="#3B82F6" className="mesh-node" style={{ animationDelay: "0.6s" }} />
              <circle cx="350" cy="370" r="3" fill="#6366F1" className="mesh-node" style={{ animationDelay: "0.9s" }} />
              <circle cx="650" cy="370" r="3" fill="#6366F1" className="mesh-node" style={{ animationDelay: "1.2s" }} />
              <circle cx="280" cy="200" r="3" fill="#7C3AED" className="mesh-node" style={{ animationDelay: "1.5s" }} />
              <circle cx="720" cy="200" r="3" fill="#3B82F6" className="mesh-node" style={{ animationDelay: "1.8s" }} />
              <circle cx="500" cy="380" r="3" fill="#10B981" className="mesh-node" style={{ animationDelay: "2.1s" }} />
            </g>
          </svg>

          {/* Interactive Agent Nodes — use margin offset instead of transform so fade-up works */}
          {[
            { id: 1, icon: <Eye size={24} />, title: "ANALYST", color: "#7C3AED", left: "16%",
              desc: "Reads every file. Builds a semantic map. Identifies suspicious patterns, data flows, and trust boundaries across your entire codebase." },
            { id: 2, icon: <Zap size={24} />, title: "ATTACKER", color: "#3B82F6", left: "50%",
              desc: "Attempts to exploit each flaw. Generates PoC scripts. Rates severity using CVSS scoring. Thinks like a real adversary." },
            { id: 3, icon: <ShieldPlus size={24} />, title: "PATCHER", color: "#10B981", left: "84%",
              desc: "Writes context-aware fixes. Validates patches against edge cases. Produces a comprehensive audit report with full remediation." },
          ].map((agent, i) => (
            <div
              key={agent.id}
              className="absolute"
              style={{
                left: agent.left,
                top: "50%",
                marginLeft: "-44px",
                marginTop: "-44px",
              }}
            >
              <div
                className={`agent-node fade-up ${howInView ? "visible" : ""}`}
                style={{
                  transitionDelay: `${i * 0.2 + 0.3}s`,
                  "--node-color": `${agent.color}40`,
                }}
              >
                {/* Tooltip */}
                <div
                  className="node-tooltip"
                  style={{
                    background: "rgba(11,15,26,0.95)",
                    backdropFilter: "blur(20px)",
                    border: `1px solid ${agent.color}40`,
                    boxShadow: `0 20px 50px rgba(0,0,0,0.5), 0 0 30px ${agent.color}20`,
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${agent.color}20`, color: agent.color }}
                    >
                      {agent.icon}
                    </div>
                    <h4 className="font-bold text-sm tracking-wide" style={{ color: agent.color }}>
                      {agent.title} Agent
                    </h4>
                  </div>
                  <p className="text-[13px] text-[#94A3B8] leading-relaxed">{agent.desc}</p>
                  {/* Arrow */}
                  <div
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45"
                    style={{ background: "rgba(11,15,26,0.95)", borderRight: `1px solid ${agent.color}40`, borderBottom: `1px solid ${agent.color}40` }}
                  />
                </div>

                {/* Outer ring */}
                <div
                  className="node-ring absolute rounded-full"
                  style={{
                    width: "110px",
                    height: "110px",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    border: `1px solid ${agent.color}30`,
                    background: `radial-gradient(circle, ${agent.color}08 0%, transparent 70%)`,
                  }}
                />

                {/* Node core */}
                <div
                  className="node-core relative w-[88px] h-[88px] rounded-full flex flex-col items-center justify-center"
                  style={{
                    background: "rgba(22, 27, 49,0.9)",
                    backdropFilter: "blur(50px)",
                    WebkitBackdropFilter: "blur(50px)",
                    border: `2px solid ${agent.color}`,
                    boxShadow: `0 0 20px ${agent.color}40, 0 0 40px ${agent.color}15, inset 0 1px 0 rgba(255,255,255,0.05)`,
                    "--node-color": `${agent.color}40`,
                  }}
                >
                  <div style={{ color: agent.color }}>{agent.icon}</div>
                  <span className="text-[9px] font-bold mt-1 tracking-wider" style={{ color: agent.color }}>
                    {agent.title}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Bottom status */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
            <div
              className="px-6 py-3 rounded-full flex items-center gap-3"
              style={{
                background: "rgba(99,102,241,0.1)",
                border: "1px solid rgba(99,102,241,0.2)",
              }}
            >
              <div className="w-2 h-2 rounded-full bg-[#7C3AED] animate-pulse" />
              <span className="text-xs text-[#94A3B8] font-medium tracking-wide">HOVER NODES TO EXPLORE</span>
              <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" style={{ animationDelay: "0.5s" }} />
            </div>
          </div>
        </div>
      </section>

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
              <img src="/logo.png" width={20} height={20} alt="Zero Trace" className="object-contain" />
            </div>
            <span className="brand-name text-xs text-[#F9FAFB]">
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