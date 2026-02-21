import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, ScanLine, ShieldAlert, Terminal, LogOut,
  History, Wrench, Target, CheckCircle2, ChevronRight, ShieldHalf
} from "lucide-react";


/* ── Data ── */
const RECENT_SCANS = [
  { repo: "github.com/juice-shop/juice-shop", vulns: 12, time: "2 hours ago", severity: "CRITICAL", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  { repo: "github.com/DVWA/DVWA", vulns: 7, time: "1 day ago", severity: "HIGH", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  { repo: "github.com/webgoat/WebGoat", vulns: 3, time: "3 days ago", severity: "MEDIUM", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
];

const VULNS = [
  { id: "CVE-2024-001", title: "JWT Secret Hardcoded", severity: "CRITICAL", sevColor: "text-red-400 bg-red-500/10 border-red-500/30", file: "src/auth/middleware.js", status: "patched" },
  { id: "CVE-2024-002", title: "SQL Injection via user input", severity: "HIGH", sevColor: "text-orange-400 bg-orange-500/10 border-orange-500/30", file: "src/routes/search.js", status: "open" },
  { id: "CVE-2024-003", title: "XSS in comment renderer", severity: "MEDIUM", sevColor: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30", file: "src/components/Comment.jsx", status: "open" },
  { id: "CVE-2024-004", title: "Outdated dependency (lodash)", severity: "LOW", sevColor: "text-blue-400 bg-blue-500/10 border-blue-500/30", file: "package.json", status: "patched" },
];

const LOGS = [
  { time: "00:01", agent: "ANALYST", color: "text-[#3B82F6]", msg: "Scanning src/auth/middleware.js..." },
  { time: "00:03", agent: "ATTACKER", color: "text-orange-400", msg: "JWT secret hardcoded — CVE candidate" },
  { time: "00:05", agent: "ANALYST", color: "text-[#3B82F6]", msg: "Cross-referencing with routes/user.js..." },
  { time: "00:08", agent: "ATTACKER", color: "text-red-400", msg: "CRITICAL: Auth bypass via forged token", critical: true },
  { time: "00:10", agent: "PATCHER", color: "text-[#7C3AED]", msg: "Generating PoC exploit script..." },
  { time: "00:12", agent: "PATCHER", color: "text-[#7C3AED]", msg: "Patch applied. 0 regressions." },
];

const NAV = [
  { id: "overview", icon: <LayoutDashboard size={18} />, label: "Overview" },
  { id: "scan", icon: <ScanLine size={18} />, label: "New Scan" },
  { id: "vulnerabilities", icon: <ShieldAlert size={18} />, label: "Vulnerabilities" },
  { id: "agents", icon: <Terminal size={18} />, label: "Agent Logs" },
];

/* ── Glass styles ── */
const glass = {
  background: "rgba(255,255,255,0.05)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
};

const glassSubtle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");

  const handleLogout = () => { logout(); navigate("/"); };

  const handleScan = async (e) => {
    e.preventDefault();
    if (!repoUrl) return;
    setScanning(true);
    setScanDone(false);
    await new Promise((r) => setTimeout(r, 3000));
    setScanning(false);
    setScanDone(true);
  };

  return (
    <div className="flex min-h-screen" style={{ background: "#0B0F1A" }}>
      {/* ── Sidebar ── */}
      <aside
        className="w-64 shrink-0 fixed left-0 top-0 bottom-0 z-40 flex flex-col py-6 px-4"
        style={{ background: "#111827", borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2.5 mb-10 px-2">
          <img src="/logo.png" width={32} height={32} alt="Zero Trace" className="object-contain" />
          <span className="brand-name text-sm text-[#F9FAFB]">
            ZERO<span className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">TRACE</span>
          </span>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                tab === item.id
                  ? "text-[#F9FAFB]"
                  : "text-[#94A3B8] hover:text-[#F9FAFB] hover:bg-white/[0.04]"
              }`}
              style={tab === item.id ? { background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)" } : {}}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} className="pt-4 mt-4">
          <div className="flex items-center gap-3 px-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-[#F9FAFB]"
              style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)" }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#F9FAFB] truncate">{user?.name}</div>
              <div className="text-xs text-[#94A3B8] truncate">{user?.email}</div>
            </div>
            <button onClick={handleLogout} title="Sign out"
              className="text-[#94A3B8] hover:text-red-400 transition-colors cursor-pointer">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-[#F9FAFB] mb-1">
              {tab === "overview" && "Security Overview"}
              {tab === "scan" && "Run New Scan"}
              {tab === "vulnerabilities" && "Vulnerabilities"}
              {tab === "agents" && "Agent Activity Logs"}
            </h1>
            <p className="text-[#94A3B8] text-sm">
              Welcome back, <span className="text-[#F9FAFB] font-medium">{user?.name}</span>
            </p>
          </div>
          
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: <ShieldAlert size={24} className="text-[#F87171]" />, val: "4", label: "Critical Issues", color: "#F87171" },
                { icon: <History size={24} className="text-[#7C3AED]" />, val: String(user?.scansRun || 3), label: "Scans Run", color: "#7C3AED" },
                { icon: <Wrench size={24} className="text-[#3B82F6]" />, val: "2", label: "Auto-Patched", color: "#3B82F6" },
                { icon: <Target size={24} className="text-[#7C3AED]" />, val: "94%", label: "Detection Rate", color: "#7C3AED" },
              ].map((k, i) => (
                <div key={i} className="p-5 rounded-xl" style={glass}>
                  <div className="text-2xl mb-3">{k.icon}</div>
                  <div className="text-3xl font-extrabold mb-0.5" style={{ color: k.color }}>{k.val}</div>
                  <div className="text-xs text-[#94A3B8]">{k.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Scans */}
              <div className="p-6 rounded-xl" style={glass}>
                <h3 className="font-bold mb-4 text-[#F9FAFB]">Recent Scans</h3>
                <div className="space-y-3">
                  {RECENT_SCANS.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2"
                      style={{ borderBottom: i < RECENT_SCANS.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
                    >
                      <div>
                        <div className="text-sm text-[#F9FAFB] font-mono">{s.repo}</div>
                        <div className="text-xs text-[#94A3B8] mt-0.5">{s.time}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${s.bg} ${s.color}`}>{s.severity}</span>
                        <span className="text-xs text-[#94A3B8]">{s.vulns} vulns</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Severity Breakdown */}
              <div className="p-6 rounded-xl" style={glass}>
                <h3 className="font-bold mb-5 text-[#F9FAFB]">Severity Breakdown</h3>
                <div className="space-y-4">
                  {[
                    { label: "CRITICAL", count: 2, total: 22, color: "#F87171" },
                    { label: "HIGH", count: 5, total: 22, color: "#FB923C" },
                    { label: "MEDIUM", count: 8, total: 22, color: "#FBBF24" },
                    { label: "LOW", count: 7, total: 22, color: "#3B82F6" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-semibold w-16 shrink-0" style={{ color: item.color }}>{item.label}</span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${(item.count / item.total) * 100}%`, background: item.color }}
                        />
                      </div>
                      <span className="text-xs text-[#94A3B8] w-4 text-right">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SCAN TAB ── */}
        {tab === "scan" && (
          <div className="max-w-2xl space-y-6">
            <div className="p-6 rounded-xl" style={glass}>
              <h3 className="font-bold text-[#F9FAFB] mb-2">Target Repository</h3>
              <p className="text-sm text-[#94A3B8] mb-5">Enter a GitHub URL or local path to start the autonomous scan.</p>
              <form onSubmit={handleScan} className="flex gap-3">
                <input
                  type="text"
                  placeholder="https://github.com/owner/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-lg text-[#F9FAFB] placeholder-[#94A3B8]/40 text-sm transition-colors focus:outline-none"
                  style={{ background: "#0B0F1A", border: "1px solid rgba(255,255,255,0.08)" }}
                />
                <button
                  type="submit"
                  disabled={scanning || !repoUrl}
                  className="px-5 py-3 font-bold rounded-lg text-white text-sm shrink-0 transition-all duration-200 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)" }}
                >
                  {scanning ? "Scanning..." : "Run Scan"}
                </button>
              </form>
            </div>

            {scanning && (
              <div className="p-6 rounded-xl space-y-4" style={glass}>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full animate-pulse" style={{ background: "linear-gradient(90deg,#7C3AED,#3B82F6)", width: "60%" }} />
                </div>
                <div className="space-y-2 font-mono text-sm">
                  {[
                    { agent: "ANALYST", color: "text-[#3B82F6]", msg: "Scanning files..." },
                    { agent: "ATTACKER", color: "text-orange-400", msg: "Probing attack surface..." },
                    { agent: "PATCHER", color: "text-[#7C3AED]", msg: "On standby..." },
                  ].map((l, i) => (
                    <div key={i} className="flex gap-2" style={{ animationDelay: `${i * 0.3}s` }}>
                      <span className={`font-bold ${l.color}`}>[{l.agent}]</span>
                      <span className="text-[#94A3B8]">{l.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {scanDone && (
              <div className="p-6 rounded-xl" style={{ ...glass, border: "1px solid rgba(124,58,237,0.25)" }}>
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 size={28} className="text-[#7C3AED]" />
                  <h3 className="font-bold text-[#F9FAFB] text-lg">Scan Complete</h3>
                </div>
                <p className="text-[#94A3B8] text-sm mb-4">
                  Agents found <strong className="text-red-400">4 vulnerabilities</strong> — 1 critical, 1 high, 1 medium, 1 low.
                </p>
                <button
                  onClick={() => setTab("vulnerabilities")}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer text-[#CBD5E1] hover:bg-white/[0.06]"
                  style={glassSubtle}
                >
                  View Full Report <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── VULNERABILITIES TAB ── */}
        {tab === "vulnerabilities" && (
          <div className="rounded-xl overflow-hidden" style={glass}>
            <table className="w-full text-sm">
              <thead style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <tr>
                  {["ID", "Title", "Severity", "File", "Status"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {VULNS.map((v, i) => (
                  <tr
                    key={i}
                    className="hover:bg-white/[0.03] transition-colors"
                    style={{ borderBottom: i < VULNS.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
                  >
                    <td className="px-5 py-4 font-mono text-xs text-[#94A3B8]">{v.id}</td>
                    <td className="px-5 py-4 text-[#F9FAFB] font-medium">{v.title}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${v.sevColor}`}>{v.severity}</span>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-[#94A3B8]">{v.file}</td>
                    <td className="px-5 py-4">
                      {v.status === "patched"
                        ? <span className="text-xs px-2.5 py-1 rounded-full font-semibold text-[#7C3AED]" style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)" }}>Patched</span>
                        : <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 font-semibold">Open</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── AGENTS TAB ── */}
        {tab === "agents" && (
          <div className="rounded-xl overflow-hidden max-w-3xl" style={glass}>
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-2 text-xs text-[#94A3B8] font-mono">zerotrace — live agent.log</span>
            </div>
            <div className="p-5 font-mono text-sm space-y-2" style={{ background: "rgba(0,0,0,0.3)" }}>
              {LOGS.map((l, i) => (
                <div key={i} className={`flex gap-2 ${l.critical ? "bg-red-500/5 border border-red-500/20 rounded px-2 py-0.5" : ""}`}>
                  <span className="text-[#94A3B8]/60">[{l.time}]</span>
                  <span className={`font-bold ${l.color}`}>[{l.agent}]</span>
                  <span className={l.critical ? "text-red-300" : "text-[#CBD5E1]"}>{l.msg}</span>
                </div>
              ))}
              <div className="flex gap-2">
                <span className="text-[#94A3B8]/60">[00:14]</span>
                <span className="text-[#3B82F6] font-bold">[SYSTEM]</span>
                <span className="text-[#CBD5E1]">Awaiting next scan...<span className="text-[#7C3AED] animate-pulse">_</span></span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;

