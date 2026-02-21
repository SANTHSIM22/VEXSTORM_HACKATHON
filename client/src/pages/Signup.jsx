import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AlertTriangle, Eye, EyeOff, ArrowRight } from "lucide-react";


/* ── Animated bar configs ── */
const bars = [
  { left: "3%",  w: 4,  h: "70%", delay: 0.2,  dur: 5,   color: "rgba(124,58,237,0.45)" },
  { left: "9%",  w: 6,  h: "85%", delay: 0.8,  dur: 6,   color: "rgba(168,85,247,0.4)" },
  { left: "15%", w: 2,  h: "55%", delay: 1.4,  dur: 3.5, color: "rgba(124,58,237,0.2)" },
  { left: "21%", w: 9,  h: "98%", delay: 0.1,  dur: 7,   color: "rgba(147,51,234,0.55)" },
  { left: "27%", w: 3,  h: "62%", delay: 2.0,  dur: 4.2, color: "rgba(139,92,246,0.3)" },
  { left: "33%", w: 7,  h: "90%", delay: 0.5,  dur: 5.5, color: "rgba(168,85,247,0.5)" },
  { left: "39%", w: 2,  h: "48%", delay: 1.7,  dur: 3.8, color: "rgba(124,58,237,0.18)" },
  { left: "45%", w: 10, h: "100%",delay: 0,    dur: 6.5, color: "rgba(124,58,237,0.6)" },
  { left: "51%", w: 5,  h: "78%", delay: 1.2,  dur: 4.5, color: "rgba(168,85,247,0.35)" },
  { left: "57%", w: 8,  h: "92%", delay: 0.3,  dur: 5.8, color: "rgba(147,51,234,0.5)" },
  { left: "63%", w: 3,  h: "58%", delay: 2.3,  dur: 3.4, color: "rgba(124,58,237,0.22)" },
  { left: "69%", w: 6,  h: "80%", delay: 0.9,  dur: 5.2, color: "rgba(168,85,247,0.42)" },
  { left: "75%", w: 4,  h: "72%", delay: 1.5,  dur: 4.8, color: "rgba(139,92,246,0.3)" },
  { left: "81%", w: 9,  h: "95%", delay: 0.4,  dur: 6.2, color: "rgba(124,58,237,0.52)" },
  { left: "87%", w: 3,  h: "65%", delay: 1.9,  dur: 4.0, color: "rgba(168,85,247,0.28)" },
  { left: "93%", w: 7,  h: "88%", delay: 0.6,  dur: 5.4, color: "rgba(147,51,234,0.48)" },
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
  const colors = ["", "#F87171", "#FB923C", "#FBBF24", "#a855f7", "#3B82F6"];
  return { score: s, label: labels[s], color: colors[s] };
};

const Signup = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [focusField, setFocusField] = useState(null);
  const [mounted, setMounted] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { setMounted(true); }, []);

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
              Start scanning.<br />
              Start securing.<br />
              <span className="bg-gradient-to-r from-[#a855f7] to-[#7c3aed] bg-clip-text text-transparent">
                Start shipping safe.
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
          <h1 className="text-[1.75rem] font-extrabold text-white mb-1.5 font-heading">Get Started</h1>
          <p className="text-[#94A3B8] text-sm mb-10">Create your free account to start scanning</p>

          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm flex items-center gap-2 animate-fadeIn">
              <AlertTriangle size={16} className="shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Full Name</label>
              <input type="text" name="name" placeholder="John Doe"
                value={form.name} onChange={onChange} required minLength={2} autoComplete="name"
                onFocus={() => setFocusField("name")} onBlur={() => setFocusField(null)}
                className="w-full px-4 py-3.5 rounded-xl text-[#F9FAFB] placeholder-[#94A3B8]/30 focus:outline-none transition-all duration-200"
                style={focusField === "name" ? inputFocusStyle : inputStyle}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Your email</label>
              <input type="email" name="email" placeholder="you@example.com"
                value={form.email} onChange={onChange} required autoComplete="email"
                onFocus={() => setFocusField("email")} onBlur={() => setFocusField(null)}
                className="w-full px-4 py-3.5 rounded-xl text-[#F9FAFB] placeholder-[#94A3B8]/30 focus:outline-none transition-all duration-200"
                style={focusField === "email" ? inputFocusStyle : inputStyle}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Create new password</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} name="password" placeholder="Min. 6 characters"
                  value={form.password} onChange={onChange} required autoComplete="new-password"
                  onFocus={() => setFocusField("password")} onBlur={() => setFocusField(null)}
                  className="w-full px-4 py-3.5 rounded-xl text-[#F9FAFB] placeholder-[#94A3B8]/30 focus:outline-none transition-all duration-200 pr-12"
                  style={focusField === "password" ? inputFocusStyle : inputStyle}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#a855f7] cursor-pointer transition-colors duration-200">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {/* Strength meter */}
              {form.password && (
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="flex-1 flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="flex-1 h-1.5 rounded-full transition-all duration-300"
                        style={{
                          background: i <= strength.score ? strength.color : "rgba(255,255,255,0.06)",
                          boxShadow: i <= strength.score ? `0 0 6px ${strength.color}40` : "none",
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-semibold shrink-0" style={{ color: strength.color }}>{strength.label}</span>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Confirm Password</label>
              <input type="password" name="confirm" placeholder="Repeat your password"
                value={form.confirm} onChange={onChange} required autoComplete="new-password"
                onFocus={() => setFocusField("confirm")} onBlur={() => setFocusField(null)}
                className="w-full px-4 py-3.5 rounded-xl text-[#F9FAFB] placeholder-[#94A3B8]/30 focus:outline-none transition-all duration-200"
                style={
                  form.confirm && form.confirm !== form.password
                    ? { background: "rgba(0,0,0,0.35)", border: "1px solid rgba(239,68,68,0.4)", boxShadow: "0 0 0 3px rgba(239,68,68,0.08)" }
                    : focusField === "confirm" ? inputFocusStyle : inputStyle
                }
              />
              {form.confirm && form.confirm !== form.password && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <AlertTriangle size={12} /> Passwords do not match
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit" disabled={loading}
              className="btn-primary w-full py-3.5 font-bold rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
              style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)", boxShadow: "0 4px 20px rgba(124,58,237,0.3)" }}
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating account...</>
              ) : (
                <>Create a new account <ArrowRight size={18} /></>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-[#94A3B8]">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-[#a855f7] hover:text-[#c084fc] transition-colors duration-200">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;

