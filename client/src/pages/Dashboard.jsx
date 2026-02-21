import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import {
  LayoutDashboard, ScanLine, ShieldAlert, Terminal, LogOut,
  History, Target, CheckCircle2, ChevronRight,
  Loader2, AlertCircle, RefreshCw, FileText, ScrollText,
  Radio, Shield, Zap, Bug, Lock, Settings, Globe, Key,
  Package, Database, Activity, Layers
} from "lucide-react";


/* ── Helpers ── */
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function riskLabel(score) {
  if (score >= 9) return { label: "CRITICAL", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" };
  if (score >= 7) return { label: "HIGH", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" };
  if (score >= 4) return { label: "MEDIUM", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" };
  if (score > 0)  return { label: "LOW", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" };
  return { label: "CLEAN", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" };
}

function sevStyle(s) {
  const m = {
    Critical: "text-red-400 bg-red-500/10 border-red-500/30",
    High: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    Medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    Low: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    Info: "text-gray-400 bg-gray-500/10 border-gray-500/30",
  };
  return m[s] || "";
}

function agentColor(agent) {
  const m = {
    SYSTEM: "text-[#3B82F6]",
    ORCHESTRATOR: "text-[#7C3AED]",
    ERROR: "text-red-400",
    recon: "text-cyan-400",
    planner: "text-[#7C3AED]",
    injection: "text-red-400",
    xss: "text-orange-400",
    auth: "text-yellow-400",
    config: "text-emerald-400",
    ssrf: "text-pink-400",
    accessControl: "text-amber-400",
    pathTraversal: "text-lime-400",
    crypto: "text-indigo-400",
    dependency: "text-sky-400",
    integrity: "text-teal-400",
    logging: "text-slate-400",
    businessLogic: "text-fuchsia-400",
    remediation: "text-[#7C3AED]",
  };
  return m[agent] || "text-[#94A3B8]";
}


/* ── Nav items ── */
const NAV = [
  { id: "overview", icon: <LayoutDashboard size={18} />, label: "Overview" },
  { id: "scan",     icon: <ScanLine size={18} />,        label: "New Scan" },
  { id: "vulnerabilities", icon: <ShieldAlert size={18} />, label: "Vulnerabilities" },
  { id: "agents",   icon: <Terminal size={18} />,         label: "Agent Logs" },
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

  /* ── UI state ── */
  const [tab, setTab] = useState("overview");
  const [scanView, setScanView] = useState("status"); // "status" | "logs"
  const logsEndRef = useRef(null);

  /* ── Data state ── */
  const [scans, setScans] = useState([]);
  const [selectedScan, setSelectedScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ── Scan form state ── */
  const [repoUrl, setRepoUrl] = useState("");
  const [scanSubmitting, setScanSubmitting] = useState(false);
  const [activeScanId, setActiveScanId] = useState(null);
  const [lastStartedScanId, setLastStartedScanId] = useState(null);

  const handleLogout = () => { logout(); navigate("/"); };

  /* ── Fetch all scans ── */
  const fetchScans = useCallback(async () => {
    try {
      const res = await api.get("/scans");
      setScans(res.data);
    } catch (err) {
      if (err.response?.status !== 401) setError("Failed to load scans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchScans(); }, [fetchScans]);

  /* ── Select a scan (load full details) ── */
  const selectScan = useCallback(async (scanId) => {
    try {
      const res = await api.get(`/scans/${scanId}`);
      setSelectedScan(res.data);
      if (res.data.status === "running") setActiveScanId(scanId);
    } catch {
      setError("Failed to load scan details");
    }
  }, []);

  /* ── Auto-select latest completed scan ── */
  useEffect(() => {
    if (scans.length > 0 && !selectedScan && !activeScanId) {
      const latest = scans.find((s) => s.status === "completed") || scans[0];
      if (latest) selectScan(latest.scanId);
    }
  }, [scans, selectedScan, activeScanId, selectScan]);

  /* ── Poll running scan every 3 s ── */
  useEffect(() => {
    if (!activeScanId) return;
    const poll = async () => {
      try {
        const res = await api.get(`/scans/${activeScanId}`);
        setSelectedScan(res.data);
        setScans((prev) =>
          prev.map((s) =>
            s.scanId === activeScanId
              ? {
                  ...s,
                  status: res.data.status,
                  vulnerabilityCount: res.data.vulnerabilityCount,
                  riskScore: res.data.riskScore,
                  bySeverity: res.data.bySeverity,
                  completedAt: res.data.completedAt,
                }
              : s
          )
        );
        if (res.data.status !== "running") {
          setActiveScanId(null);
          fetchScans();
        }
      } catch {
        /* silent — next poll will retry */
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [activeScanId, fetchScans]);

  /* ── Start a new scan ── */
  const handleScan = async (e) => {
    e.preventDefault();
    if (!repoUrl || scanSubmitting) return;
    setError("");
    setScanSubmitting(true);
    try {
      const res = await api.post("/scans", { targetUrl: repoUrl, scanType: "full" });
      const { scanId } = res.data;

      setActiveScanId(scanId);
      setLastStartedScanId(scanId);

      // Optimistically add the scan to the list
      setScans((prev) => [
        {
          scanId,
          targetUrl: repoUrl,
          status: "running",
          createdAt: res.data.createdAt,
          vulnerabilityCount: 0,
          riskScore: 0,
          bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        },
        ...prev,
      ]);

      setSelectedScan({
        scanId,
        targetUrl: repoUrl,
        status: "running",
        createdAt: res.data.createdAt,
        vulnerabilities: [],
        logs: [],
        vulnerabilityCount: 0,
        riskScore: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      });

      setRepoUrl("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to start scan");
    } finally {
      setScanSubmitting(false);
    }
  };

  /* ── Computed aggregations ── */
  const totalVulns = scans.reduce((s, x) => s + (x.vulnerabilityCount || 0), 0);
  const aggSev = scans.reduce(
    (a, s) => {
      const b = s.bySeverity || {};
      return {
        critical: a.critical + (b.critical || 0),
        high: a.high + (b.high || 0),
        medium: a.medium + (b.medium || 0),
        low: a.low + (b.low || 0),
        info: a.info + (b.info || 0),
      };
    },
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  );
  const sevTotal = aggSev.critical + aggSev.high + aggSev.medium + aggSev.low || 1;

  const scanInProgress =
    lastStartedScanId &&
    selectedScan?.scanId === lastStartedScanId &&
    selectedScan?.status === "running";

  const scanJustDone =
    lastStartedScanId &&
    selectedScan?.scanId === lastStartedScanId &&
    selectedScan?.status &&
    selectedScan.status !== "running";

  /* ── Derive current phase from latest log ── */
  const PHASES = [
    { key: "recon",      label: "Reconnaissance",   icon: Radio,    color: "#06B6D4" },
    { key: "planning",   label: "AI Planning",       icon: Layers,   color: "#7C3AED" },
    { key: "scanning",   label: "Vuln Scanning",     icon: Bug,      color: "#F97316" },
    { key: "risk",       label: "Risk Scoring",      icon: Activity, color: "#FBBF24" },
    { key: "remediation",label: "Remediation",       icon: Shield,   color: "#3B82F6" },
    { key: "done",       label: "Report Generated",  icon: FileText, color: "#22C55E" },
  ];

  function currentPhaseIndex(logs = []) {
    let idx = -1;
    for (const l of logs) {
      const msg = (l.msg || "").toLowerCase();
      if (msg.includes("recon")) idx = Math.max(idx, 0);
      if (msg.includes("planning") || msg.includes("strategy")) idx = Math.max(idx, 1);
      if (msg.includes("scanning") || msg.includes("executing")) idx = Math.max(idx, 2);
      if (msg.includes("risk")) idx = Math.max(idx, 3);
      if (msg.includes("remediation") || msg.includes("fix")) idx = Math.max(idx, 4);
      if (msg.includes("complete") || msg.includes("completed")) idx = Math.max(idx, 5);
    }
    return idx;
  }

  const livePhaseIdx = selectedScan ? currentPhaseIndex(selectedScan.logs) : -1;

  /* ── Auto-scroll logs to bottom ── */
  useEffect(() => {
    if (scanView === "logs") {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedScan?.logs?.length, scanView]);


  /* ── Loading screen ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "#0B0F1A" }}>
        <Loader2 className="animate-spin text-[#7C3AED]" size={40} />
      </div>
    );
  }


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
              {item.id === "scan" && activeScanId && (
                <span className="ml-auto w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              )}
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

        {/* Error banner */}
        {error && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-red-300"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <AlertCircle size={18} />
            <span>{error}</span>
            <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-300 cursor-pointer text-xs">Dismiss</button>
          </div>
        )}

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: <ShieldAlert size={24} className="text-[#F87171]" />, val: String(aggSev.critical), label: "Critical Issues", color: "#F87171" },
                { icon: <History size={24} className="text-[#7C3AED]" />, val: String(scans.length), label: "Scans Run", color: "#7C3AED" },
                { icon: <Target size={24} className="text-[#3B82F6]" />, val: String(totalVulns), label: "Total Vulnerabilities", color: "#3B82F6" },
                { icon: <RefreshCw size={24} className="text-[#7C3AED]" />, val: String(scans.filter((s) => s.status === "running").length), label: "Running Scans", color: "#7C3AED" },
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
                {scans.length === 0 ? (
                  <p className="text-sm text-[#94A3B8]">No scans yet. Start a new scan to see results here.</p>
                ) : (
                  <div className="space-y-3">
                    {scans.slice(0, 5).map((s, i) => {
                      const badge =
                        s.status === "running"
                          ? { label: "RUNNING", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" }
                          : s.status === "failed"
                          ? { label: "FAILED", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" }
                          : riskLabel(s.riskScore);
                      return (
                        <div
                          key={s.scanId}
                          onClick={() => selectScan(s.scanId)}
                          className="flex items-center justify-between py-2 cursor-pointer hover:bg-white/[0.03] -mx-2 px-2 rounded-lg transition-colors"
                          style={{ borderBottom: i < Math.min(scans.length, 5) - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
                        >
                          <div>
                            <div className="text-sm text-[#F9FAFB] font-mono truncate max-w-[260px]">{s.targetUrl}</div>
                            <div className="text-xs text-[#94A3B8] mt-0.5">{timeAgo(s.createdAt)}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${badge.bg} ${badge.color}`}>
                              {badge.label}
                            </span>
                            {s.status === "completed" && <span className="text-xs text-[#94A3B8]">{s.vulnerabilityCount} vulns</span>}
                            {s.status === "running" && <Loader2 size={14} className="animate-spin text-green-400" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Severity Breakdown */}
              <div className="p-6 rounded-xl" style={glass}>
                <h3 className="font-bold mb-5 text-[#F9FAFB]">Severity Breakdown</h3>
                {totalVulns === 0 ? (
                  <p className="text-sm text-[#94A3B8]">No vulnerability data available yet.</p>
                ) : (
                  <div className="space-y-4">
                    {[
                      { label: "CRITICAL", count: aggSev.critical, color: "#F87171" },
                      { label: "HIGH", count: aggSev.high, color: "#FB923C" },
                      { label: "MEDIUM", count: aggSev.medium, color: "#FBBF24" },
                      { label: "LOW", count: aggSev.low, color: "#3B82F6" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs font-semibold w-16 shrink-0" style={{ color: item.color }}>{item.label}</span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${(item.count / sevTotal) * 100}%`, background: item.color }}
                          />
                        </div>
                        <span className="text-xs text-[#94A3B8] w-4 text-right">{item.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── SCAN TAB ── */}
        {tab === "scan" && (
          <div className="max-w-3xl space-y-5">

            {/* ── Input form (hide while scan active or just done) ── */}
            {!scanInProgress && !scanJustDone && (
              <div className="p-6 rounded-xl" style={glass}>
                <h3 className="font-bold text-[#F9FAFB] mb-1">Target URL</h3>
                <p className="text-sm text-[#94A3B8] mb-5">Enter any web URL to start the autonomous multi-agent vulnerability audit.</p>
                <form onSubmit={handleScan} className="flex gap-3">
                  <input
                    type="text"
                    placeholder="https://example.com"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-lg text-[#F9FAFB] placeholder-[#94A3B8]/40 text-sm focus:outline-none transition-colors"
                    style={{ background: "#0B0F1A", border: "1px solid rgba(255,255,255,0.08)" }}
                  />
                  <button
                    type="submit"
                    disabled={scanSubmitting || !repoUrl}
                    className="px-6 py-3 font-bold rounded-lg text-white text-sm shrink-0 transition-all duration-200 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-2"
                    style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)" }}
                  >
                    {scanSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                    {scanSubmitting ? "Starting..." : "Run Scan"}
                  </button>
                </form>
              </div>
            )}

            {/* ── LIVE SCAN PANEL ── */}
            {scanInProgress && selectedScan && (() => {
              const progressPct = livePhaseIdx < 0 ? 5 : Math.round(((livePhaseIdx + 1) / PHASES.length) * 100);
              return (
                <div className="rounded-xl overflow-hidden" style={glass}>
                  {/* Header bar */}
                  <div className="flex items-center justify-between px-6 py-4"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(124,58,237,0.06)" }}>
                    <div className="flex items-center gap-3">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7C3AED] opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-[#7C3AED]" />
                      </span>
                      <span className="text-sm font-bold text-[#F9FAFB]">Scanning in progress</span>
                      <span className="text-xs text-[#94A3B8] font-mono truncate max-w-[260px]">{selectedScan.targetUrl}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setScanView(scanView === "status" ? "logs" : "status")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                        style={scanView === "logs"
                          ? { background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.35)", color: "#A78BFA" }
                          : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94A3B8" }
                        }
                      >
                        {scanView === "logs" ? <><Activity size={13} /> Status</> : <><ScrollText size={13} /> Live Logs</>}
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="px-6 pt-5 pb-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[#94A3B8]">
                        {livePhaseIdx >= 0 ? PHASES[Math.min(livePhaseIdx, PHASES.length - 1)].label : "Initializing..."}
                      </span>
                      <span className="text-xs font-mono text-[#7C3AED]">{progressPct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${progressPct}%`, background: "linear-gradient(90deg,#7C3AED,#3B82F6)" }}
                      />
                    </div>
                  </div>

                  {/* STATUS VIEW — phase stepper */}
                  {scanView === "status" && (
                    <div className="px-6 py-5 grid grid-cols-3 gap-3">
                      {PHASES.map((phase, idx) => {
                        const Icon = phase.icon;
                        const done = idx <= livePhaseIdx;
                        const active = idx === livePhaseIdx + 1 && livePhaseIdx < PHASES.length - 1;
                        return (
                          <div
                            key={phase.key}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300"
                            style={{
                              background: done
                                ? `rgba(${phase.color === "#7C3AED" ? "124,58,237" : phase.color === "#06B6D4" ? "6,182,212" : phase.color === "#F97316" ? "249,115,22" : phase.color === "#FBBF24" ? "251,191,36" : phase.color === "#3B82F6" ? "59,130,246" : "34,197,94"},0.08)`
                                : active
                                ? "rgba(255,255,255,0.04)"
                                : "transparent",
                              border: done
                                ? `1px solid ${phase.color}30`
                                : active
                                ? "1px solid rgba(255,255,255,0.08)"
                                : "1px solid transparent",
                            }}
                          >
                            <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                              style={{
                                background: done ? `${phase.color}20` : "rgba(255,255,255,0.04)",
                                border: `1px solid ${done ? phase.color + "40" : "rgba(255,255,255,0.08)"}`,
                              }}>
                              {done && idx === livePhaseIdx ? (
                                <Loader2 size={14} className="animate-spin" style={{ color: phase.color }} />
                              ) : done ? (
                                <CheckCircle2 size={14} style={{ color: phase.color }} />
                              ) : (
                                <Icon size={14} style={{ color: active ? "#94A3B8" : "#475569" }} />
                              )}
                            </div>
                            <span className="text-xs font-medium leading-tight"
                              style={{ color: done ? "#F9FAFB" : active ? "#94A3B8" : "#475569" }}>
                              {phase.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* LOGS VIEW — real-time terminal */}
                  {scanView === "logs" && (
                    <div className="mx-6 my-5 rounded-xl overflow-hidden"
                      style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="flex items-center gap-2 px-4 py-2.5"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}>
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                        <span className="ml-2 text-xs text-[#475569] font-mono">agent.log — live</span>
                        <Loader2 size={11} className="ml-auto animate-spin text-green-400" />
                      </div>
                      <div className="p-4 font-mono text-xs space-y-1.5 max-h-72 overflow-y-auto">
                        {(!selectedScan.logs || selectedScan.logs.length === 0) ? (
                          <span className="text-[#475569]">Waiting for agent output...</span>
                        ) : selectedScan.logs.map((l, i) => {
                          const isErr = l.agent === "ERROR" || (l.msg || "").toLowerCase().includes("error");
                          return (
                            <div key={i} className={`flex gap-2 ${isErr ? "bg-red-500/5 rounded px-1" : ""}`}>
                              <span className="text-[#475569] shrink-0">{new Date(l.time).toLocaleTimeString()}</span>
                              <span className={`font-bold shrink-0 ${agentColor(l.agent)}`}>[{l.agent}]</span>
                              <span className={isErr ? "text-red-300" : "text-[#94A3B8]"}>{l.msg}</span>
                            </div>
                          );
                        })}
                        <div className="flex gap-2">
                          <span className="text-[#475569]">{new Date().toLocaleTimeString()}</span>
                          <span className="text-[#3B82F6] font-bold">[SYSTEM]</span>
                          <span className="text-[#475569]">scanning<span className="text-[#7C3AED] animate-pulse">▌</span></span>
                        </div>
                        <div ref={logsEndRef} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── SCAN COMPLETE / FAILED PANEL ── */}
            {scanJustDone && selectedScan && (
              <div className="rounded-xl overflow-hidden"
                style={{
                  ...glass,
                  border: selectedScan.status === "failed"
                    ? "1px solid rgba(239,68,68,0.2)"
                    : "1px solid rgba(124,58,237,0.2)",
                }}>

                {/* Result header */}
                <div className="flex items-center justify-between px-6 py-4"
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    background: selectedScan.status === "failed"
                      ? "rgba(239,68,68,0.05)"
                      : "rgba(124,58,237,0.06)",
                  }}>
                  <div className="flex items-center gap-3">
                    {selectedScan.status === "completed"
                      ? <CheckCircle2 size={22} className="text-[#7C3AED] shrink-0" />
                      : <AlertCircle size={22} className="text-red-400 shrink-0" />}
                    <div>
                      <div className="text-sm font-bold text-[#F9FAFB]">
                        {selectedScan.status === "completed" ? "Scan Complete" : "Scan Failed"}
                      </div>
                      <div className="text-xs text-[#94A3B8] font-mono truncate max-w-[300px]">{selectedScan.targetUrl}</div>
                    </div>
                  </div>
                  {/* Tab toggle */}
                  <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                    {["report", "logs"].map((v) => (
                      <button
                        key={v}
                        onClick={() => setScanView(v)}
                        className="px-4 py-1.5 text-xs font-semibold capitalize transition-all cursor-pointer inline-flex items-center gap-1.5"
                        style={{
                          background: scanView === v ? "rgba(124,58,237,0.2)" : "transparent",
                          color: scanView === v ? "#A78BFA" : "#94A3B8",
                          borderRight: v === "report" ? "1px solid rgba(255,255,255,0.08)" : "none",
                        }}
                      >
                        {v === "report" ? <FileText size={12} /> : <ScrollText size={12} />}
                        {v === "report" ? "Report" : "Logs"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* REPORT VIEW */}
                {scanView !== "logs" && selectedScan.status === "completed" && (
                  <div className="p-6 space-y-6">
                    {/* Severity stats */}
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: "Critical", count: selectedScan.bySeverity?.critical || 0, color: "#F87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
                        { label: "High",     count: selectedScan.bySeverity?.high || 0,     color: "#FB923C", bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.2)" },
                        { label: "Medium",   count: selectedScan.bySeverity?.medium || 0,   color: "#FBBF24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)" },
                        { label: "Low",      count: selectedScan.bySeverity?.low || 0,      color: "#60A5FA", bg: "rgba(96,165,250,0.08)",   border: "rgba(96,165,250,0.2)" },
                      ].map((s) => (
                        <div key={s.label} className="rounded-xl p-4 text-center"
                          style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                          <div className="text-2xl font-extrabold mb-0.5" style={{ color: s.color }}>{s.count}</div>
                          <div className="text-xs font-medium" style={{ color: s.color + "CC" }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Top vulnerabilities preview */}
                    {selectedScan.vulnerabilities?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-3">Top Findings</h4>
                        <div className="space-y-2">
                          {selectedScan.vulnerabilities.slice(0, 5).map((v, i) => (
                            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg"
                              style={glassSubtle}>
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold shrink-0 ${sevStyle(v.severity)}`}>
                                {v.severity}
                              </span>
                              <span className="text-sm text-[#F9FAFB] font-medium flex-1 truncate">{v.type}</span>
                              <span className="text-xs text-[#475569] font-mono shrink-0">{v.cvssScore}</span>
                            </div>
                          ))}
                          {selectedScan.vulnerabilities.length > 5 && (
                            <div className="text-xs text-[#94A3B8] text-center pt-1">
                              +{selectedScan.vulnerabilities.length - 5} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => setTab("vulnerabilities")}
                        className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer"
                        style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)", color: "#fff" }}
                      >
                        <ShieldAlert size={16} /> View Full Report
                      </button>
                      <button
                        onClick={() => setTab("agents")}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer text-[#94A3B8] hover:text-[#F9FAFB]"
                        style={glassSubtle}
                      >
                        <Terminal size={16} /> Agent Logs
                      </button>
                      <button
                        onClick={() => { setLastStartedScanId(null); setScanView("status"); }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer text-[#94A3B8] hover:text-[#F9FAFB]"
                        style={glassSubtle}
                      >
                        <ScanLine size={16} /> New Scan
                      </button>
                    </div>
                  </div>
                )}

                {/* FAILED state report view */}
                {scanView !== "logs" && selectedScan.status === "failed" && (
                  <div className="p-6 space-y-4">
                    <p className="text-red-300 text-sm">
                      {selectedScan.logs?.slice(-1)[0]?.msg || "An unknown error occurred during the scan."}
                    </p>
                    <button
                      onClick={() => { setLastStartedScanId(null); setScanView("status"); }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer text-[#CBD5E1]"
                      style={glassSubtle}
                    >
                      <ScanLine size={16} /> Try Again
                    </button>
                  </div>
                )}

                {/* LOGS VIEW (post-scan) */}
                {scanView === "logs" && (
                  <div className="mx-6 my-5 rounded-xl overflow-hidden"
                    style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-2 px-4 py-2.5"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}>
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                      <span className="ml-2 text-xs text-[#475569] font-mono">agent.log — {selectedScan.logs?.length || 0} entries</span>
                    </div>
                    <div className="p-4 font-mono text-xs space-y-1.5 max-h-96 overflow-y-auto">
                      {(!selectedScan.logs || selectedScan.logs.length === 0)
                        ? <span className="text-[#475569]">No log entries recorded.</span>
                        : selectedScan.logs.map((l, i) => {
                            const isErr = l.agent === "ERROR" || (l.msg || "").toLowerCase().includes("error");
                            return (
                              <div key={i} className={`flex gap-2 ${isErr ? "bg-red-500/5 rounded px-1" : ""}`}>
                                <span className="text-[#475569] shrink-0">{new Date(l.time).toLocaleTimeString()}</span>
                                <span className={`font-bold shrink-0 ${agentColor(l.agent)}`}>[{l.agent}]</span>
                                <span className={isErr ? "text-red-300" : "text-[#94A3B8]"}>{l.msg}</span>
                              </div>
                            );
                          })}
                      <div ref={logsEndRef} />
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* ── VULNERABILITIES TAB ── */}
        {tab === "vulnerabilities" && (
          <div>
            {/* Scan selector */}
            {scans.filter((s) => s.status === "completed").length > 0 && (
              <div className="mb-4 flex items-center gap-3">
                <label className="text-sm text-[#94A3B8]">Scan:</label>
                <select
                  value={selectedScan?.scanId || ""}
                  onChange={(e) => selectScan(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-sm text-[#F9FAFB] focus:outline-none cursor-pointer"
                  style={{ background: "#0B0F1A", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {scans
                    .filter((s) => s.status === "completed")
                    .map((s) => (
                      <option key={s.scanId} value={s.scanId}>
                        {s.targetUrl} — {timeAgo(s.createdAt)}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {!selectedScan || !selectedScan.vulnerabilities?.length ? (
              <div className="p-12 rounded-xl text-center" style={glass}>
                <ShieldAlert size={48} className="mx-auto mb-4 text-[#94A3B8]/40" />
                <p className="text-[#94A3B8]">
                  {selectedScan?.status === "running"
                    ? "Scan in progress — vulnerabilities will appear when complete."
                    : scans.length === 0
                    ? "No scans yet. Run a scan to discover vulnerabilities."
                    : "No vulnerabilities found in this scan."}
                </p>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={glass}>
                <table className="w-full text-sm">
                  <thead style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <tr>
                      {["Type", "Severity", "CVSS", "Endpoint", "OWASP"].map((h) => (
                        <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedScan.vulnerabilities.map((v, i) => (
                      <tr
                        key={v.id || i}
                        className="hover:bg-white/[0.03] transition-colors"
                        style={{
                          borderBottom:
                            i < selectedScan.vulnerabilities.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                        }}
                      >
                        <td className="px-5 py-4 text-[#F9FAFB] font-medium">{v.type}</td>
                        <td className="px-5 py-4">
                          <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${sevStyle(v.severity)}`}>
                            {v.severity}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-mono text-sm text-[#F9FAFB]">{v.cvssScore}</td>
                        <td className="px-5 py-4 font-mono text-xs text-[#94A3B8] max-w-[300px] truncate">{v.endpoint}</td>
                        <td className="px-5 py-4 text-xs text-[#94A3B8]">{v.owaspCategory || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── AGENTS TAB ── */}
        {tab === "agents" && (
          <div className="space-y-4">
            {/* Scan selector for logs */}
            {scans.length > 0 && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-[#94A3B8]">Scan:</label>
                <select
                  value={selectedScan?.scanId || ""}
                  onChange={(e) => selectScan(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-sm text-[#F9FAFB] focus:outline-none cursor-pointer"
                  style={{ background: "#0B0F1A", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {scans.map((s) => (
                    <option key={s.scanId} value={s.scanId}>
                      {s.targetUrl} ({s.status}) — {timeAgo(s.createdAt)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!selectedScan || !selectedScan.logs?.length ? (
              <div className="p-12 rounded-xl text-center" style={glass}>
                <Terminal size={48} className="mx-auto mb-4 text-[#94A3B8]/40" />
                <p className="text-[#94A3B8]">No agent logs available. Start a scan to see real-time agent activity.</p>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden max-w-3xl" style={glass}>
                <div
                  className="flex items-center gap-2 px-4 py-3"
                  style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="ml-2 text-xs text-[#94A3B8] font-mono">
                    zerotrace — {selectedScan.targetUrl} ({selectedScan.status})
                  </span>
                  {selectedScan.status === "running" && (
                    <Loader2 size={12} className="ml-auto animate-spin text-green-400" />
                  )}
                </div>
                <div className="p-5 font-mono text-sm space-y-2 max-h-[500px] overflow-y-auto" style={{ background: "rgba(0,0,0,0.3)" }}>
                  {selectedScan.logs.map((l, i) => {
                    const isError =
                      l.agent === "ERROR" ||
                      l.msg?.toLowerCase().includes("error") ||
                      l.msg?.toLowerCase().includes("failed");
                    return (
                      <div
                        key={i}
                        className={`flex gap-2 ${isError ? "bg-red-500/5 border border-red-500/20 rounded px-2 py-0.5" : ""}`}
                      >
                        <span className="text-[#94A3B8]/60 shrink-0">[{new Date(l.time).toLocaleTimeString()}]</span>
                        <span className={`font-bold shrink-0 ${agentColor(l.agent)}`}>[{l.agent}]</span>
                        <span className={isError ? "text-red-300" : "text-[#CBD5E1]"}>{l.msg}</span>
                      </div>
                    );
                  })}
                  {selectedScan.status === "running" && (
                    <div className="flex gap-2">
                      <span className="text-[#94A3B8]/60">[{new Date().toLocaleTimeString()}]</span>
                      <span className="text-[#3B82F6] font-bold">[SYSTEM]</span>
                      <span className="text-[#CBD5E1]">
                        Scanning...<span className="text-[#7C3AED] animate-pulse">_</span>
                      </span>
                    </div>
                  )}
                  {selectedScan.status === "completed" && (
                    <div className="flex gap-2">
                      <span className="text-[#94A3B8]/60">[{new Date().toLocaleTimeString()}]</span>
                      <span className="text-[#3B82F6] font-bold">[SYSTEM]</span>
                      <span className="text-[#CBD5E1]">
                        Awaiting next scan...<span className="text-[#7C3AED] animate-pulse">_</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
