import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";
import { LogOut, ArrowRight, Menu, X } from "lucide-react";

/* ── Zero Trace Logo ── */
const ZeroTraceLogo = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="12" stroke="url(#zt-grad-nav)" strokeWidth="2.5" fill="none" />
    <circle cx="16" cy="16" r="7" stroke="url(#zt-grad-nav)" strokeWidth="1.5" fill="none" opacity="0.5" />
    <line x1="6" y1="26" x2="26" y2="6" stroke="url(#zt-grad-nav)" strokeWidth="2" strokeLinecap="round" />
    <circle cx="16" cy="16" r="2.5" fill="url(#zt-grad-nav)" />
    <defs>
      <linearGradient id="zt-grad-nav" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#a855f7" />
        <stop offset="100%" stopColor="#e9d5ff" />
      </linearGradient>
    </defs>
  </svg>
);

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
      style={{
        background: "rgba(11,15,26,0.8)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Brand */}
      <Link to="/" className="flex items-center gap-2.5 text-white no-underline">
        <ZeroTraceLogo size={24} />
        <span className="text-lg font-extrabold tracking-widest text-[#F9FAFB]">
          ZERO<span className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">TRACE</span>
        </span>
      </Link>

      {/* Desktop links */}
      <div className="hidden md:flex items-center gap-6">
        <Link to="/" className="text-sm text-[#94A3B8] hover:text-[#F9FAFB] transition-colors duration-200">Home</Link>
        {user ? (
          <>
            <Link to="/dashboard" className="text-sm text-[#94A3B8] hover:text-[#F9FAFB] transition-colors duration-200">Dashboard</Link>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-[#F9FAFB]"
                style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)" }}
              >
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-[#CBD5E1]">{user.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-[#94A3B8] hover:text-red-400 transition-colors duration-200 cursor-pointer px-3 py-1.5 rounded-lg"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <LogOut size={16} /> Sign Out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-sm text-[#94A3B8] hover:text-[#F9FAFB] transition-colors duration-200">Login</Link>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg text-white transition-all duration-200 hover:brightness-110"
              style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)" }}
            >
              Get Started <ArrowRight size={16} />
            </Link>
          </>
        )}
      </div>

      {/* Mobile toggle */}
      <button className="md:hidden text-[#94A3B8] cursor-pointer" onClick={() => setMenuOpen(!menuOpen)}>
        {menuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="absolute top-full left-0 right-0 flex flex-col gap-1 p-4 md:hidden"
          style={{
            background: "rgba(11,15,26,0.95)",
            backdropFilter: "blur(16px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Link to="/" className="text-sm text-[#94A3B8] hover:text-[#F9FAFB] py-2" onClick={() => setMenuOpen(false)}>Home</Link>
          {user ? (
            <>
              <Link to="/dashboard" className="text-sm text-[#94A3B8] hover:text-[#F9FAFB] py-2" onClick={() => setMenuOpen(false)}>Dashboard</Link>
              <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-left text-red-400 py-2 cursor-pointer">
                <LogOut size={16} /> Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-[#94A3B8] hover:text-[#F9FAFB] py-2" onClick={() => setMenuOpen(false)}>Login</Link>
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 text-sm font-bold py-2 bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent"
                onClick={() => setMenuOpen(false)}
              >
                Get Started <ArrowRight size={16} />
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;

