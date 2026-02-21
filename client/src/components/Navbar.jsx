import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-[#0d1117]/80 backdrop-blur-md border-b border-[#1f2937]">
      {/* Brand */}
      <Link to="/" className="flex items-center gap-2 text-white no-underline">
        <span className="text-[#00ffaa] text-xl">⬡</span>
        <span className="text-lg font-bold tracking-widest">
          VEX<span className="text-[#00ffaa]">STORM</span>
        </span>
      </Link>

      {/* Desktop links */}
      <div className="hidden md:flex items-center gap-6">
        <Link to="/" className="text-sm text-gray-400 hover:text-[#00ffaa] transition-colors duration-200">Home</Link>
        {user ? (
          <>
            <Link to="/dashboard" className="text-sm text-gray-400 hover:text-[#00ffaa] transition-colors duration-200">Dashboard</Link>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#00ffaa22] border border-[#00ffaa44] flex items-center justify-center text-[#00ffaa] font-bold text-sm">
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-gray-300">{user.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-red-400 transition-colors duration-200 cursor-pointer border border-[#1f2937] hover:border-red-500/40 px-3 py-1.5 rounded-lg"
            >
              Sign Out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors duration-200">Login</Link>
            <Link
              to="/signup"
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#00ffaa] text-[#0d1117] hover:bg-[#00e699] transition-colors duration-200"
            >
              Get Started
            </Link>
          </>
        )}
      </div>

      {/* Mobile toggle */}
      <button
        className="md:hidden flex flex-col gap-1.5 cursor-pointer"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <span className={`block w-5 h-0.5 bg-gray-400 transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
        <span className={`block w-5 h-0.5 bg-gray-400 transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
        <span className={`block w-5 h-0.5 bg-gray-400 transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
      </button>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-[#111827] border-b border-[#1f2937] flex flex-col gap-1 p-4 md:hidden">
          <Link to="/" className="text-sm text-gray-400 hover:text-[#00ffaa] py-2" onClick={() => setMenuOpen(false)}>Home</Link>
          {user ? (
            <>
              <Link to="/dashboard" className="text-sm text-gray-400 hover:text-[#00ffaa] py-2" onClick={() => setMenuOpen(false)}>Dashboard</Link>
              <button onClick={handleLogout} className="text-sm text-left text-red-400 py-2 cursor-pointer">Sign Out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-gray-400 hover:text-white py-2" onClick={() => setMenuOpen(false)}>Login</Link>
              <Link to="/signup" className="text-sm font-semibold text-[#00ffaa] py-2" onClick={() => setMenuOpen(false)}>Get Started →</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
