import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const getStrength = (p) => {
  if (!p) return { score: 0, label: "", color: "" };
  let s = 0;
  if (p.length >= 6) s++;
  if (p.length >= 10) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  const labels = ["", "Weak", "Fair", "Good", "Strong", "Excellent"];
  const colors = ["", "#ff4444", "#ff9900", "#ffcc00", "#00ff88", "#00ffaa"];
  return { score: s, label: labels[s], color: colors[s] };
};

const Signup = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const onChange = e => setForm({ ...form, [e.target.name]: e.target.value });
  const strength = getStrength(form.password);

  const onSubmit = async e => {
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
    <div className="min-h-screen bg-[#0d1117] flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#111827] border-r border-[#1f2937] flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00ffaa08] via-transparent to-[#00b4ff05]" />
        <div className="relative">
          <Link to="/" className="flex items-center gap-2 text-white no-underline mb-16">
            <span className="text-[#00ffaa] text-2xl"></span>
            <span className="text-xl font-bold tracking-widest">VEX<span className="text-[#00ffaa]">STORM</span></span>
          </Link>
          <h2 className="text-4xl font-extrabold mb-4 leading-tight">
            Start Scanning.<br /><span className="text-[#00ffaa]">Start Securing.</span>
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed mb-10">
            Create your free account and unleash autonomous security intelligence on your codebase in minutes.
          </p>
          <div className="space-y-5">
            {[
              { step: "1", label: "Create your account" },
              { step: "2", label: "Connect your repository" },
              { step: "3", label: "Get your full security report" }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-[#00ffaa22] border border-[#00ffaa44] flex items-center justify-center text-[#00ffaa] text-sm font-bold shrink-0">
                  {item.step}
                </div>
                <span className="text-gray-300">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative p-5 rounded-xl bg-[#0d1117] border border-[#1f2937]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-mono">Security Score</span>
            <span className="text-xs text-[#00ffaa] font-mono font-bold">94/100</span>
          </div>
          <div className="w-full h-1.5 bg-[#1f2937] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#00ffaa] to-[#00b4ff] rounded-full" style={{ width: "94%" }} />
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="flex lg:hidden items-center gap-2 text-white no-underline mb-10 justify-center">
            <span className="text-[#00ffaa] text-xl"></span>
            <span className="text-lg font-bold tracking-widest">VEX<span className="text-[#00ffaa]">STORM</span></span>
          </Link>
          <h1 className="text-3xl font-extrabold text-white mb-1">Create account</h1>
          <p className="text-gray-400 mb-8">Start your free security scan today</p>

          {error && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
              <span></span> {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Full Name</label>
              <input type="text" name="name" placeholder="John Doe"
                value={form.name} onChange={onChange} required minLength={2} autoComplete="name"
                className="w-full px-4 py-3 rounded-lg bg-[#111827] border border-[#1f2937] text-white placeholder-gray-600 focus:outline-none focus:border-[#00ffaa66] focus:ring-1 focus:ring-[#00ffaa33] transition-colors duration-200" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email address</label>
              <input type="email" name="email" placeholder="you@example.com"
                value={form.email} onChange={onChange} required autoComplete="email"
                className="w-full px-4 py-3 rounded-lg bg-[#111827] border border-[#1f2937] text-white placeholder-gray-600 focus:outline-none focus:border-[#00ffaa66] focus:ring-1 focus:ring-[#00ffaa33] transition-colors duration-200" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} name="password" placeholder="Min. 6 characters"
                  value={form.password} onChange={onChange} required autoComplete="new-password"
                  className="w-full px-4 py-3 rounded-lg bg-[#111827] border border-[#1f2937] text-white placeholder-gray-600 focus:outline-none focus:border-[#00ffaa66] focus:ring-1 focus:ring-[#00ffaa33] transition-colors duration-200 pr-12" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs cursor-pointer">
                  {showPass ? "HIDE" : "SHOW"}
                </button>
              </div>
              {form.password && (
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 h-1 bg-[#1f2937] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${(strength.score / 5) * 100}%`, background: strength.color }} />
                  </div>
                  <span className="text-xs font-medium" style={{ color: strength.color }}>{strength.label}</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm Password</label>
              <input type="password" name="confirm" placeholder="Repeat your password"
                value={form.confirm} onChange={onChange} required autoComplete="new-password"
                className={`w-full px-4 py-3 rounded-lg bg-[#111827] border text-white placeholder-gray-600 focus:outline-none focus:border-[#00ffaa66] focus:ring-1 focus:ring-[#00ffaa33] transition-colors duration-200 ${form.confirm && form.confirm !== form.password ? "border-red-500/50" : "border-[#1f2937]"}`} />
              {form.confirm && form.confirm !== form.password && (
                <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
              )}
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3.5 bg-[#00ffaa] text-[#0d1117] font-bold rounded-lg hover:bg-[#00e699] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_0_20px_#00ffaa33] flex items-center justify-center gap-2 mt-2">
              {loading ? (
                <><div className="loader-ring" style={{ width: 18, height: 18, borderWidth: 2 }} />Creating account...</>
              ) : "Create Account "}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link to="/login" className="text-[#00ffaa] hover:text-[#00e699] font-semibold transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
