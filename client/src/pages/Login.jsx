import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async e => {
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
            Autonomous Security<br /><span className="text-[#00ffaa]">at Your Fingertips</span>
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed mb-10">
            Sign in to access your dashboard, run security scans, and review vulnerability reports.
          </p>
          <div className="space-y-4">
            {[" Multi-Agent AI Security", " Zero-Day Detection", " Instant Patch Generation"].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-gray-300">
                <span className="w-2 h-2 rounded-full bg-[#00ffaa]" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="relative rounded-xl bg-[#0d1117] border border-[#1f2937] p-4 font-mono text-sm space-y-1">
          <div className="flex gap-2"><span className="text-gray-600">[00:01]</span><span className="text-blue-400 font-bold">[ANALYST]</span><span className="text-gray-300">Scanning codebase...</span></div>
          <div className="flex gap-2"><span className="text-gray-600">[00:04]</span><span className="text-red-400 font-bold">[ATTACKER]</span><span className="text-red-300"> CRITICAL found</span></div>
          <div className="flex gap-2"><span className="text-gray-600">[00:06]</span><span className="text-[#00ffaa] font-bold">[PATCHER]</span><span className="text-gray-300"> Auto-patched<span className="cursor text-[#00ffaa]">_</span></span></div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="flex lg:hidden items-center gap-2 text-white no-underline mb-10 justify-center">
            <span className="text-[#00ffaa] text-xl"></span>
            <span className="text-lg font-bold tracking-widest">VEX<span className="text-[#00ffaa]">STORM</span></span>
          </Link>
          <h1 className="text-3xl font-extrabold text-white mb-1">Welcome back</h1>
          <p className="text-gray-400 mb-8">Sign in to continue securing your code</p>

          {error && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
              <span></span> {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email address</label>
              <input
                type="email" name="email" placeholder="you@example.com"
                value={form.email} onChange={onChange} required autoComplete="email"
                className="w-full px-4 py-3 rounded-lg bg-[#111827] border border-[#1f2937] text-white placeholder-gray-600 focus:outline-none focus:border-[#00ffaa66] focus:ring-1 focus:ring-[#00ffaa33] transition-colors duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"} name="password" placeholder=""
                  value={form.password} onChange={onChange} required autoComplete="current-password"
                  className="w-full px-4 py-3 rounded-lg bg-[#111827] border border-[#1f2937] text-white placeholder-gray-600 focus:outline-none focus:border-[#00ffaa66] focus:ring-1 focus:ring-[#00ffaa33] transition-colors duration-200 pr-12"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs cursor-pointer">
                  {showPass ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3.5 bg-[#00ffaa] text-[#0d1117] font-bold rounded-lg hover:bg-[#00e699] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_0_20px_#00ffaa33] flex items-center justify-center gap-2">
              {loading ? (
                <><div className="loader-ring" style={{ width: 18, height: 18, borderWidth: 2 }} />Signing in...</>
              ) : "Sign In "}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="text-[#00ffaa] hover:text-[#00e699] font-semibold transition-colors">Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
