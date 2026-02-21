import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const RECENT_SCANS = [
  { repo: "github.com/juice-shop/juice-shop", vulns: 12, time: "2 hours ago", severity: "CRITICAL", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  { repo: "github.com/DVWA/DVWA", vulns: 7, time: "1 day ago", severity: "HIGH", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  { repo: "github.com/webgoat/WebGoat", vulns: 3, time: "3 days ago", severity: "MEDIUM", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" }
];

const VULNS = [
  { id: "CVE-2024-001", title: "JWT Secret Hardcoded", severity: "CRITICAL", sevColor: "text-red-400 bg-red-500/10 border-red-500/30", file: "src/auth/middleware.js", status: "patched" },
  { id: "CVE-2024-002", title: "SQL Injection via user input", severity: "HIGH", sevColor: "text-orange-400 bg-orange-500/10 border-orange-500/30", file: "src/routes/search.js", status: "open" },
  { id: "CVE-2024-003", title: "XSS in comment renderer", severity: "MEDIUM", sevColor: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30", file: "src/components/Comment.jsx", status: "open" },
  { id: "CVE-2024-004", title: "Outdated dependency (lodash)", severity: "LOW", sevColor: "text-blue-400 bg-blue-500/10 border-blue-500/30", file: "package.json", status: "patched" }
];

const LOGS = [
  { time: "00:01", agent: "ANALYST", color: "text-blue-400", msg: "Scanning src/auth/middleware.js...", critical: false },
  { time: "00:03", agent: "ATTACKER", color: "text-orange-400", msg: "JWT secret hardcoded  CVE candidate", critical: false },
  { time: "00:05", agent: "ANALYST", color: "text-blue-400", msg: "Cross-referencing with routes/user.js...", critical: false },
  { time: "00:08", agent: "ATTACKER", color: "text-red-400", msg: "CRITICAL: Auth bypass via forged token", critical: true },
  { time: "00:10", agent: "PATCHER", color: "text-[#00ffaa]", msg: "Generating PoC exploit script...", critical: false },
  { time: "00:12", agent: "PATCHER", color: "text-[#00ffaa]", msg: " Patch applied. 0 regressions.", critical: false }
];

const NAV = [
  { id: "overview", icon: "", label: "Overview" },
  { id: "scan", icon: "", label: "New Scan" },
  { id: "vulnerabilities", icon: "", label: "Vulnerabilities" },
  { id: "agents", icon: "", label: "Agent Logs" }
];

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");

  const handleLogout = () => { logout(); navigate("/"); };

  const handleScan = async e => {
    e.preventDefault();
    if (!repoUrl) return;
    setScanning(true); setScanDone(false);
    await new Promise(r => setTimeout(r, 3000));
    setScanning(false); setScanDone(true);
  };

  return (
    <div className="flex min-h-screen bg-[#0d1117]">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-[#111827] border-r border-[#1f2937] flex flex-col py-6 px-4 fixed left-0 top-0 bottom-0 z-40">
        <div className="flex items-center gap-2 font-bold text-lg tracking-widest mb-10 px-2">
          <span className="text-[#00ffaa] text-xl"></span>
          VEX<span className="text-[#00ffaa]">STORM</span>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${tab === item.id ? "bg-[#00ffaa15] text-[#00ffaa] border border-[#00ffaa30]" : "text-gray-400 hover:text-white hover:bg-[#1f2937]"}`}>
              <span>{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="border-t border-[#1f2937] pt-4 mt-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-[#00ffaa22] border border-[#00ffaa44] flex items-center justify-center text-[#00ffaa] font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{user?.name}</div>
              <div className="text-xs text-gray-500 truncate">{user?.email}</div>
            </div>
            <button onClick={handleLogout} title="Sign out"
              className="text-gray-500 hover:text-red-400 transition-colors text-lg cursor-pointer"></button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-white mb-1">
              {tab === "overview" && "Security Overview"}
              {tab === "scan" && "Run New Scan"}
              {tab === "vulnerabilities" && "Vulnerabilities"}
              {tab === "agents" && "Agent Activity Logs"}
            </h1>
            <p className="text-gray-400 text-sm">Welcome back, <span className="text-white font-medium">{user?.name}</span></p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00ffaa11] border border-[#00ffaa33]">
            <span className="w-2 h-2 rounded-full bg-[#00ffaa] animate-pulse" />
            <span className="text-xs text-[#00ffaa] font-semibold">LIVE</span>
          </div>
        </div>

        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: "", val: "4", label: "Critical Issues", accent: "#ff3366" },
                { icon: "", val: String(user?.scansRun || 3), label: "Scans Run", accent: "#00ffaa" },
                { icon: "", val: "2", label: "Auto-Patched", accent: "#00b4ff" },
                { icon: "", val: "94%", label: "Detection Rate", accent: "#00ffaa" }
              ].map((k, i) => (
                <div key={i} className="p-5 rounded-xl bg-[#111827] border border-[#1f2937]">
                  <div className="text-2xl mb-3">{k.icon}</div>
                  <div className="text-3xl font-extrabold mb-0.5" style={{ color: k.accent }}>{k.val}</div>
                  <div className="text-xs text-gray-500">{k.label}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-[#111827] border border-[#1f2937]">
                <h3 className="font-bold mb-4 text-white">Recent Scans</h3>
                <div className="space-y-3">
                  {RECENT_SCANS.map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-[#1f2937] last:border-0">
                      <div>
                        <div className="text-sm text-white font-mono">{s.repo}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{s.time}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${s.bg} ${s.color}`}>{s.severity}</span>
                        <span className="text-xs text-gray-400">{s.vulns} vulns</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-6 rounded-xl bg-[#111827] border border-[#1f2937]">
                <h3 className="font-bold mb-5 text-white">Severity Breakdown</h3>
                <div className="space-y-4">
                  {[
                    { label: "CRITICAL", count: 2, total: 22, color: "#ff3366" },
                    { label: "HIGH", count: 5, total: 22, color: "#ff6600" },
                    { label: "MEDIUM", count: 8, total: 22, color: "#ffcc00" },
                    { label: "LOW", count: 7, total: 22, color: "#00b4ff" }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-semibold w-16 shrink-0" style={{ color: item.color }}>{item.label}</span>
                      <div className="flex-1 h-2 bg-[#1f2937] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${(item.count / item.total) * 100}%`, background: item.color }} />
                      </div>
                      <span className="text-xs text-gray-400 w-4 text-right">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCAN TAB */}
        {tab === "scan" && (
          <div className="max-w-2xl space-y-6">
            <div className="p-6 rounded-xl bg-[#111827] border border-[#1f2937]">
              <h3 className="font-bold text-white mb-2">Target Repository</h3>
              <p className="text-sm text-gray-400 mb-5">Enter a GitHub URL or local path to start the autonomous scan.</p>
              <form onSubmit={handleScan} className="flex gap-3">
                <input type="text" placeholder="https://github.com/owner/repo"
                  value={repoUrl} onChange={e => setRepoUrl(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-lg bg-[#0d1117] border border-[#1f2937] text-white placeholder-gray-600 focus:outline-none focus:border-[#00ffaa66] focus:ring-1 focus:ring-[#00ffaa33] text-sm transition-colors" />
                <button type="submit" disabled={scanning || !repoUrl}
                  className="px-5 py-3 bg-[#00ffaa] text-[#0d1117] font-bold rounded-lg hover:bg-[#00e699] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 text-sm shrink-0">
                  {scanning ? "Scanning..." : " Run Scan"}
                </button>
              </form>
            </div>

            {scanning && (
              <div className="p-6 rounded-xl bg-[#111827] border border-[#1f2937] space-y-4">
                <div className="h-1.5 bg-[#1f2937] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#00ffaa] to-[#00b4ff] rounded-full scanning" />
                </div>
                <div className="space-y-2 font-mono text-sm">
                  {[
                    { agent: "ANALYST", color: "text-blue-400", msg: "Scanning files..." },
                    { agent: "ATTACKER", color: "text-orange-400", msg: "Probing attack surface..." },
                    { agent: "PATCHER", color: "text-[#00ffaa]", msg: "On standby..." }
                  ].map((l, i) => (
                    <div key={i} className="flex gap-2 agent-live-anim" style={{ animationDelay: `${i * 0.3}s` }}>
                      <span className={`font-bold ${l.color}`}>[{l.agent}]</span>
                      <span className="text-gray-400">{l.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {scanDone && (
              <div className="p-6 rounded-xl bg-[#111827] border border-[#00ffaa33]">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl"></span>
                  <h3 className="font-bold text-white text-lg">Scan Complete</h3>
                </div>
                <p className="text-gray-400 text-sm mb-4">
                  Agents found <strong className="text-red-400">4 vulnerabilities</strong> — 1 critical, 1 high, 1 medium, 1 low.
                </p>
                <button onClick={() => setTab("vulnerabilities")}
                  className="px-5 py-2.5 border border-[#00ffaa44] text-[#00ffaa] text-sm font-semibold rounded-lg hover:bg-[#00ffaa15] transition-all cursor-pointer">
                  View Full Report 
                </button>
              </div>
            )}
          </div>
        )}

        {/* VULNERABILITIES TAB */}
        {tab === "vulnerabilities" && (
          <div className="rounded-xl bg-[#111827] border border-[#1f2937] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#161b22] border-b border-[#1f2937]">
                <tr>
                  {["ID", "Title", "Severity", "File", "Status"].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f2937]">
                {VULNS.map((v, i) => (
                  <tr key={i} className="hover:bg-[#1f2937]/50 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs text-gray-400">{v.id}</td>
                    <td className="px-5 py-4 text-white font-medium">{v.title}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${v.sevColor}`}>{v.severity}</span>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-gray-400">{v.file}</td>
                    <td className="px-5 py-4">
                      {v.status === "patched"
                        ? <span className="text-xs px-2.5 py-1 rounded-full bg-[#00ffaa15] border border-[#00ffaa30] text-[#00ffaa] font-semibold"> Patched</span>
                        : <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 font-semibold"> Open</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* AGENTS TAB */}
        {tab === "agents" && (
          <div className="rounded-xl overflow-hidden border border-[#1f2937] max-w-3xl">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#161b22] border-b border-[#1f2937]">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-2 text-xs text-gray-500 font-mono">vexstorm — live agent.log</span>
            </div>
            <div className="bg-[#0d1117] p-5 font-mono text-sm space-y-2">
              {LOGS.map((l, i) => (
                <div key={i} className={`flex gap-2 ${l.critical ? "bg-red-500/5 border border-red-500/20 rounded px-2 py-0.5" : ""}`}>
                  <span className="text-gray-600">[{l.time}]</span>
                  <span className={`font-bold ${l.color}`}>[{l.agent}]</span>
                  <span className={l.critical ? "text-red-300" : "text-gray-300"}>{l.msg}</span>
                </div>
              ))}
              <div className="flex gap-2">
                <span className="text-gray-600">[00:14]</span>
                <span className="text-blue-400 font-bold">[SYSTEM]</span>
                <span className="text-gray-300">Awaiting next scan...<span className="cursor text-[#00ffaa]">_</span></span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
