import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AlertTriangle, Eye, EyeOff, ArrowRight } from "lucide-react";

/* ── Zero Trace Logo ── */
const ZeroTraceLogo = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="12" stroke="url(#zt-grad-signup)" strokeWidth="2.5" fill="none" />
    <circle cx="16" cy="16" r="7" stroke="url(#zt-grad-signup)" strokeWidth="1.5" fill="none" opacity="0.5" />
    <line x1="6" y1="26" x2="26" y2="6" stroke="url(#zt-grad-signup)" strokeWidth="2" strokeLinecap="round" />
    <circle cx="16" cy="16" r="2.5" fill="url(#zt-grad-signup)" />
    <defs>
      <linearGradient id="zt-grad-signup" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#a855f7" />
        <stop offset="100%" stopColor="#e9d5ff" />
      </linearGradient>
    </defs>
  </svg>
);

/* ── Glass styles ── */
const glass = {
  background: "rgba(255,255,255,0.05)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
};

/* ── Password strength ── */
const getStrength = (p) => {
  if (!p) return { score: 0, label: "", color: "" };
  let s = 0;
  if (p.length >= 6) s++;
  if (p.length >= 10) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  const labels = ["", "Weak", "Fair", "Good", "Strong", "Excellent"];
  const colors = ["", "#F87171", "#FB923C", "#FBBF24", "#7C3AED", "#3B82F6"];
  return { score: s, label: labels[s], color: colors[s] };
};

const Signup = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const strength = getStrength(form.password);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) return setError("Passwords do not match");
    if (form.password.length < 6) return setError("Password must be at least 6 characters");
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
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
            className="absolute -bottom-[30%] -right-[20%] w-[500px] h-[500px] rounded-full"
            style={{ background: "radial-gradient(circle,#3B82F6 0%,transparent 70%)", opacity: 0.08, filter: "blur(100px)" }}
          />
        </div>

        <div className="relative">
          <Link to="/" className="flex items-center gap-2.5 text-white no-underline mb-16">
            <ZeroTraceLogo size={28} />
            <span className="text-xl font-extrabold tracking-widest text-[#F9FAFB]">
              ZERO<span className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">TRACE</span>
            </span>
          </Link>
          <h2 className="text-4xl font-extrabold mb-4 leading-tight text-[#F9FAFB]">
            Start Scanning.<br />
            <span className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">
              Start Securing.
            </span>
          </h2>
          <p className="text-[#94A3B8] text-lg leading-relaxed mb-10">
            Create your free account and unleash autonomous security intelligence on your codebase in minutes.
          </p>
          <div className="space-y-5">
            {[
              { step: "1", label: "Create your account" },
              { step: "2", label: "Connect your repository" },
              { step: "3", label: "Get your full security report" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-[#F9FAFB]"
                  style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)" }}
                >
                  {item.step}
                </div>
                <span className="text-[#CBD5E1]">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Score bar */}
        <div className="relative p-5 rounded-xl" style={glass}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#94A3B8] font-mono">Security Score</span>
            <span className="text-xs font-mono font-bold bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">94/100</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{ width: "94%", background: "linear-gradient(90deg,#7C3AED,#3B82F6)" }} />
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="flex lg:hidden items-center gap-2.5 text-white no-underline mb-10 justify-center">
            <ZeroTraceLogo size={24} />
            <span className="text-lg font-extrabold tracking-widest text-[#F9FAFB]">
              ZERO<span className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">TRACE</span>
            </span>
          </Link>

          <h1 className="text-3xl font-extrabold text-[#F9FAFB] mb-1">Create account</h1>
          <p className="text-[#94A3B8] mb-8">Start your free security scan today</p>

          {error && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#CBD5E1] mb-1.5">Full Name</label>
              <input type="text" name="name" placeholder="John Doe"
                value={form.name} onChange={onChange} required minLength={2} autoComplete="name"
                className="w-full px-4 py-3 rounded-lg text-[#F9FAFB] placeholder-[#94A3B8]/40 focus:outline-none transition-colors duration-200"
                style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)" }} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#CBD5E1] mb-1.5">Email address</label>
              <input type="email" name="email" placeholder="you@example.com"
                value={form.email} onChange={onChange} required autoComplete="email"
                className="w-full px-4 py-3 rounded-lg text-[#F9FAFB] placeholder-[#94A3B8]/40 focus:outline-none transition-colors duration-200"
                style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)" }} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#CBD5E1] mb-1.5">Password</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} name="password" placeholder="Min. 6 characters"
                  value={form.password} onChange={onChange} required autoComplete="new-password"
                  className="w-full px-4 py-3 rounded-lg text-[#F9FAFB] placeholder-[#94A3B8]/40 focus:outline-none transition-colors duration-200 pr-12"
                  style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)" }} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#CBD5E1] cursor-pointer">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {form.password && (
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${(strength.score / 5) * 100}%`, background: strength.color }} />
                  </div>
                  <span className="text-xs font-medium" style={{ color: strength.color }}>{strength.label}</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[#CBD5E1] mb-1.5">Confirm Password</label>
              <input type="password" name="confirm" placeholder="Repeat your password"
                value={form.confirm} onChange={onChange} required autoComplete="new-password"
                className="w-full px-4 py-3 rounded-lg text-[#F9FAFB] placeholder-[#94A3B8]/40 focus:outline-none transition-colors duration-200"
                style={{
                  background: "#111827",
                  border: form.confirm && form.confirm !== form.password
                    ? "1px solid rgba(239,68,68,0.5)"
                    : "1px solid rgba(255,255,255,0.08)",
                }} />
              {form.confirm && form.confirm !== form.password && (
                <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
              )}
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full py-3.5 font-bold rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 mt-2 hover:brightness-110"
              style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)" }}
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating account...</>
              ) : (
                <>Create Account <ArrowRight size={18} /></>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-[#94A3B8]">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold transition-colors bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent hover:brightness-110">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;

