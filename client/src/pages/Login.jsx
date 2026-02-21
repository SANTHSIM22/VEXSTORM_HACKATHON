import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AlertTriangle, Eye, EyeOff, ArrowRight } from "lucide-react";


/* ── Animated bar configs ── */
const bars = [
  { left: "4%",  w: 3,  h: "65%", delay: 0,    dur: 4,   color: "rgba(124,58,237,0.5)" },
  { left: "10%", w: 5,  h: "80%", delay: 0.6,  dur: 5,   color: "rgba(168,85,247,0.35)" },
  { left: "16%", w: 2,  h: "50%", delay: 1.2,  dur: 3.5, color: "rgba(124,58,237,0.25)" },
  { left: "22%", w: 8,  h: "95%", delay: 0.3,  dur: 6,   color: "rgba(147,51,234,0.55)" },
  { left: "28%", w: 3,  h: "70%", delay: 1.8,  dur: 4.5, color: "rgba(124,58,237,0.3)" },
  { left: "34%", w: 6,  h: "85%", delay: 0.9,  dur: 5.5, color: "rgba(168,85,247,0.45)" },
  { left: "40%", w: 2,  h: "55%", delay: 2.1,  dur: 3.8, color: "rgba(139,92,246,0.2)" },
  { left: "46%", w: 10, h: "100%",delay: 0.1,  dur: 7,   color: "rgba(124,58,237,0.6)" },
  { left: "52%", w: 4,  h: "75%", delay: 1.5,  dur: 4.2, color: "rgba(168,85,247,0.3)" },
  { left: "58%", w: 7,  h: "90%", delay: 0.4,  dur: 5.8, color: "rgba(147,51,234,0.5)" },
  { left: "64%", w: 2,  h: "60%", delay: 2.4,  dur: 3.2, color: "rgba(124,58,237,0.2)" },
  { left: "70%", w: 5,  h: "82%", delay: 0.7,  dur: 4.8, color: "rgba(168,85,247,0.4)" },
  { left: "76%", w: 3,  h: "68%", delay: 1.1,  dur: 5.2, color: "rgba(139,92,246,0.35)" },
  { left: "82%", w: 9,  h: "98%", delay: 0.2,  dur: 6.5, color: "rgba(124,58,237,0.55)" },
  { left: "88%", w: 4,  h: "72%", delay: 1.7,  dur: 4.4, color: "rgba(168,85,247,0.25)" },
  { left: "94%", w: 6,  h: "88%", delay: 0.5,  dur: 5.6, color: "rgba(147,51,234,0.45)" },
];

const inputStyle = {
  background: "rgba(0,0,0,0.35)",
  border: "1px solid rgba(168,85,247,0.15)",
};

const inputFocusStyle = {
  background: "rgba(0,0,0,0.35)",
  border: "1px solid rgba(124,58,237,0.5)",
  boxShadow: "0 0 0 3px rgba(124,58,237,0.12)",
};


const Login = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [focusField, setFocusField] = useState(null);
  const [mounted, setMounted] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { setMounted(true); }, []);

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
    <div className="min-h-screen flex relative overflow-hidden bg-black">

      {/* ── Left panel — animated vertical bars ── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden" style={{ background: "#000" }}>
        {/* Bars */}
        <div className="absolute inset-0">
          {bars.map((b, i) => (
            <div
              key={i}
              className="absolute bottom-0 rounded-t-sm auth-bar"
              style={{
                left: b.left,
                width: b.w,
                height: b.h,
                background: `linear-gradient(to top, ${b.color}, transparent)`,
                boxShadow: `0 0 ${b.w * 3}px ${b.color}`,
                animationDelay: `${b.delay}s`,
                animationDuration: `${b.dur}s`,
              }}
            />
          ))}
        </div>

        {/* Ambient glow at bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[40%] pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(124,58,237,0.08), transparent)" }}
        />

        {/* Text overlay */}
        <div className="relative z-10 flex flex-col justify-end p-14 pb-20 w-full">
          <div className={`transition-all duration-1000 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <h2 className="text-[2.75rem] leading-[1.15] font-extrabold text-white font-heading tracking-tight">
              AI-powered security<br />
              partner for modern<br />
              <span className="bg-gradient-to-r from-[#a855f7] to-[#7c3aed] bg-clip-text text-transparent">
                developers.
              </span>
            </h2>
          </div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div
        className="flex-1 flex items-center justify-center px-8 py-12 relative"
        style={{ background: "linear-gradient(180deg, #08000f 0%, #0d0018 50%, #0a0010 100%)" }}
      >
        {/* Subtle border line on left edge */}
        <div className="hidden lg:block absolute left-0 top-0 bottom-0 w-px" style={{ background: "rgba(124,58,237,0.15)" }} />

        <div
          className={`w-full max-w-[400px] transition-all duration-700 delay-150 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 text-white no-underline mb-12 group">
            <img src="/logo.png" width={36} height={36} alt="Zero Trace" className="object-contain transition-transform duration-300 group-hover:scale-110" />
            <span className="brand-name text-sm text-[#F9FAFB]">
              ZERO<span className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">TRACE</span>
            </span>
          </Link>

          {/* Header */}
          <h1 className="text-[1.75rem] font-extrabold text-white mb-1.5 font-heading">Welcome back</h1>
          <p className="text-[#94A3B8] text-sm mb-10">Sign in to continue securing your code</p>

          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm flex items-center gap-2 animate-fadeIn">
              <AlertTriangle size={16} className="shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Your email</label>
              <input
                type="email" name="email" placeholder="you@example.com"
                value={form.email} onChange={onChange} required autoComplete="email"
                onFocus={() => setFocusField("email")} onBlur={() => setFocusField(null)}
                className="w-full px-4 py-3.5 rounded-xl text-[#F9FAFB] placeholder-[#94A3B8]/30 focus:outline-none transition-all duration-200"
                style={focusField === "email" ? inputFocusStyle : inputStyle}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"} name="password" placeholder="••••••••"
                  value={form.password} onChange={onChange} required autoComplete="current-password"
                  onFocus={() => setFocusField("password")} onBlur={() => setFocusField(null)}
                  className="w-full px-4 py-3.5 rounded-xl text-[#F9FAFB] placeholder-[#94A3B8]/30 focus:outline-none transition-all duration-200 pr-12"
                  style={focusField === "password" ? inputFocusStyle : inputStyle}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#a855f7] cursor-pointer transition-colors duration-200">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit" disabled={loading}
              className="btn-primary w-full py-3.5 font-bold rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
              style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)", boxShadow: "0 4px 20px rgba(124,58,237,0.3)" }}
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
            <Link to="/signup" className="font-semibold text-[#a855f7] hover:text-[#c084fc] transition-colors duration-200">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

