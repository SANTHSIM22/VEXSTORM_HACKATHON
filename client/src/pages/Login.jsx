import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CheckCircle2, AlertTriangle, Eye, EyeOff, ArrowRight } from "lucide-react";


/* ── Glass styles ── */
const glass = {
  background: "rgba(255,255,255,0.05)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
};

const Login = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#0B0F1A" }}>
      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: "#111827", borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -top-[30%] -left-[20%] w-[500px] h-[500px] rounded-full"
            style={{ background: "radial-gradient(circle,#7C3AED 0%,transparent 70%)", opacity: 0.08, filter: "blur(100px)" }}
          />
        </div>

        <div className="relative">
          <Link to="/" className="flex items-center gap-2.5 text-white no-underline mb-16">
            <img src="/logo.png" width={28} height={28} alt="Zero Trace" className="object-contain" />
            <span className="brand-name text-xs text-[#F9FAFB]">
              ZERO<span className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">TRACE</span>
            </span>
          </Link>
          <h2 className="text-4xl font-extrabold mb-4 leading-tight text-[#F9FAFB]">
            Autonomous Security<br />
            <span className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">
              at Your Fingertips
            </span>
          </h2>
          <p className="text-[#94A3B8] text-lg leading-relaxed mb-10">
            Sign in to access your dashboard, run security scans, and review vulnerability reports.
          </p>
          <div className="space-y-4">
            {["Multi-Agent AI Security", "Zero-Day Detection", "Instant Patch Generation"].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-[#CBD5E1]">
                <CheckCircle2 size={16} className="text-[#7C3AED]" />
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Terminal preview */}
        <div className="relative rounded-xl p-4 font-mono text-sm space-y-1" style={glass}>
          <div className="flex gap-2">
            <span className="text-[#94A3B8]/60">[00:01]</span>
            <span className="text-[#3B82F6] font-bold">[ANALYST]</span>
            <span className="text-[#CBD5E1]">Scanning codebase...</span>
          </div>
          <div className="flex gap-2">
            <span className="text-[#94A3B8]/60">[00:04]</span>
            <span className="text-red-400 font-bold">[ATTACKER]</span>
            <span className="text-red-300">CRITICAL found</span>
          </div>
          <div className="flex gap-2">
            <span className="text-[#94A3B8]/60">[00:06]</span>
            <span className="text-[#7C3AED] font-bold">[PATCHER]</span>
            <span className="text-[#CBD5E1]">Auto-patched<span className="text-[#7C3AED] animate-pulse">_</span></span>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="flex lg:hidden items-center gap-2.5 text-white no-underline mb-10 justify-center">
            <img src="/logo.png" width={24} height={24} alt="Zero Trace" className="object-contain" />
            <span className="brand-name text-xs text-[#F9FAFB]">
              ZERO<span className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">TRACE</span>
            </span>
          </Link>

          <h1 className="text-3xl font-extrabold text-[#F9FAFB] mb-1">Welcome back</h1>
          <p className="text-[#94A3B8] mb-8">Sign in to continue securing your code</p>

          {error && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#CBD5E1] mb-1.5">Email address</label>
              <input
                type="email" name="email" placeholder="you@example.com"
                value={form.email} onChange={onChange} required autoComplete="email"
                className="w-full px-4 py-3 rounded-lg text-[#F9FAFB] placeholder-[#94A3B8]/40 focus:outline-none transition-colors duration-200"
                style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#CBD5E1] mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"} name="password" placeholder="••••••••"
                  value={form.password} onChange={onChange} required autoComplete="current-password"
                  className="w-full px-4 py-3 rounded-lg text-[#F9FAFB] placeholder-[#94A3B8]/40 focus:outline-none transition-colors duration-200 pr-12"
                  style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)" }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#CBD5E1] cursor-pointer">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full py-3.5 font-bold rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 hover:brightness-110"
              style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)" }}
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in...</>
              ) : (
                <>Sign In <ArrowRight size={18} /></>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-[#94A3B8]">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="font-semibold transition-colors bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent hover:brightness-110">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

