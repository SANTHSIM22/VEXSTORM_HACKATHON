import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import {
  LayoutDashboard, ScanLine, ShieldAlert, Terminal, LogOut,
  History, Target, CheckCircle2, ChevronRight, ChevronDown,
  Loader2, AlertCircle, RefreshCw, FileText, ScrollText,
  Radio, Shield, Zap, Bug, Lock, Settings, Globe, Key,
  Package, Database, Activity, Layers, Clock, Cpu, Eye,
  AlertTriangle, Wrench, FlaskConical, Info, Github, GitBranch
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
  { id: "overview",        icon: <LayoutDashboard size={18} />, label: "Overview" },
  { id: "scan",            icon: <ScanLine size={18} />,        label: "New Scan" },
  { id: "vulnerabilities", icon: <ShieldAlert size={18} />,     label: "Vulnerabilities" },
  { id: "report",          icon: <FileText size={18} />,        label: "Full Report" },
  { id: "agents",          icon: <Terminal size={18} />,        label: "Agent Logs" },
  { id: "extension",       icon: <ScrollText size={18} />,     label: "Extension Reports" },
  { id: "github",          icon: <Github size={18} />,          label: "GitHub Scan" },
];

/* ── Markdown renderer (handles fenced code blocks + bold) ── */
function renderMarkdown(text) {
  if (!text) return null;
  const segments = text.split(/(```[\s\S]*?```)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith("```")) {
      const inner = seg.slice(3, -3);
      const nl = inner.indexOf("\n");
      const lang = nl !== -1 ? inner.slice(0, nl).trim() : "";
      const code = nl !== -1 ? inner.slice(nl + 1) : inner;
      return (
        <pre key={i} className="rounded-lg p-3 my-2 text-xs overflow-x-auto font-mono"
          style={{ background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {lang && (
            <div className="text-[#7C3AED] text-[10px] mb-1.5 font-semibold uppercase tracking-wider">{lang}</div>
          )}
          <code className="text-[#E2E8F0] whitespace-pre-wrap break-all">{code}</code>
        </pre>
      );
    }
    return seg.split("\n").map((line, j) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <p key={`${i}-${j}`} className="text-sm text-[#CBD5E1] leading-relaxed mb-1">
          {parts.map((p, k) =>
            p.startsWith("**") && p.endsWith("**")
              ? <strong key={k} className="text-[#F9FAFB] font-semibold">{p.slice(2, -2)}</strong>
              : <span key={k}>{p}</span>
          )}
        </p>
      );
    });
  });
}


/* ── Glass styles (matching landing page theme) ── */
const glass = {
  background: "rgba(88,28,135,0.12)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(168,85,247,0.18)",
  boxShadow: "0 8px 32px rgba(88,28,135,0.2), inset 0 1px 0 rgba(255,255,255,0.06)",
};

const glassHover = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 12px 40px rgba(124,58,237,0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
};

const glassSubtle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(168,85,247,0.1)",
};

const glassDark = {
  background: "rgba(0,0,0,0.35)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(168,85,247,0.15)",
  boxShadow: "0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
};


const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  /* ── UI state ── */
  const [tab, setTab] = useState("overview");
  const [scanView, setScanView] = useState("status"); // "status" | "logs"
  const [expandedFindings, setExpandedFindings] = useState(new Set());
  const [reportSort, setReportSort] = useState("severity"); // "severity" | "owasp" | "type"
  const [filterSeverity, setFilterSeverity] = useState(new Set()); // empty = all
  const [filterOwasp, setFilterOwasp]       = useState(new Set());
  const [filterType, setFilterType]         = useState(new Set());
  const [openDropdown, setOpenDropdown]     = useState(null); // "severity" | "owasp" | "type" | null
  const [vulnSort, setVulnSort]             = useState("severity");
  const [vulnFilterSev, setVulnFilterSev]   = useState(new Set());
  const [vulnFilterOwasp, setVulnFilterOwasp] = useState(new Set());
  const [vulnFilterType, setVulnFilterType] = useState(new Set());
  const [vulnDropdown, setVulnDropdown]     = useState(null);
  const logsEndRef = useRef(null);

  /* ── Data state ── */
  const [scans, setScans] = useState([]);
  const [selectedScan, setSelectedScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ── Scan form state ── */
  const [scanName, setScanName] = useState("");
  /* ── Extension reports state ── */
  const [extReports, setExtReports] = useState([]);
  const [extReportsLoading, setExtReportsLoading] = useState(false);
  const [selectedExtReport, setSelectedExtReport] = useState(null); // { meta, html }
  const [extReportHtmlLoading, setExtReportHtmlLoading] = useState(false);
  const [deletingExtReport, setDeletingExtReport] = useState(null); // scanId being deleted

  /* ── GitHub scan state ── */
  const [githubUrl, setGithubUrl]                 = useState("");
  const [githubBranch, setGithubBranch]           = useState("");
  const [githubToken, setGithubToken]             = useState("");
  const [githubScans, setGithubScans]             = useState([]);
  const [githubScansLoading, setGithubScansLoading] = useState(false);
  const [selectedGithubScan, setSelectedGithubScan] = useState(null); // { meta, html }
  const [githubHtmlLoading, setGithubHtmlLoading] = useState(false);
  const [githubScanSubmitting, setGithubScanSubmitting] = useState(false);
  const [activeGithubScanId, setActiveGithubScanId] = useState(null);
  const [deletingGithubScan, setDeletingGithubScan] = useState(null);

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

  /* ── Fetch extension reports (listed under /api/extension/reports) ── */
  const deleteExtReport = useCallback(async (scanId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this report from the database? This cannot be undone.')) return;
    setDeletingExtReport(scanId);
    try {
      await api.delete(`/extension/reports/${scanId}`);
      setExtReports((prev) => prev.filter((r) => r.scanId !== scanId));
      if (selectedExtReport?.meta?.scanId === scanId) setSelectedExtReport(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete report');
    } finally {
      setDeletingExtReport(null);
    }
  }, [selectedExtReport]);

  const fetchExtReports = useCallback(async () => {
    setExtReportsLoading(true);
    try {
      const res = await api.get("/extension/reports");
      setExtReports(res.data);
    } catch (err) {
      if (err.response?.status !== 401) setError("Failed to load extension reports");
    } finally {
      setExtReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "extension") fetchExtReports();
  }, [tab, fetchExtReports]);

  /* ── Load full HTML for a selected extension report ── */
  const selectExtReport = useCallback(async (meta) => {
    setSelectedExtReport({ meta, html: null });
    setExtReportHtmlLoading(true);
    try {
      const res = await api.get(`/extension/reports/${meta.scanId}/html`, {
        responseType: "text",
        transformResponse: [(d) => d], // prevent JSON parse
      });
      setSelectedExtReport({ meta, html: res.data });
    } catch {
      setError("Failed to load HTML report");
    } finally {
      setExtReportHtmlLoading(false);
    }
  }, []);

  /* ── GitHub Scan handlers ── */
  const fetchGithubScans = useCallback(async () => {
    setGithubScansLoading(true);
    try {
      const res = await api.get("/github/scans");
      setGithubScans(res.data);
    } catch (err) {
      if (err.response?.status !== 401) setError("Failed to load GitHub scans");
    } finally {
      setGithubScansLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "github") fetchGithubScans();
  }, [tab, fetchGithubScans]);

  /* Poll active GitHub scan every 3 s */
  useEffect(() => {
    if (!activeGithubScanId) return;
    const poll = async () => {
      try {
        const res = await api.get(`/github/scans/${activeGithubScanId}`);
        setGithubScans((prev) =>
          prev.map((s) => s.scanId === activeGithubScanId ? { ...s, ...res.data } : s)
        );
        if (selectedGithubScan?.meta?.scanId === activeGithubScanId) {
          setSelectedGithubScan((prev) => prev ? { ...prev, meta: { ...prev.meta, ...res.data }, liveLogs: res.data.liveLogs } : prev);
        }
        if (res.data.status !== "running") {
          setActiveGithubScanId(null);
          fetchGithubScans();
        }
      } catch { /* silent */ }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [activeGithubScanId, fetchGithubScans, selectedGithubScan]);

  const handleGithubScan = async (e) => {
    e.preventDefault();
    if (!githubUrl.trim() || githubScanSubmitting) return;
    setError("");
    setGithubScanSubmitting(true);
    try {
      const res = await api.post("/github/scan", {
        repoUrl:     githubUrl.trim(),
        branch:      githubBranch.trim() || undefined,
        githubToken: githubToken.trim() || undefined,
      });
      const { scanId, createdAt } = res.data;
      setActiveGithubScanId(scanId);
      setGithubScans((prev) => [{
        scanId, repoUrl: githubUrl.trim(), branch: githubBranch.trim() || null,
        status: "running", createdAt, vulnerabilityCount: 0, riskScore: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      }, ...prev]);
      setSelectedGithubScan({ meta: { scanId, repoUrl: githubUrl.trim(), status: "running", createdAt }, html: null, liveLogs: [] });
      setGithubUrl("");
      setGithubBranch("");
      setGithubToken("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to start GitHub scan");
    } finally {
      setGithubScanSubmitting(false);
    }
  };

  const selectGithubScan = useCallback(async (meta) => {
    setSelectedGithubScan({ meta, html: null });
    if (meta.status !== "completed") return;
    setGithubHtmlLoading(true);
    try {
      const res = await api.get(`/github/scans/${meta.scanId}/html`, {
        responseType: "text",
        transformResponse: [(d) => d],
      });
      setSelectedGithubScan({ meta, html: res.data });
    } catch {
      setError("Failed to load GitHub scan HTML report");
    } finally {
      setGithubHtmlLoading(false);
    }
  }, []);

  const deleteGithubScan = useCallback(async (scanId, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this GitHub scan report? This cannot be undone.")) return;
    setDeletingGithubScan(scanId);
    try {
      await api.delete(`/github/scans/${scanId}`);
      setGithubScans((prev) => prev.filter((s) => s.scanId !== scanId));
      if (selectedGithubScan?.meta?.scanId === scanId) setSelectedGithubScan(null);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete scan");
    } finally {
      setDeletingGithubScan(null);
    }
  }, [selectedGithubScan]);

  /* ── Select a scan (load full details) ── */
  const selectScan = useCallback(async (scanId) => {
    try {
      const res = await api.get(`/scans/${scanId}`);
      setSelectedScan(res.data);
      if (res.data.status === "running") {
        setActiveScanId(scanId);
        setLastStartedScanId(scanId); // track running scans even after page refresh
      }
    } catch {
      setError("Failed to load scan details");
    }
  }, []);

  /* ── Auto-select latest scan; switch to scan tab if one is running ── */
  useEffect(() => {
    if (scans.length > 0 && !selectedScan && !activeScanId) {
      const running = scans.find((s) => s.status === "running");
      if (running) {
        selectScan(running.scanId);
        setTab("scan"); // show the live scan panel
      } else {
        const latest = scans.find((s) => s.status === "completed") || scans[0];
        if (latest) selectScan(latest.scanId);
      }
    }
  }, [scans, selectedScan, activeScanId, selectScan]);

  /* ── Poll running scan every 2 s ── */
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
                  currentPhase: res.data.currentPhase,
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
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [activeScanId, fetchScans]);

  /* ── Start a new scan ── */
  const handleScan = async (e) => {
    e.preventDefault();
    if (!repoUrl || scanSubmitting) return;
    setError("");
    setScanSubmitting(true);
    try {
      const res = await api.post("/scans", { targetUrl: repoUrl, scanType: "full", scanName: scanName.trim() });
      const { scanId } = res.data;

      setActiveScanId(scanId);
      setLastStartedScanId(scanId);

      // Optimistically add the scan to the list
      setScans((prev) => [
        {
          scanId,
          targetUrl: repoUrl,
          scanName: scanName.trim(),
          status: "running",
          currentPhase: null,
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
        scanName: scanName.trim(),
        status: "running",
        currentPhase: null,
        createdAt: res.data.createdAt,
        vulnerabilities: [],
        logs: [],
        vulnerabilityCount: 0,
        riskScore: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      });

      setRepoUrl("");
      setScanName("");
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
    activeScanId &&
    selectedScan?.scanId === activeScanId &&
    selectedScan?.status === "running";

  const scanJustDone =
    lastStartedScanId &&
    selectedScan?.scanId === lastStartedScanId &&
    selectedScan?.status &&
    selectedScan.status !== "running";

  /* ── Phase tracking (uses backend currentPhase, falls back to log detection) ── */
  const PHASES = [
    { key: "recon",      label: "Reconnaissance",   icon: Radio,    color: "#06B6D4" },
    { key: "planning",   label: "AI Planning",       icon: Layers,   color: "#7C3AED" },
    { key: "scanning",   label: "Vuln Scanning",     icon: Bug,      color: "#F97316" },
    { key: "risk",       label: "Risk Scoring",      icon: Activity, color: "#FBBF24" },
    { key: "remediation",label: "Remediation",       icon: Shield,   color: "#3B82F6" },
    { key: "done",       label: "Report Generated",  icon: FileText, color: "#22C55E" },
  ];

  const PHASE_KEY_MAP = { recon: 0, planning: 1, scanning: 2, risk: 3, remediation: 4, done: 5 };

  function phaseIndexFromBackend(scan) {
    if (!scan) return -1;
    // Use backend-reported currentPhase if available
    if (scan.currentPhase && PHASE_KEY_MAP[scan.currentPhase] !== undefined) {
      return PHASE_KEY_MAP[scan.currentPhase];
    }
    // Fallback: detect from log messages
    let idx = -1;
    for (const l of (scan.logs || [])) {
      const msg = (l.msg || "").toLowerCase();
      if (msg.includes("recon")) idx = Math.max(idx, 0);
      if (msg.includes("planning") || msg.includes("strategy")) idx = Math.max(idx, 1);
      if (msg.includes("scanning") || msg.includes("executing") || msg.includes("deploying agents")) idx = Math.max(idx, 2);
      if (msg.includes("risk scor")) idx = Math.max(idx, 3);
      if (msg.includes("remediation")) idx = Math.max(idx, 4);
      if (msg.includes("scan complete")) idx = Math.max(idx, 5);
    }
    return idx;
  }

  const livePhaseIdx = phaseIndexFromBackend(selectedScan);

  /* ── Close filter dropdowns on outside click ── */
  useEffect(() => {
    if (!openDropdown && !vulnDropdown) return;
    const handler = (e) => {
      if (!e.target.closest("[data-filter-dropdown]")) {
        setOpenDropdown(null);
        setVulnDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openDropdown, vulnDropdown]);

  /* ── Auto-scroll logs to bottom ── */
  useEffect(() => {
    if (scanView === "logs") {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedScan?.logs?.length, scanView]);


  /* ── Loading screen ── */
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader-ring" />
        <span className="text-sm font-mono text-[#a855f7]">Loading dashboard...</span>
      </div>
    );
  }


  return (
    <div className="relative flex min-h-screen text-[#f3e8ff]" style={{ background: "linear-gradient(135deg, #000000 0%, #0d0015 40%, #1a0030 70%, #0d0015 100%)", backgroundAttachment: "fixed" }}>
      {/* Ambient orbs (matching landing) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-[25%] -left-[15%] w-[800px] h-[800px] rounded-full float-orb"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 65%)", filter: "blur(80px)" }} />
        <div className="absolute top-[40%] -right-[20%] w-[600px] h-[600px] rounded-full float-orb"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 65%)", filter: "blur(80px)", animationDelay: "3s" }} />
        <div className="absolute -bottom-[25%] left-[30%] w-[700px] h-[700px] rounded-full float-orb"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 65%)", filter: "blur(80px)", animationDelay: "6s" }} />
      </div>

      {/* ── Sidebar ── */}
      <aside
        className="w-64 shrink-0 fixed left-0 top-0 bottom-0 z-40 flex flex-col py-6 px-4"
        style={{
          background: "rgba(5,0,8,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(168,85,247,0.12)",
        }}
      >
        <div className="flex items-center gap-2.5 mb-10 px-2">
          <img src="/logo.png" width={32} height={32} alt="Zero Trace" className="object-contain" />
          <span className="brand-name text-sm text-[#F9FAFB]">
            ZERO<span className="bg-gradient-to-r from-[#7C3AED] to-[#3B82F6] bg-clip-text text-transparent">TRACE</span>
          </span>
        </div>

        {/* Nav sections */}
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a855f7]/60 px-3 mb-2 font-mono">Report</div>
        <nav className="flex-1 space-y-0.5">
          {NAV.map((item, idx) => {
            const sectionBreaks = { vulnerabilities: "Analysis", extension: "Findings", github: "GitHub" };
            return (
              <div key={item.id}>
                {sectionBreaks[item.id] && (
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a855f7]/60 px-3 mt-5 mb-2 font-mono">{sectionBreaks[item.id]}</div>
                )}
                <button
                  onClick={() => setTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 cursor-pointer nav-item-hover ${
                    tab === item.id
                      ? "text-[#f3e8ff] font-semibold"
                      : "text-[#a78bfa]/60 hover:text-[#f3e8ff] hover:bg-[#a855f7]/5"
                  }`}
                  style={tab === item.id ? {
                    background: "rgba(168,85,247,0.12)",
                    border: "1px solid rgba(168,85,247,0.25)",
                    boxShadow: "0 0 20px rgba(168,85,247,0.08)",
                  } : { border: "1px solid transparent" }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.id === "scan" && activeScanId && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-green-400 pulse-dot" />
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        <div style={{ borderTop: "1px solid rgba(168,85,247,0.12)" }} className="pt-4 mt-2">
          <div className="flex items-center gap-3 px-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-[#f3e8ff]"
              style={{ background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.3)" }}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#f3e8ff] truncate">{user?.name}</div>
              <div className="text-xs text-[#a78bfa]/60 truncate">{user?.email}</div>
            </div>
            <button onClick={handleLogout} title="Sign out"
              className="text-[#a78bfa]/60 hover:text-red-400 transition-colors cursor-pointer">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 ml-64 p-8 relative z-10 min-w-0 overflow-x-hidden">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-[#f3e8ff] mb-1 font-heading">
              {tab === "overview" && "Security Overview"}
              {tab === "scan" && "Run New Scan"}
              {tab === "vulnerabilities" && "Vulnerabilities"}
              {tab === "report" && "Full Security Report"}
           
              {tab === "agents" && "Agent Activity Logs"}
              {tab === "extension" && "Extension Reports"}
              {tab === "github" && "GitHub Repository Scanner"}
            </h1>
            <p className="text-[#a78bfa]/60 text-sm">
              Welcome back, <span className="text-[#f3e8ff] font-medium">{user?.name}</span>
            </p>
          </div>
          {/* Risk score badge (like screenshot) */}
          {selectedScan && selectedScan.status === "completed" && tab === "overview" && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{
              border: selectedScan.riskScore >= 7 ? "1px solid rgba(248,113,113,0.3)" : "1px solid rgba(168,85,247,0.2)",
              background: selectedScan.riskScore >= 7 ? "rgba(248,113,113,0.06)" : "rgba(168,85,247,0.06)",
            }}>
              <span className="text-xs font-bold uppercase tracking-wider text-[#a78bfa]/80 font-mono">Risk Score</span>
              <span className="text-lg font-extrabold font-mono" style={{
                color: selectedScan.riskScore >= 9 ? "#f87171" :
                  selectedScan.riskScore >= 7 ? "#fb923c" :
                  selectedScan.riskScore >= 4 ? "#fbbf24" : "#4ade80"
              }}>
                {Math.round((selectedScan.riskScore || 0) * 10)}/100
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{
                background: selectedScan.riskScore >= 9 ? "rgba(248,113,113,0.15)" :
                  selectedScan.riskScore >= 7 ? "rgba(251,146,60,0.15)" :
                  selectedScan.riskScore >= 4 ? "rgba(251,191,36,0.15)" : "rgba(74,222,128,0.15)",
                color: selectedScan.riskScore >= 9 ? "#f87171" :
                  selectedScan.riskScore >= 7 ? "#fb923c" :
                  selectedScan.riskScore >= 4 ? "#fbbf24" : "#4ade80",
              }}>
                — {riskLabel(selectedScan.riskScore).label}
              </span>
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-red-300"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <AlertCircle size={18} />
            <span>{error}</span>
            <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-300 cursor-pointer text-xs">Dismiss</button>
          </div>
        )}

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && (
          <div className="space-y-8 animate-fadeIn">

            {/* ── Scan Info Bar (like screenshot header) ── */}
            {selectedScan && selectedScan.status === "completed" && (
              <div className="rounded-xl p-5" style={glass}>
                <div className="flex items-center gap-1.5 mb-3">
                  <Shield size={14} className="text-[#a855f7]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a855f7]/80 font-mono">Latest Scan</span>
                </div>
                <div className="text-base font-bold text-[#f3e8ff] font-mono mb-3 truncate">
                  {selectedScan.scanName || selectedScan.targetUrl}
                </div>
                <div className="flex flex-wrap gap-x-8 gap-y-2">
                  {[
                    { label: "Generated", value: selectedScan.completedAt ? new Date(selectedScan.completedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + ' at ' + new Date(selectedScan.completedAt).toLocaleTimeString() : 'N/A' },
                    { label: "Duration", value: selectedScan.summary?.duration || 'N/A' },
                    { label: "Scanner", value: "ZeroTrace — Multi-Agent Security Scanner v3" },
                    { label: "Model", value: "Mistral AI (LangGraph Orchestration)" },
                    { label: "Agents", value: selectedScan.summary?.agentsRun?.length || 'N/A' },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#a78bfa]/50 font-mono">{m.label}</div>
                      <div className="text-sm text-[#f3e8ff] font-medium mt-0.5">{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Executive Dashboard (matching screenshot layout) ── */}
            <div>
              <h2 className="text-lg font-extrabold text-[#f3e8ff] mb-4 font-heading uppercase tracking-wider flex items-center gap-2">
                <LayoutDashboard size={18} className="text-[#a855f7]" />
                Executive Dashboard
              </h2>
              <div className="rounded-xl overflow-hidden" style={glass}>
                <div className="grid grid-cols-2 lg:grid-cols-5 divide-x divide-[#a855f7]/10">
                  {[
                    { val: String(totalVulns), label: "Total Findings", sub: "across all agents", color: "#f3e8ff" },
                    { val: String(aggSev.critical), label: "Critical", sub: "requires immediate action", color: "#f87171" },
                    { val: String(aggSev.high), label: "High", sub: "fix within 7 days", color: "#fb923c" },
                    { val: String(aggSev.medium), label: "Medium", sub: "plan remediation", color: "#fbbf24" },
                    { val: String(aggSev.low + (aggSev.info || 0)), label: "Low / Info", sub: "track & monitor", color: "#60a5fa" },
                  ].map((k, i) => (
                    <div key={i} className="p-6 text-center transition-all duration-300 hover:bg-[#a855f7]/5 cursor-default">
                      <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#a78bfa]/50 font-mono mb-2">{k.label}</div>
                      <div className="text-4xl font-extrabold mb-1 font-heading" style={{ color: k.color }}>{k.val}</div>
                      <div className="text-[11px] text-[#a78bfa]/40">{k.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Severity Distribution (matching screenshot table) ── */}
            <div>
              <h2 className="text-lg font-extrabold text-[#f3e8ff] mb-4 font-heading uppercase tracking-wider flex items-center gap-2">
                <Activity size={18} className="text-[#a855f7]" />
                Severity Distribution
              </h2>
              <div className="rounded-xl overflow-hidden" style={glass}>
                {/* Table header */}
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(168,85,247,0.1)" }}>
                  <h3 className="text-sm font-bold text-[#f3e8ff] font-heading uppercase tracking-wider">Finding Breakdown by Severity</h3>
                  <span className="text-sm text-[#a78bfa]/60 font-mono">{totalVulns} total</span>
                </div>
                {/* Column headers */}
                <div className="grid grid-cols-[120px_1fr_100px_80px] gap-4 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#a78bfa]/50 font-mono"
                  style={{ borderBottom: "1px solid rgba(168,85,247,0.08)" }}>
                  <span>Severity</span>
                  <span>Distribution</span>
                  <span className="text-right">Count</span>
                  <span className="text-right">Share</span>
                </div>
                {/* Severity rows */}
                {[
                  { label: "CRITICAL", count: aggSev.critical, color: "#f87171", bg: "rgba(248,113,113,0.15)", border: "rgba(248,113,113,0.3)" },
                  { label: "HIGH", count: aggSev.high, color: "#fb923c", bg: "rgba(251,146,60,0.15)", border: "rgba(251,146,60,0.3)" },
                  { label: "MEDIUM", count: aggSev.medium, color: "#fbbf24", bg: "rgba(251,191,36,0.15)", border: "rgba(251,191,36,0.3)" },
                  { label: "LOW", count: aggSev.low, color: "#60a5fa", bg: "rgba(96,165,250,0.15)", border: "rgba(96,165,250,0.3)" },
                  { label: "INFO", count: aggSev.info || 0, color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)" },
                ].map((item, i) => (
                  <div key={i} className="grid grid-cols-[120px_1fr_100px_80px] gap-4 items-center px-6 py-3.5 transition-colors hover:bg-[#a855f7]/5"
                    style={{ borderBottom: i < 4 ? "1px solid rgba(168,85,247,0.06)" : "none" }}>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-md w-fit" style={{
                      background: item.bg,
                      border: `1px solid ${item.border}`,
                      color: item.color,
                    }}>{item.label}</span>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{
                        width: `${totalVulns > 0 ? (item.count / totalVulns) * 100 : 0}%`,
                        background: `linear-gradient(90deg, ${item.color}, ${item.color}aa)`,
                        minWidth: item.count > 0 ? "8px" : "0px",
                      }} />
                    </div>
                    <span className="text-right text-lg font-extrabold font-mono" style={{ color: item.color }}>{item.count}</span>
                    <span className="text-right text-sm text-[#a78bfa]/60 font-mono">
                      {totalVulns > 0 ? ((item.count / totalVulns) * 100).toFixed(1) : "0.0"}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Recent Scans + Quick Actions ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Scans */}
              <div className="p-6 rounded-xl panel-hover" style={glass}>
                <h3 className="font-bold mb-4 text-[#f3e8ff] font-heading uppercase tracking-wider text-sm flex items-center gap-2">
                  <History size={16} className="text-[#a855f7]" /> Recent Scans
                </h3>
                {scans.length === 0 ? (
                  <p className="text-sm text-[#a78bfa]/60">No scans yet. Start a new scan to see results here.</p>
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
                          className="flex items-center justify-between py-2.5 cursor-pointer hover:bg-[#a855f7]/5 -mx-2 px-2 rounded-lg transition-colors"
                          style={{ borderBottom: i < Math.min(scans.length, 5) - 1 ? "1px solid rgba(168,85,247,0.08)" : "none" }}
                        >
                          <div>
                            <div className="text-sm text-[#f3e8ff] font-mono truncate max-w-[260px]">{s.scanName || s.targetUrl}</div>
                            <div className="text-xs text-[#a78bfa]/50 mt-0.5">{timeAgo(s.createdAt)}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${badge.bg} ${badge.color}`}>
                              {badge.label}
                            </span>
                            {s.status === "completed" && <span className="text-xs text-[#a78bfa]/50">{s.vulnerabilityCount} vulns</span>}
                            {s.status === "running" && <Loader2 size={14} className="animate-spin text-green-400" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick Stats / Agent Coverage */}
              <div className="p-6 rounded-xl panel-hover" style={glass}>
                <h3 className="font-bold mb-4 text-[#f3e8ff] font-heading uppercase tracking-wider text-sm flex items-center gap-2">
                  <Cpu size={16} className="text-[#a855f7]" /> Agent Coverage
                </h3>
                {selectedScan?.summary?.agentsRun?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedScan.summary.agentsRun.map((agent) => (
                      <div key={agent} className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-[#a855f7]/5"
                        style={glassSubtle}>
                        <span className="w-2 h-2 rounded-full bg-[#a855f7] shrink-0" />
                        <span className={`text-xs font-bold shrink-0 ${agentColor(agent)}`}>{agent}</span>
                        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(168,85,247,0.1)" }}>
                          <div className="h-full rounded-full" style={{
                            width: "100%",
                            background: "linear-gradient(90deg, #7c3aed, #a855f7)",
                          }} />
                        </div>
                        <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : totalVulns === 0 ? (
                  <p className="text-sm text-[#a78bfa]/60">No vulnerability data available yet.</p>
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
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(168,85,247,0.08)" }}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${(item.count / sevTotal) * 100}%`, background: item.color }}
                          />
                        </div>
                        <span className="text-xs text-[#a78bfa]/60 w-4 text-right">{item.count}</span>
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
          <div className="space-y-6 animate-fadeIn">

            {/* ── Input form (hide while scan active or just done) ── */}
            {!scanInProgress && !scanJustDone && (
              <div className="max-w-3xl">
                <div className="p-6 rounded-xl" style={glass}>
                  <h3 className="font-bold text-[#f3e8ff] mb-1 font-heading">Target URL</h3>
                  <p className="text-sm text-[#a78bfa]/60 mb-5">Enter any web URL to start the autonomous multi-agent vulnerability audit.</p>
                  <form onSubmit={handleScan} className="space-y-3">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        placeholder="Scan name (optional)"
                        value={scanName}
                        onChange={(e) => setScanName(e.target.value)}
                        className="w-1/3 px-4 py-3 rounded-lg text-[#f3e8ff] placeholder-[#a78bfa]/30 text-sm focus:outline-none transition-all input-focus"
                        style={{ background: "rgba(5,0,8,0.6)", border: "1px solid rgba(168,85,247,0.15)" }}
                      />
                      <input
                        type="text"
                        placeholder="https://example.com"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        className="flex-1 px-4 py-3 rounded-lg text-[#f3e8ff] placeholder-[#a78bfa]/30 text-sm focus:outline-none transition-all input-focus"
                        style={{ background: "rgba(5,0,8,0.6)", border: "1px solid rgba(168,85,247,0.15)" }}
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={scanSubmitting || !repoUrl}
                        className="px-6 py-3 font-bold rounded-lg text-white text-sm shrink-0 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-2 btn-primary"
                        style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)" }}
                      >
                        {scanSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                        {scanSubmitting ? "Starting..." : "Run Scan"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ── WHAT GETS TESTED PANEL ── */}
            {!scanInProgress && !scanJustDone && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)" }}>
                    <FlaskConical size={16} className="text-[#a855f7]" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-[#f3e8ff] font-heading uppercase tracking-wider">What Gets Tested & How</h2>
                    <p className="text-xs text-[#a78bfa]/50 mt-0.5">All checks are deterministic HTTP/DOM probes. LLM is used only for payload generation &amp; prioritisation — not for deciding if something is vulnerable.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {[
                    {
                      icon: <Globe size={15} />,
                      color: "#22d3ee",
                      label: "Reconnaissance",
                      owasp: "Surface Mapping",
                      method: "DETERMINISTIC",
                      methodColor: "text-green-400",
                      desc: "Crawls all reachable URLs, collects HTML forms, URL parameters, and API endpoints. Probes known sensitive paths and validates responses with content-specific rules.",
                      checks: [
                        "Crawls up to configured depth for URLs, forms & params",
                        "/robots.txt, /sitemap.xml, /.env, /.git/HEAD",
                        "/admin, /api, /swagger.json path probing",
                        "SPA detection — avoids false positives on React/Next.js routes",
                        "Content validators confirm real secret files vs HTML shells",
                      ],
                    },
                    {
                      icon: <Database size={15} />,
                      color: "#f87171",
                      label: "SQL / NoSQL Injection",
                      owasp: "A03 – Injection",
                      method: "PROBE + PATTERN",
                      methodColor: "text-orange-400",
                      desc: "Sends injection payloads to every discovered form field and URL parameter. Detects vulnerabilities through DB-specific error signatures, auth bypass, and anomaly scoring.",
                      checks: [
                        "DB error patterns: MySQL, PostgreSQL, Oracle, SQLite, MSSQL",
                        "Auth bypass: 200 + token returned on malicious credential",
                        "500 response with DB stack trace = High confidence",
                        "Generic server errors filtered out (not flagged as SQLi)",
                        "Timing payloads (SLEEP/WAITFOR) excluded to avoid noise",
                      ],
                    },
                    {
                      icon: <Zap size={15} />,
                      color: "#fb923c",
                      label: "Cross-Site Scripting (XSS)",
                      owasp: "A03 – Injection",
                      method: "PROBE + REFLECTION",
                      methodColor: "text-orange-400",
                      desc: "Injects XSS payloads into forms and URL parameters, then checks whether the payload is reflected unescaped in the HTTP response body or via DOM sinks.",
                      checks: [
                        "Reflected XSS: payload found unencoded in response HTML",
                        "DOM XSS: detects dangerous sinks (innerHTML, document.write)",
                        "DOM sources: location.hash, location.search, URLSearchParams",
                        "Encoded reflection ≠ vulnerable (low confidence only)",
                        "LLM used only to select top 15 high-risk input vectors",
                      ],
                    },
                    {
                      icon: <Lock size={15} />,
                      color: "#fbbf24",
                      label: "Auth & Session Management",
                      owasp: "A07 – Auth Failures",
                      method: "BEHAVIORAL PROBE",
                      methodColor: "text-yellow-400",
                      desc: "Tests login forms for missing security controls using real HTTP requests. Measures server response behaviour — not guessing.",
                      checks: [
                        "CSRF: checks for anti-CSRF tokens in login forms",
                        "Rate limiting: sends 10 rapid requests, expects HTTP 429",
                        "Weak creds: tries admin/admin, test/test, user/password",
                        "Cookie flags: inspects Set-Cookie for HttpOnly & Secure",
                        "JWT: decodes token header/payload, checks 'none' algorithm",
                        "HTTP form: login over plain HTTP (no TLS) detected",
                      ],
                    },
                    {
                      icon: <Shield size={15} />,
                      color: "#a855f7",
                      label: "Access Control",
                      owasp: "A01 – Broken Access Control",
                      method: "PROBE + COMPARE",
                      methodColor: "text-orange-400",
                      desc: "Attempts to access admin/protected routes without authentication and compares responses to authenticated access. Detects IDOR and privilege escalation paths.",
                      checks: [
                        "Unauthenticated requests to /admin, /dashboard, /settings",
                        "IDOR: swaps own resource ID with another user's ID",
                        "Compares status codes: 200 unauthed = finding",
                        "Redirect-only response (302 to login) = properly protected",
                      ],
                    },
                    {
                      icon: <Settings size={15} />,
                      color: "#34d399",
                      label: "Security Misconfiguration",
                      owasp: "A05 – Misconfiguration",
                      method: "HEADER ANALYSIS",
                      methodColor: "text-green-400",
                      desc: "Inspects HTTP response headers for missing security directives. All checks are header-read — no guessing.",
                      checks: [
                        "Missing: Strict-Transport-Security (HSTS)",
                        "Missing: Content-Security-Policy (CSP)",
                        "Missing: X-Frame-Options (clickjacking)",
                        "Missing: X-Content-Type-Options",
                        "Overly-permissive CORS: Access-Control-Allow-Origin: *",
                        "Server version disclosure in Server / X-Powered-By headers",
                      ],
                    },
                    {
                      icon: <Radio size={15} />,
                      color: "#ec4899",
                      label: "SSRF",
                      owasp: "A10 – SSRF",
                      method: "PROBE + CALLBACK",
                      methodColor: "text-orange-400",
                      desc: "Submits internal/cloud metadata URLs to URL-accepting form fields and API parameters. Checks for response content that indicates server-side resolution.",
                      checks: [
                        "Payloads: 169.254.169.254 (AWS/GCP metadata), localhost",
                        "Submits to any field accepting a URL value",
                        "Checks response for cloud metadata signatures",
                        "DNS rebinding paths tested where applicable",
                      ],
                    },
                    {
                      icon: <Layers size={15} />,
                      color: "#a3e635",
                      label: "Path Traversal",
                      owasp: "A01 – Broken Access Control",
                      method: "PROBE + SIGNATURE",
                      methodColor: "text-orange-400",
                      desc: "Injects directory traversal sequences into file/path parameters. Looks for OS file content signatures in the response.",
                      checks: [
                        "Payloads: ../../../etc/passwd, ..%2F..%2Fetc%2Fshadow",
                        "Windows: ..\\..\\windows\\system32\\drivers\\etc\\hosts",
                        "Response signature: root:x:0:0 (Linux), [fonts] (Windows)",
                        "URL-encoded and double-encoded variants tested",
                      ],
                    },
                    {
                      icon: <Key size={15} />,
                      color: "#818cf8",
                      label: "Cryptography Failures",
                      owasp: "A02 – Crypto Failures",
                      method: "TLS + HEADER CHECK",
                      methodColor: "text-green-400",
                      desc: "Checks transport security and data-handling headers. All checks are connection-level or header-level reads.",
                      checks: [
                        "TLS version: flags SSLv3, TLS 1.0, TLS 1.1",
                        "Weak ciphers: RC4, DES, 3DES, NULL, EXPORT",
                        "Sensitive data over HTTP (not HTTPS)",
                        "Mixed content: HTTPS page loading HTTP resources",
                      ],
                    },
                    {
                      icon: <Package size={15} />,
                      color: "#38bdf8",
                      label: "Vulnerable Dependencies",
                      owasp: "A06 – Vulnerable Components",
                      method: "VERSION MATCHING",
                      methodColor: "text-green-400",
                      desc: "Extracts JavaScript library versions from page source and script tags, then matches against known CVE version ranges.",
                      checks: [
                        "Scans <script> src and inline code for library signatures",
                        "Detects: jQuery, React, Angular, lodash, moment, axios",
                        "Matches version against CVE advisory ranges",
                        "Checks CDN URLs for version numbers",
                      ],
                    },
                    {
                      icon: <CheckCircle2 size={15} />,
                      color: "#2dd4bf",
                      label: "Software Integrity",
                      owasp: "A08 – Integrity Failures",
                      method: "DOM INSPECTION",
                      methodColor: "text-green-400",
                      desc: "Reads all external script and stylesheet tags, checking for missing Subresource Integrity (SRI) hashes that allow CDN supply-chain attacks.",
                      checks: [
                        "Every <script src> and <link rel=stylesheet> from CDN",
                        "Checks for integrity='sha256-...' or integrity='sha384-...'",
                        "Missing SRI on external CDN resource = finding",
                        "crossorigin attribute also verified",
                      ],
                    },
                    {
                      icon: <Eye size={15} />,
                      color: "#64748b",
                      label: "Logging & Error Exposure",
                      owasp: "A09 – Logging Failures",
                      method: "RESPONSE ANALYSIS",
                      methodColor: "text-green-400",
                      desc: "Sends invalid inputs and malformed requests, then inspects the error responses for stack traces, file paths, or internal info that aids attackers.",
                      checks: [
                        "Invalid inputs trigger error pages — checks for stack traces",
                        "File path disclosure in error messages (e.g. /var/www/...)",
                        "Framework/version disclosed in error (Django, Rails, Express)",
                        "Verbose SQL errors in response body",
                      ],
                    },
                  ].map((item, i) => (
                    <div key={i} className="p-4 rounded-xl transition-all duration-200 hover:scale-[1.01]" style={{
                      background: "rgba(255,255,255,0.025)",
                      border: `1px solid ${item.color}22`,
                      boxShadow: `0 4px 16px ${item.color}08`,
                    }}>
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${item.color}18`, border: `1px solid ${item.color}30` }}>
                            <span style={{ color: item.color }}>{item.icon}</span>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-[#f3e8ff] leading-tight">{item.label}</div>
                            <div className="text-[10px] text-[#a78bfa]/50 font-mono">{item.owasp}</div>
                          </div>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${item.methodColor}`} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid currentColor", opacity: 0.8, whiteSpace: "nowrap" }}>
                          {item.method}
                        </span>
                      </div>
                      {/* Desc */}
                      <p className="text-[11px] text-[#94a3b8] leading-relaxed mb-3">{item.desc}</p>
                      {/* Checks */}
                      <ul className="space-y-1">
                        {item.checks.map((c, j) => (
                          <li key={j} className="flex items-start gap-2 text-[11px] text-[#cbd5e1]/70">
                            <span className="mt-0.5 shrink-0 text-[8px]" style={{ color: item.color }}>▸</span>
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {/* Hallucination disclaimer */}
                <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.15)" }}>
                  <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-[#94a3b8] leading-relaxed">
                    <span className="font-bold text-yellow-300">About LLM-assisted findings: </span>
                    The AI model (Mistral) is used to <strong className="text-[#f3e8ff]">generate payloads and prioritise test vectors</strong> — it does not decide if something is vulnerable.
                    All vulnerability decisions are made by <strong className="text-[#f3e8ff]">deterministic checks</strong> (HTTP status codes, response body patterns, header inspection).
                    If a finding seems wrong, check its <strong className="text-[#f3e8ff]">confidence score</strong> and <strong className="text-[#f3e8ff]">evidence</strong> in the Vulnerabilities tab.
                    Low-confidence findings (&lt;0.4) should be manually verified before treating them as real issues.
                  </div>
                </div>
              </div>
            )}

            {/* ── LIVE SCAN PANEL — full width ── */}
            {scanInProgress && selectedScan && (() => {
              const progressPct = livePhaseIdx < 0 ? 3 : Math.round(((livePhaseIdx + 1) / PHASES.length) * 100);
              const currentPhase = livePhaseIdx >= 0 ? PHASES[Math.min(livePhaseIdx, PHASES.length - 1)] : null;
              return (
                <div className="space-y-5">
                  {/* ── Top bar: target + controls ── */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7C3AED] opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#7C3AED]" />
                      </span>
                      <span className="text-sm font-bold text-[#F9FAFB]">Scanning</span>
                      <span className="text-xs text-[#94A3B8] font-mono truncate max-w-xs">{selectedScan.scanName || selectedScan.targetUrl}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {["status", "logs"].map((v) => (
                        <button
                          key={v}
                          onClick={() => setScanView(v)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer capitalize"
                          style={scanView === v
                            ? { background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.35)", color: "#A78BFA" }
                            : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94A3B8" }
                          }
                        >
                          {v === "status" ? <Activity size={13} /> : <ScrollText size={13} />}
                          {v === "status" ? "Status" : "Live Logs"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Progress section ── */}
                  <div className="rounded-xl overflow-hidden" style={glass}>
                    {/* Large progress bar */}
                    <div className="px-6 pt-6 pb-4">
                      <div className="flex items-end justify-between mb-3">
                        <div>
                          <div className="text-xs text-[#94A3B8] uppercase tracking-wider font-semibold mb-1">Current Phase</div>
                          <div className="text-lg font-bold text-[#F9FAFB] flex items-center gap-2">
                            {currentPhase ? (
                              <>
                                {(() => { const Icon = currentPhase.icon; return <Icon size={18} style={{ color: currentPhase.color }} />; })()}
                                {currentPhase.label}
                              </>
                            ) : (
                              <>
                                <Loader2 size={18} className="animate-spin text-[#7C3AED]" />
                                Initializing...
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-extrabold font-mono" style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                            {progressPct}%
                          </div>
                          <div className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold mt-0.5">
                            {livePhaseIdx + 1} of {PHASES.length} phases
                          </div>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${progressPct}%`, background: "linear-gradient(90deg,#7C3AED,#3B82F6)" }}
                        />
                      </div>
                    </div>

                    {/* ── Phase timeline — horizontal ── */}
                    <div className="px-6 pb-6 pt-2">
                      <div className="flex items-start gap-0">
                        {PHASES.map((phase, idx) => {
                          const Icon = phase.icon;
                          const done = idx < livePhaseIdx;
                          const active = idx === livePhaseIdx;
                          const upcoming = idx > livePhaseIdx;
                          const isLast = idx === PHASES.length - 1;
                          return (
                            <div key={phase.key} className="flex-1 flex flex-col items-center relative">
                              {/* Connector line */}
                              {!isLast && (
                                <div
                                  className="absolute top-4 left-1/2 w-full h-px"
                                  style={{
                                    background: done
                                      ? "linear-gradient(90deg, " + phase.color + "60, " + PHASES[idx + 1].color + "60)"
                                      : "rgba(255,255,255,0.06)",
                                  }}
                                />
                              )}
                              {/* Node */}
                              <div
                                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${active ? "scale-110" : ""}`}
                                style={{
                                  background: done || active ? `${phase.color}18` : "rgba(255,255,255,0.03)",
                                  border: done || active ? `2px solid ${phase.color}50` : "2px solid rgba(255,255,255,0.08)",
                                }}
                              >
                                {active ? (
                                  <Loader2 size={14} className="animate-spin" style={{ color: phase.color }} />
                                ) : done ? (
                                  <CheckCircle2 size={14} style={{ color: phase.color }} />
                                ) : (
                                  <Icon size={14} style={{ color: upcoming ? "#475569" : phase.color }} />
                                )}
                              </div>
                              {/* Label */}
                              <span
                                className="text-[10px] font-semibold mt-2 text-center leading-tight max-w-16 transition-colors duration-300"
                                style={{ color: active ? "#F9FAFB" : done ? "#CBD5E1" : "#475569" }}
                              >
                                {phase.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* ── STATUS VIEW — agent activity grid ── */}
                  {scanView === "status" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Active agents card */}
                      <div className="rounded-xl p-5" style={glass}>
                        <div className="flex items-center gap-2 mb-4">
                          <Cpu size={14} className="text-[#7C3AED]" />
                          <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Active Agents</span>
                        </div>
                        <div className="space-y-2">
                          {(() => {
                            const agentLogs = {};
                            (selectedScan.logs || []).forEach((l) => {
                              if (l.agent && l.agent !== "SYSTEM" && l.agent !== "ORCHESTRATOR" && l.agent !== "ERROR") {
                                agentLogs[l.agent] = l;
                              }
                            });
                            const agents = Object.entries(agentLogs);
                            if (agents.length === 0) {
                              return <span className="text-xs text-[#475569]">Waiting for agents to start...</span>;
                            }
                            return agents.slice(-6).map(([agent, lastLog]) => (
                              <div key={agent} className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors" style={glassSubtle}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${agent === agents[agents.length - 1][0] ? "animate-pulse" : ""}`}
                                  style={{ background: agentColor(agent).includes("#") ? agentColor(agent).replace("text-[", "").replace("]", "") : "#94A3B8" }} />
                                <span className={`text-xs font-bold shrink-0 ${agentColor(agent)}`}>{agent}</span>
                                <span className="text-xs text-[#94A3B8] truncate flex-1">{lastLog.msg}</span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>

                      {/* Stats card */}
                      <div className="rounded-xl p-5" style={glass}>
                        <div className="flex items-center gap-2 mb-4">
                          <Activity size={14} className="text-[#3B82F6]" />
                          <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Scan Metrics</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: "Log Entries", value: String(selectedScan.logs?.length || 0), icon: <ScrollText size={14} className="text-[#7C3AED]" /> },
                            { label: "Phases Done", value: `${Math.max(0, livePhaseIdx)} / ${PHASES.length}`, icon: <CheckCircle2 size={14} className="text-[#22C55E]" /> },
                            { label: "Vulns Found", value: String(selectedScan.vulnerabilityCount || 0), icon: <ShieldAlert size={14} className="text-[#F87171]" /> },
                            { label: "Status", value: "Running", icon: <Loader2 size={14} className="animate-spin text-[#3B82F6]" /> },
                          ].map((m) => (
                            <div key={m.label} className="flex items-center gap-3 px-3 py-3 rounded-lg" style={glassSubtle}>
                              <div className="shrink-0">{m.icon}</div>
                              <div>
                                <div className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">{m.label}</div>
                                <div className="text-sm font-bold text-[#F9FAFB]">{m.value}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── LOGS VIEW — real-time terminal ── */}
                  {scanView === "logs" && (
                    <div className="rounded-xl overflow-hidden"
                      style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="flex items-center gap-2 px-4 py-2.5"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}>
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                        <span className="ml-2 text-xs text-[#475569] font-mono">agent.log — live • {selectedScan.logs?.length || 0} entries</span>
                        <Loader2 size={11} className="ml-auto animate-spin text-green-400" />
                      </div>
                      <div className="p-4 font-mono text-xs space-y-1.5 max-h-80 overflow-y-auto">
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
              <div className="space-y-5">
                {/* Result header card */}
                <div className="rounded-xl overflow-hidden" style={{
                  ...glass,
                  border: selectedScan.status === "failed"
                    ? "1px solid rgba(239,68,68,0.2)"
                    : "1px solid rgba(124,58,237,0.2)",
                }}>
                  <div className="flex items-center justify-between px-6 py-5"
                    style={{
                      background: selectedScan.status === "failed"
                        ? "rgba(239,68,68,0.04)"
                        : "rgba(124,58,237,0.04)",
                    }}>
                    <div className="flex items-center gap-4">
                      {selectedScan.status === "completed" ? (
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)" }}>
                          <CheckCircle2 size={24} className="text-[#7C3AED]" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
                          <AlertCircle size={24} className="text-red-400" />
                        </div>
                      )}
                      <div>
                        <div className="text-lg font-bold text-[#F9FAFB]">
                          {selectedScan.status === "completed" ? "Scan Complete" : "Scan Failed"}
                        </div>
                        <div className="text-sm text-[#94A3B8] font-mono truncate max-w-sm">{selectedScan.scanName || selectedScan.targetUrl}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {["report", "logs"].map((v) => (
                        <button
                          key={v}
                          onClick={() => setScanView(v)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all duration-200 cursor-pointer"
                          style={scanView === v
                            ? { background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.35)", color: "#A78BFA" }
                            : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94A3B8" }
                          }
                        >
                          {v === "report" ? <FileText size={13} /> : <ScrollText size={13} />}
                          {v === "report" ? "Report" : "Logs"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* REPORT VIEW */}
                {scanView !== "logs" && selectedScan.status === "completed" && (
                  <div className="space-y-5">
                    {/* Severity stats */}
                    <div className="grid grid-cols-4 gap-4">
                      {[
                        { label: "Critical", count: selectedScan.bySeverity?.critical || 0, color: "#F87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
                        { label: "High",     count: selectedScan.bySeverity?.high || 0,     color: "#FB923C", bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.2)" },
                        { label: "Medium",   count: selectedScan.bySeverity?.medium || 0,   color: "#FBBF24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.2)" },
                        { label: "Low",      count: selectedScan.bySeverity?.low || 0,      color: "#60A5FA", bg: "rgba(96,165,250,0.08)",   border: "rgba(96,165,250,0.2)" },
                      ].map((s) => (
                        <div key={s.label} className="rounded-xl p-5 text-center dash-card"
                          style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                          <div className="text-3xl font-extrabold mb-1" style={{ color: s.color }}>{s.count}</div>
                          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: s.color + "CC" }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Top vulnerabilities preview */}
                    {selectedScan.vulnerabilities?.length > 0 && (
                      <div className="rounded-xl p-5" style={glass}>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-3 flex items-center gap-1.5">
                          <Bug size={12} className="text-[#F87171]" /> Top Findings
                        </h4>
                        <div className="space-y-2">
                          {selectedScan.vulnerabilities.slice(0, 5).map((v, i) => (
                            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg panel-hover"
                              style={glassSubtle}>
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold shrink-0 ${sevStyle(v.severity)}`}>
                                {v.severity}
                              </span>
                              <span className="text-sm text-[#F9FAFB] font-medium flex-1 truncate">{v.type}</span>
                              <span className="text-xs font-mono font-bold shrink-0" style={{
                                color: v.cvssScore >= 9 ? "#F87171" : v.cvssScore >= 7 ? "#FB923C" : v.cvssScore >= 4 ? "#FBBF24" : "#60A5FA"
                              }}>CVSS {v.cvssScore}</span>
                            </div>
                          ))}
                          {selectedScan.vulnerabilities.length > 5 && (
                            <div className="text-xs text-[#94A3B8] text-center pt-1">
                              +{selectedScan.vulnerabilities.length - 5} more findings
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => setTab("vulnerabilities")}
                        className="flex-1 inline-flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer btn-primary"
                        style={{ background: "linear-gradient(135deg,#7C3AED,#3B82F6)", color: "#fff" }}
                      >
                        <ShieldAlert size={16} /> View Full Report
                      </button>
                      <button
                        onClick={() => setTab("agents")}
                        className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer text-[#94A3B8] hover:text-[#F9FAFB] panel-hover"
                        style={glassSubtle}
                      >
                        <Terminal size={16} /> Agent Logs
                      </button>
                      <button
                        onClick={() => { setLastStartedScanId(null); setScanView("status"); }}
                        className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer text-[#94A3B8] hover:text-[#F9FAFB] panel-hover"
                        style={glassSubtle}
                      >
                        <ScanLine size={16} /> New Scan
                      </button>
                    </div>
                  </div>
                )}

                {/* FAILED state report view */}
                {scanView !== "logs" && selectedScan.status === "failed" && (
                  <div className="rounded-xl p-6 space-y-4" style={glass}>
                    <p className="text-red-300 text-sm">
                      {selectedScan.logs?.slice(-1)[0]?.msg || "An unknown error occurred during the scan."}
                    </p>
                    <button
                      onClick={() => { setLastStartedScanId(null); setScanView("status"); }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer text-[#CBD5E1] panel-hover"
                      style={glassSubtle}
                    >
                      <ScanLine size={16} /> Try Again
                    </button>
                  </div>
                )}

                {/* LOGS VIEW (post-scan) */}
                {scanView === "logs" && (
                  <div className="rounded-xl overflow-hidden"
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
          <div className="animate-fadeIn">
            {/* Scan selector */}
            {scans.filter((s) => s.status === "completed").length > 0 && (
              <div className="mb-5 flex items-center gap-3">
                <label className="text-sm text-[#a78bfa]/60">Scan:</label>
                <select
                  value={selectedScan?.scanId || ""}
                  onChange={(e) => { selectScan(e.target.value); setVulnFilterSev(new Set()); setVulnFilterOwasp(new Set()); setVulnFilterType(new Set()); }}
                  className="px-3 py-1.5 rounded-lg text-sm text-[#f3e8ff] focus:outline-none cursor-pointer transition-colors input-focus"
                  style={{ background: "rgba(5,0,8,0.6)", border: "1px solid rgba(168,85,247,0.15)" }}
                >
                  {scans
                    .filter((s) => s.status === "completed")
                    .map((s) => (
                      <option key={s.scanId} value={s.scanId}>
                        {s.scanName || s.targetUrl} — {timeAgo(s.createdAt)}
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
              <div className="space-y-4">
                {/* Filter & Sort toolbar + Table */}
                {(() => {
                  const vulns = selectedScan.vulnerabilities || [];
                  const SEV_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3, Info: 4 };
                  const uniqueSev   = [...new Set(vulns.map((v) => v.severity).filter(Boolean))].sort((a, b) => (SEV_ORDER[a] ?? 5) - (SEV_ORDER[b] ?? 5));
                  const uniqueOwasp = [...new Set(vulns.map((v) => v.owaspCategory).filter(Boolean))].sort();
                  const uniqueType  = [...new Set(vulns.map((v) => v.type).filter(Boolean))].sort();
                  const sevColors = { Critical: "#F87171", High: "#FB923C", Medium: "#FBBF24", Low: "#60A5FA", Info: "#94A3B8" };

                  const toggle = (setter, val) => {
                    setter((prev) => {
                      const next = new Set(prev);
                      if (next.has(val)) next.delete(val); else next.add(val);
                      return next;
                    });
                  };

                  const hasAnyFilter = vulnFilterSev.size || vulnFilterOwasp.size || vulnFilterType.size;
                  const dropdownStyle = { background: "#111827", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" };

                  const configs = [
                    { id: "severity", label: "Severity", options: uniqueSev, active: vulnFilterSev, setter: setVulnFilterSev, getColor: (o) => sevColors[o] || "#94A3B8", accentBorder: "rgba(248,113,113,0.35)" },
                    { id: "owasp", label: "OWASP", options: uniqueOwasp, active: vulnFilterOwasp, setter: setVulnFilterOwasp, getColor: () => "#A78BFA", accentBorder: "rgba(124,58,237,0.35)" },
                    { id: "type", label: "Type", options: uniqueType, active: vulnFilterType, setter: setVulnFilterType, getColor: () => "#60A5FA", accentBorder: "rgba(59,130,246,0.35)" },
                  ];

                  const filtered = vulns.filter((v) => {
                    if (vulnFilterSev.size && !vulnFilterSev.has(v.severity)) return false;
                    if (vulnFilterOwasp.size && !vulnFilterOwasp.has(v.owaspCategory)) return false;
                    if (vulnFilterType.size && !vulnFilterType.has(v.type)) return false;
                    return true;
                  });

                  const sorted = [...filtered].sort((a, b) => {
                    if (vulnSort === "severity") {
                      const diff = (SEV_ORDER[a.severity] ?? 5) - (SEV_ORDER[b.severity] ?? 5);
                      return diff !== 0 ? diff : (b.cvssScore || 0) - (a.cvssScore || 0);
                    }
                    if (vulnSort === "cvss") return (b.cvssScore || 0) - (a.cvssScore || 0);
                    if (vulnSort === "type") return (a.type || "").localeCompare(b.type || "");
                    if (vulnSort === "owasp") return (a.owaspCategory || "").localeCompare(b.owaspCategory || "");
                    return 0;
                  });

                  return (
                    <>
                      {/* Toolbar */}
                      <div className="rounded-xl px-5 py-4 space-y-3" style={glass}>
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                            <ShieldAlert size={16} className="text-[#7C3AED]" />
                            <span className="text-[#F9FAFB] font-semibold">{sorted.length}</span>
                            {hasAnyFilter && <span>of {vulns.length}</span>}
                            <span>vulnerabilities</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#94A3B8] shrink-0">Sort:</span>
                            {[
                              { key: "severity", label: "Severity" },
                              { key: "cvss", label: "CVSS" },
                              { key: "type", label: "Type" },
                              { key: "owasp", label: "OWASP" },
                            ].map((opt) => (
                              <button
                                key={opt.key}
                                onClick={() => setVulnSort(opt.key)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-all duration-200"
                                style={
                                  vulnSort === opt.key
                                    ? { background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.35)", color: "#A78BFA" }
                                    : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#94A3B8" }
                                }
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-[#94A3B8] shrink-0">Filter:</span>
                          {configs.map(({ id, label, options, active, setter, getColor, accentBorder }) => {
                            const isOpen = vulnDropdown === id;
                            const selectedCount = active.size;
                            return (
                              <div key={id} className="relative" data-filter-dropdown>
                                <button
                                  onClick={() => setVulnDropdown(isOpen ? null : id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200"
                                  style={
                                    selectedCount > 0
                                      ? { background: "rgba(124,58,237,0.15)", border: `1px solid ${accentBorder}`, color: "#F9FAFB" }
                                      : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#94A3B8" }
                                  }
                                >
                                  {label}
                                  {selectedCount > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                                      style={{ background: "rgba(124,58,237,0.3)", color: "#A78BFA" }}>
                                      {selectedCount}
                                    </span>
                                  )}
                                  <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                                </button>
                                {isOpen && options.length > 0 && (
                                  <div className="absolute left-0 top-full mt-1.5 z-50 rounded-xl overflow-hidden min-w-[180px] animate-fadeIn"
                                    style={dropdownStyle}>
                                    <div className="flex items-center justify-between px-3 py-2"
                                      style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569]">{label}</span>
                                      <button
                                        onClick={() => setter(active.size === options.length ? new Set() : new Set(options))}
                                        className="text-[10px] cursor-pointer transition-colors hover:text-[#A78BFA]"
                                        style={{ color: "#7C3AED" }}
                                      >
                                        {active.size === options.length ? "Clear" : "All"}
                                      </button>
                                    </div>
                                    <div className="py-1 max-h-56 overflow-y-auto">
                                      {options.map((opt) => {
                                        const checked = active.has(opt);
                                        const color = getColor(opt);
                                        return (
                                          <label key={opt}
                                            className="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors hover:bg-white/[0.04]">
                                            <input type="checkbox" checked={checked} onChange={() => toggle(setter, opt)}
                                              className="rounded cursor-pointer accent-[#7C3AED]" />
                                            <span className="text-xs font-medium" style={{ color: checked ? color : "#94A3B8" }}>{opt}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {hasAnyFilter && (
                            <button
                              onClick={() => { setVulnFilterSev(new Set()); setVulnFilterOwasp(new Set()); setVulnFilterType(new Set()); }}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-all duration-200 hover:bg-red-500/15"
                              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171" }}
                            >
                              ✕ Clear
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Table */}
                      {sorted.length === 0 ? (
                        <div className="p-8 rounded-xl text-center" style={glass}>
                          <ShieldAlert size={32} className="mx-auto mb-3 text-[#94A3B8]/40" />
                          <p className="text-[#94A3B8] text-sm">No vulnerabilities match the current filters.</p>
                          <button
                            onClick={() => { setVulnFilterSev(new Set()); setVulnFilterOwasp(new Set()); setVulnFilterType(new Set()); }}
                            className="mt-3 text-xs text-[#7C3AED] hover:text-[#A78BFA] cursor-pointer transition-colors"
                          >
                            Clear filters
                          </button>
                        </div>
                      ) : (
                        <div className="rounded-xl overflow-hidden" style={glass}>
                          <table className="w-full text-sm">
                            <thead style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                              <tr>
                                {[
                                  { key: "type", label: "Type" },
                                  { key: "severity", label: "Severity" },
                                  { key: "cvss", label: "CVSS" },
                                  { key: null, label: "Endpoint" },
                                  { key: "owasp", label: "OWASP" },
                                ].map((h) => (
                                  <th
                                    key={h.label}
                                    onClick={h.key ? () => setVulnSort(h.key) : undefined}
                                    className={`px-5 py-3.5 text-left text-xs font-semibold text-[#94A3B8] uppercase tracking-wider ${h.key ? "cursor-pointer hover:text-[#F9FAFB] transition-colors select-none" : ""}`}
                                  >
                                    <span className="inline-flex items-center gap-1">
                                      {h.label}
                                      {h.key && vulnSort === h.key && <ChevronDown size={12} className="text-[#7C3AED]" />}
                                    </span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sorted.map((v, i) => (
                                <tr
                                  key={v.id || i}
                                  className="vuln-row hover:bg-white/[0.04] transition-all duration-200"
                                  style={{
                                    borderBottom:
                                      i < sorted.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                                  }}
                                >
                                  <td className="px-5 py-4 text-[#F9FAFB] font-medium">{v.type}</td>
                                  <td className="px-5 py-4">
                                    <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${sevStyle(v.severity)}`}>
                                      {v.severity}
                                    </span>
                                  </td>
                                  <td className="px-5 py-4 font-mono text-sm font-bold" style={{
                                    color: v.cvssScore >= 9 ? "#F87171" : v.cvssScore >= 7 ? "#FB923C" : v.cvssScore >= 4 ? "#FBBF24" : "#60A5FA"
                                  }}>{v.cvssScore}</td>
                                  <td className="px-5 py-4 font-mono text-xs text-[#94A3B8] max-w-[300px] truncate">{v.endpoint}</td>
                                  <td className="px-5 py-4 text-xs text-[#94A3B8]">{v.owaspCategory || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── FULL REPORT TAB ── */}
        {tab === "report" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Scan selector */}
            {scans.filter((s) => s.status === "completed").length > 0 && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-[#a78bfa]/60">Scan:</label>
                <select
                  value={selectedScan?.scanId || ""}
                  onChange={(e) => { selectScan(e.target.value); setExpandedFindings(new Set()); setFilterSeverity(new Set()); setFilterOwasp(new Set()); setFilterType(new Set()); }}
                  className="px-3 py-1.5 rounded-lg text-sm text-[#f3e8ff] focus:outline-none cursor-pointer"
                  style={{ background: "rgba(5,0,8,0.6)", border: "1px solid rgba(168,85,247,0.15)" }}
                >
                  {scans.filter((s) => s.status === "completed").map((s) => (
                    <option key={s.scanId} value={s.scanId}>
                      {s.scanName || s.targetUrl} — {timeAgo(s.createdAt)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!selectedScan || selectedScan.status !== "completed" ? (
              <div className="p-12 rounded-xl text-center" style={glass}>
                <FileText size={48} className="mx-auto mb-4 text-[#94A3B8]/40" />
                <p className="text-[#94A3B8]">
                  {selectedScan?.status === "running"
                    ? "Scan in progress — the full report will appear when complete."
                    : "No completed scans yet. Run a scan to generate a full report."}
                </p>
              </div>
            ) : (
              <>
                {/* ── Scan Summary ── */}
                <div className="rounded-xl p-6" style={glass}>
                  <div className="flex items-center gap-2 mb-5">
                    <FileText size={18} className="text-[#7C3AED]" />
                    <h2 className="text-lg font-bold text-[#F9FAFB]">Scan Summary</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
                    {[
                      { icon: <Globe size={14} />, label: "Target", value: selectedScan.summary?.target || selectedScan.targetUrl },
                      { icon: <Info size={14} />, label: "Scan ID", value: selectedScan.summary?.scanId || selectedScan.scanId },
                      { icon: <Clock size={14} />, label: "Start Time", value: selectedScan.summary?.startTime ? new Date(selectedScan.summary.startTime).toLocaleString() : "—" },
                      { icon: <Clock size={14} />, label: "End Time", value: selectedScan.summary?.endTime ? new Date(selectedScan.summary.endTime).toLocaleString() : "—" },
                      { icon: <Target size={14} />, label: "Endpoints Scanned", value: selectedScan.summary?.totalEndpoints ?? "—" },
                      { icon: <ShieldAlert size={14} />, label: "Total Findings", value: selectedScan.summary?.totalFindings ?? selectedScan.vulnerabilityCount ?? "—" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={glassSubtle}>
                        <span className="text-[#7C3AED] mt-0.5 shrink-0">{item.icon}</span>
                        <div>
                          <div className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-0.5">{item.label}</div>
                          <div className="text-sm text-[#F9FAFB] font-mono break-all">{String(item.value)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Agents Run */}
                  {selectedScan.summary?.agentsRun?.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Cpu size={12} /> Agents Executed
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedScan.summary.agentsRun.map((agent) => (
                          <span key={agent}
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold border`}
                            style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", color: "#A78BFA" }}>
                            {agent}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Severity summary bar */}
                  <div className="grid grid-cols-4 gap-3 mt-5">
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
                </div>

                {/* ── Findings ── */}
                <div>
                  {/* Sort + Filter toolbar */}
                  <div className="space-y-3 mb-4">
                    {/* Row 1 — title + sort */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <h2 className="text-lg font-bold text-[#F9FAFB] flex items-center gap-2">
                        <Bug size={18} className="text-[#F87171]" />
                        Findings{" "}
                        <span className="text-sm font-normal text-[#94A3B8]">
                          {(filterSeverity.size || filterOwasp.size || filterType.size)
                            ? `${selectedScan.vulnerabilities.filter((v) => {
                                if (filterSeverity.size && !filterSeverity.has(v.severity)) return false;
                                if (filterOwasp.size   && !filterOwasp.has(v.owaspCategory))  return false;
                                if (filterType.size    && !filterType.has(v.type))             return false;
                                return true;
                              }).length} / ${selectedScan.vulnerabilities?.length || 0}`
                            : selectedScan.vulnerabilities?.length || 0}
                        </span>
                      </h2>
                      {/* Sort controls */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#94A3B8] shrink-0">Sort by:</span>
                        {[
                          { key: "severity", label: "Severity" },
                          { key: "owasp",    label: "OWASP" },
                          { key: "type",     label: "Type" },
                        ].map((opt) => (
                          <button
                            key={opt.key}
                            onClick={() => setReportSort(opt.key)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-all duration-150"
                            style={
                              reportSort === opt.key
                                ? { background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.35)", color: "#A78BFA" }
                                : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#94A3B8" }
                            }
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Row 2 — filter dropdowns */}
                    {(() => {
                      const vulns = selectedScan.vulnerabilities || [];
                      const SEV_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3, Info: 4 };
                      const uniqueSev   = [...new Set(vulns.map((v) => v.severity).filter(Boolean))].sort((a, b) => (SEV_ORDER[a] ?? 5) - (SEV_ORDER[b] ?? 5));
                      const uniqueOwasp = [...new Set(vulns.map((v) => v.owaspCategory).filter(Boolean))].sort();
                      const uniqueType  = [...new Set(vulns.map((v) => v.type).filter(Boolean))].sort();

                      const sevColors = {
                        Critical: "#F87171", High: "#FB923C", Medium: "#FBBF24", Low: "#60A5FA", Info: "#94A3B8",
                      };

                      const toggle = (setter, val) => {
                        setter((prev) => {
                          const next = new Set(prev);
                          if (next.has(val)) next.delete(val); else next.add(val);
                          return next;
                        });
                      };

                      const hasAnyFilter = filterSeverity.size || filterOwasp.size || filterType.size;

                      const dropdownStyle = {
                        background: "#111827",
                        border: "1px solid rgba(255,255,255,0.10)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                      };

                      const configs = [
                        {
                          id: "severity",
                          label: "Severity",
                          options: uniqueSev,
                          active: filterSeverity,
                          setter: setFilterSeverity,
                          getColor: (o) => sevColors[o] || "#94A3B8",
                          accentBorder: "rgba(248,113,113,0.35)",
                        },
                        {
                          id: "owasp",
                          label: "OWASP",
                          options: uniqueOwasp,
                          active: filterOwasp,
                          setter: setFilterOwasp,
                          getColor: () => "#A78BFA",
                          accentBorder: "rgba(124,58,237,0.35)",
                        },
                        {
                          id: "type",
                          label: "Type",
                          options: uniqueType,
                          active: filterType,
                          setter: setFilterType,
                          getColor: () => "#60A5FA",
                          accentBorder: "rgba(59,130,246,0.35)",
                        },
                      ];

                      return (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-[#94A3B8] shrink-0">Filter:</span>
                          {configs.map(({ id, label, options, active, setter, getColor, accentBorder }) => {
                            const isOpen = openDropdown === id;
                            const selectedCount = active.size;
                            return (
                              <div key={id} className="relative" data-filter-dropdown>
                                {/* Trigger button */}
                                <button
                                  onClick={() => setOpenDropdown(isOpen ? null : id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150"
                                  style={
                                    selectedCount > 0
                                      ? { background: "rgba(124,58,237,0.15)", border: `1px solid ${accentBorder}`, color: "#F9FAFB" }
                                      : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#94A3B8" }
                                  }
                                >
                                  {label}
                                  {selectedCount > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                                      style={{ background: "rgba(124,58,237,0.3)", color: "#A78BFA" }}>
                                      {selectedCount}
                                    </span>
                                  )}
                                  <ChevronDown size={12} className={`transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
                                </button>

                                {/* Dropdown panel */}
                                {isOpen && options.length > 0 && (
                                  <div
                                    className="absolute left-0 top-full mt-1.5 z-50 rounded-xl overflow-hidden min-w-[180px]"
                                    style={dropdownStyle}
                                  >
                                    {/* Select all / clear row */}
                                    <div className="flex items-center justify-between px-3 py-2"
                                      style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569]">{label}</span>
                                      <button
                                        onClick={() => setter(active.size === options.length ? new Set() : new Set(options))}
                                        className="text-[10px] cursor-pointer transition-colors"
                                        style={{ color: "#7C3AED" }}
                                      >
                                        {active.size === options.length ? "Clear" : "All"}
                                      </button>
                                    </div>
                                    {/* Options */}
                                    <div className="py-1 max-h-56 overflow-y-auto">
                                      {options.map((opt) => {
                                        const checked = active.has(opt);
                                        const color = getColor(opt);
                                        return (
                                          <label
                                            key={opt}
                                            className="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors hover:bg-white/[0.04]"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              onChange={() => toggle(setter, opt)}
                                              className="rounded cursor-pointer accent-[#7C3AED]"
                                            />
                                            <span className="text-xs font-medium" style={{ color: checked ? color : "#94A3B8" }}>
                                              {opt}
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Clear all */}
                          {hasAnyFilter && (
                            <button
                              onClick={() => { setFilterSeverity(new Set()); setFilterOwasp(new Set()); setFilterType(new Set()); }}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#F87171" }}
                            >
                              ✕ Clear
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {!selectedScan.vulnerabilities?.length ? (
                    <div className="p-8 rounded-xl text-center" style={glass}>
                      <CheckCircle2 size={32} className="mx-auto mb-3 text-green-400" />
                      <p className="text-[#94A3B8] text-sm">No vulnerabilities found in this scan.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(() => {
                        const SEV_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3, Info: 4 };

                        // Apply filters first
                        const filtered = selectedScan.vulnerabilities.filter((v) => {
                          if (filterSeverity.size && !filterSeverity.has(v.severity)) return false;
                          if (filterOwasp.size   && !filterOwasp.has(v.owaspCategory))  return false;
                          if (filterType.size    && !filterType.has(v.type))             return false;
                          return true;
                        });

                        const sorted = [...filtered].sort((a, b) => {
                          if (reportSort === "severity") {
                            const diff = (SEV_ORDER[a.severity] ?? 5) - (SEV_ORDER[b.severity] ?? 5);
                            return diff !== 0 ? diff : (b.cvssScore || 0) - (a.cvssScore || 0);
                          }
                          if (reportSort === "owasp") {
                            return (a.owaspCategory || "").localeCompare(b.owaspCategory || "");
                          }
                          if (reportSort === "type") {
                            return (a.type || "").localeCompare(b.type || "");
                          }
                          return 0;
                        });

                        if (sorted.length === 0) {
                          return (
                            <div className="p-8 rounded-xl text-center" style={glass}>
                              <ShieldAlert size={32} className="mx-auto mb-3 text-[#94A3B8]/40" />
                              <p className="text-[#94A3B8] text-sm">No findings match the current filters.</p>
                              <button
                                onClick={() => { setFilterSeverity(new Set()); setFilterOwasp(new Set()); setFilterType(new Set()); }}
                                className="mt-3 text-xs text-[#7C3AED] hover:text-[#A78BFA] cursor-pointer transition-colors"
                              >
                                Clear filters
                              </button>
                            </div>
                          );
                        }

                        // Group headers for owasp / type sorts
                        const showGroups = reportSort === "owasp" || reportSort === "type";
                        const getGroup = (v) =>
                          reportSort === "owasp" ? (v.owaspCategory || "Uncategorized") : (v.type || "Unknown");

                        let lastGroup = null;
                        return sorted.map((v, idx) => {
                          const isExpanded = expandedFindings.has(v.id);
                          const toggleExpand = () => {
                            setExpandedFindings((prev) => {
                              const next = new Set(prev);
                              if (next.has(v.id)) next.delete(v.id);
                              else next.add(v.id);
                              return next;
                            });
                          };
                          const group = showGroups ? getGroup(v) : null;
                          const showGroupHeader = showGroups && group !== lastGroup;
                          if (showGroups) lastGroup = group;

                          return (
                            <div key={v.id || idx}>
                              {/* Group header */}
                              {showGroupHeader && (
                                <div className="flex items-center gap-3 mt-4 mb-2 first:mt-0">
                                  <div className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                                    style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", color: "#A78BFA" }}>
                                    {group}
                                  </div>
                                  <div className="flex-1 h-px" style={{ background: "rgba(124,58,237,0.12)" }} />
                                </div>
                              )}

                              <div className="rounded-xl overflow-hidden min-w-0" style={glass}>
                                {/* Finding header */}
                                <button
                                  onClick={toggleExpand}
                                  className="w-full flex items-center gap-3 px-5 py-4 text-left cursor-pointer hover:bg-white/[0.03] transition-colors min-w-0"
                                >
                                  <span className={`text-xs px-2.5 py-1 rounded-full border font-bold shrink-0 ${sevStyle(v.severity)}`}>
                                    {v.severity}
                                  </span>
                                  <span className="flex-1 text-sm font-semibold text-[#F9FAFB] min-w-0 truncate">
                                    {v.type}
                                    {v.needsManualVerification && (
                                      <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)", color: "#FBBF24" }}>
                                        Needs Manual Verification
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-xs font-mono text-[#94A3B8] shrink-0 hidden sm:block truncate max-w-[200px]">{v.endpoint}</span>
                                  <span className="text-xs text-[#94A3B8] shrink-0 hidden md:block truncate max-w-[140px]">{v.owaspCategory || "—"}</span>
                                  <span className="text-xs font-mono font-bold shrink-0" style={{
                                    color: v.cvssScore >= 9 ? "#F87171" : v.cvssScore >= 7 ? "#FB923C" : v.cvssScore >= 4 ? "#FBBF24" : "#60A5FA"
                                  }}>
                                    CVSS {v.cvssScore}
                                  </span>
                                  {isExpanded
                                    ? <ChevronDown size={16} className="text-[#94A3B8] shrink-0" />
                                    : <ChevronRight size={16} className="text-[#94A3B8] shrink-0" />}
                                </button>

                            {/* Expanded full detail */}
                            {isExpanded && (
                              <div className="px-5 pb-6 space-y-5 min-w-0 overflow-x-hidden"
                                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>

                                {/* Meta row */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
                                  {[
                                    { label: "ID", value: v.id },
                                    { label: "OWASP", value: v.owaspCategory || "—" },
                                    { label: "Parameter", value: v.parameter || "N/A" },
                                    { label: "Confidence", value: v.confidenceScore != null ? `${Math.round(v.confidenceScore * 100)}%${v.needsManualVerification ? ' ⚠️' : ''}` : "—" },
                                  ].map((m) => (
                                    <div key={m.label} className="p-3 rounded-lg" style={glassSubtle}>
                                      <div className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-0.5">{m.label}</div>
                                      <div className="text-xs text-[#F9FAFB] font-mono break-all">{m.value}</div>
                                    </div>
                                  ))}
                                </div>

                                {/* Manual verification warning */}
                                {v.needsManualVerification && (
                                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#FBBF24" }}>
                                    <span>⚠️</span> This finding could not be fully confirmed and may be a false positive — <span className="underline">Needs Manual Verification</span>
                                  </div>
                                )}

                                {/* Endpoint */}
                                <div className="p-3 rounded-lg" style={glassSubtle}>
                                  <div className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                    <Globe size={10} /> Endpoint
                                  </div>
                                  <div className="text-xs text-[#60A5FA] font-mono break-all">{v.endpoint}</div>
                                </div>

                                {/* Description */}
                                {v.description && (
                                  <div>
                                    <div className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                      <Info size={12} /> Description
                                    </div>
                                    <p className="text-sm text-[#CBD5E1] leading-relaxed">{v.description}</p>
                                  </div>
                                )}

                                {/* Evidence */}
                                {v.evidence && (
                                  <div className="p-3 rounded-lg overflow-hidden" style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)" }}>
                                    <div className="text-xs font-semibold text-[#FBBF24] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                      <Eye size={12} /> Evidence
                                    </div>
                                    <p className="text-sm text-[#CBD5E1] font-mono leading-relaxed break-all overflow-wrap-anywhere" style={{ overflowWrap: "anywhere", wordBreak: "break-all" }}>{v.evidence}</p>
                                  </div>
                                )}

                                {/* Exploit Scenario */}
                                {v.exploitScenario && (
                                  <div className="p-3 rounded-lg overflow-hidden" style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.15)" }}>
                                    <div className="text-xs font-semibold text-[#F87171] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                      <FlaskConical size={12} /> Exploit Scenario
                                    </div>
                                    <p className="text-sm text-[#CBD5E1] leading-relaxed" style={{ overflowWrap: "anywhere" }}>{v.exploitScenario}</p>
                                  </div>
                                )}

                                {/* Impact */}
                                {v.impact && (
                                  <div className="p-3 rounded-lg overflow-hidden" style={{ background: "rgba(251,146,60,0.05)", border: "1px solid rgba(251,146,60,0.15)" }}>
                                    <div className="text-xs font-semibold text-[#FB923C] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                      <AlertTriangle size={12} /> Impact
                                    </div>
                                    <p className="text-sm text-[#CBD5E1] leading-relaxed" style={{ overflowWrap: "anywhere" }}>{v.impact}</p>
                                  </div>
                                )}

                                {/* Remediation */}
                                {v.remediation && (
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-[#22C55E] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                      <Wrench size={12} /> Remediation
                                    </div>
                                    <div className="p-4 rounded-xl overflow-hidden" style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)", overflowWrap: "anywhere" }}>
                                      {renderMarkdown(v.remediation)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                              </div>
                            </div>
                        );
                        });
                      })()}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── AGENTS TAB ── */}
        {tab === "agents" && (
          <div className="space-y-4 animate-fadeIn">
            {/* Scan selector for logs */}
            {scans.length > 0 && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-[#a78bfa]/60">Scan:</label>
                <select
                  value={selectedScan?.scanId || ""}
                  onChange={(e) => selectScan(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-sm text-[#f3e8ff] focus:outline-none cursor-pointer"
                  style={{ background: "rgba(5,0,8,0.6)", border: "1px solid rgba(168,85,247,0.15)" }}
                >
                  {scans.map((s) => (
                    <option key={s.scanId} value={s.scanId}>
                      {s.scanName || s.targetUrl} ({s.status}) — {timeAgo(s.createdAt)}
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
                    zerotrace — {selectedScan.scanName || selectedScan.targetUrl} ({selectedScan.status})
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
        {/* ── EXTENSION REPORTS TAB ── */}
        {tab === "extension" && (
          <div className="space-y-4">
            {/* Header row with refresh */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#94A3B8]">Reports uploaded from the ZeroTrace VS Code extension</p>
              <button
                onClick={fetchExtReports}
                disabled={extReportsLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", color: "#A78BFA" }}
              >
                <RefreshCw size={13} className={extReportsLoading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
            {extReportsLoading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 size={36} className="animate-spin text-[#7C3AED]" />
              </div>
            ) : extReports.length === 0 ? (
              <div className="p-12 rounded-xl text-center" style={glass}>
                <Package size={48} className="mx-auto mb-4 text-[#94A3B8]/40" />
                <p className="text-[#94A3B8] mb-2">No extension reports yet.</p>
                <p className="text-xs text-[#475569]">
                  Run a scan from the ZeroTrace VS Code extension and it will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* ── Report list (left panel) ── */}
                <div className="lg:col-span-1 space-y-2">
                  {extReports.map((r) => {
                    const risk = riskLabel(r.riskScore);
                    const isSelected = selectedExtReport?.meta?.scanId === r.scanId;
                    return (
                      <div
                        key={r.scanId}
                        role="button"
                        tabIndex={0}
                        onClick={() => selectExtReport(r)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectExtReport(r); }}
                        className="w-full text-left px-4 py-3.5 rounded-xl transition-all duration-200 cursor-pointer"
                        style={{
                          background: isSelected ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.04)",
                          border: isSelected
                            ? "1px solid rgba(124,58,237,0.35)"
                            : "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${risk.bg} ${risk.color}`}>
                            {risk.label}
                          </span>
                          <span className="text-xs text-[#475569]">{timeAgo(r.createdAt)}</span>
                        </div>
                        <div className="text-sm text-[#F9FAFB] font-mono truncate">
                          {(r.targetPath || "").split(/[/\\]/).slice(-2).join("/")}
                        </div>
                        <div className="text-xs text-[#94A3B8] mt-0.5 truncate">{r.targetPath}</div>
                        <div className="flex gap-3 mt-2 text-xs text-[#94A3B8]">
                          <span className="text-red-400 font-semibold">{r.bySeverity?.critical ?? 0} crit</span>
                          <span className="text-orange-400 font-semibold">{r.bySeverity?.high ?? 0} high</span>
                          <span className="text-yellow-400 font-semibold">{r.bySeverity?.medium ?? 0} med</span>
                          <span className="ml-auto">{r.vulnerabilityCount} total</span>
                          <button
                            onClick={(e) => deleteExtReport(r.scanId, e)}
                            disabled={deletingExtReport === r.scanId}
                            title="Delete report"
                            className="ml-1 text-[#475569] hover:text-red-400 transition-colors disabled:opacity-40"
                          >
                            {deletingExtReport === r.scanId ? '…' : '🗑'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── HTML report viewer (right panel) ── */}
                <div className="lg:col-span-2">
                  {!selectedExtReport ? (
                    <div className="flex items-center justify-center h-full min-h-[400px] rounded-xl" style={glass}>
                      <div className="text-center">
                        <FileText size={40} className="mx-auto mb-3 text-[#94A3B8]/40" />
                        <p className="text-sm text-[#94A3B8]">Select a report to view it</p>
                      </div>
                    </div>
                  ) : extReportHtmlLoading ? (
                    <div className="flex items-center justify-center h-full min-h-[400px] rounded-xl" style={glass}>
                      <Loader2 size={32} className="animate-spin text-[#7C3AED]" />
                    </div>
                  ) : (
                    <div className="rounded-xl overflow-hidden" style={{ ...glass, height: "75vh" }}>
                      {/* toolbar */}
                      <div
                        className="flex items-center gap-3 px-5 py-3 shrink-0"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
                      >
                        <FileText size={15} className="text-[#7C3AED]" />
                        <span className="text-sm font-medium text-[#F9FAFB] truncate flex-1">
                          {selectedExtReport.meta.targetPath}
                        </span>
                        <span className="text-xs text-[#94A3B8]">{timeAgo(selectedExtReport.meta.createdAt)}</span>
                        <a
                          href={`${import.meta.env.VITE_API_URL ?? "http://localhost:5000/api"}/extension/reports/${selectedExtReport.meta.scanId}/html?token=${encodeURIComponent(localStorage.getItem('vexstorm_token') ?? '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer text-[#A78BFA] hover:text-white"
                          style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)" }}
                        >
                          Open full page ↗
                        </a>
                      </div>
                      {/* iframe */}
                      {selectedExtReport.html ? (
                        <iframe
                          title="ZeroTrace Extension Report"
                          srcDoc={selectedExtReport.html}
                          sandbox="allow-scripts allow-same-origin"
                          className="w-full border-0"
                          style={{ height: "calc(75vh - 48px)" }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-sm text-red-400">
                          Report HTML is empty.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── GITHUB SCAN TAB ── */}
        {tab === "github" && (
          <div className="space-y-6">
            {/* ── Scan Form ── */}
            <div className="rounded-2xl p-6" style={glass}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)" }}>
                  <Github size={18} className="text-[#A78BFA]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#F9FAFB]">Scan a GitHub Repository</h2>
                  <p className="text-xs text-[#94A3B8]">Multi-agent AI security analysis — pattern scan + Mistral AI deep analysis + HTML report</p>
                </div>
              </div>
              <form onSubmit={handleGithubScan} className="space-y-4">
                {/* Repo URL */}
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5 uppercase tracking-wider">
                    GitHub Repository URL <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" />
                    <input
                      type="text"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/owner/repo"
                      required
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-[#F9FAFB] placeholder-[#475569] outline-none focus:ring-1 focus:ring-[#7C3AED]/50 transition-all"
                      style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(168,85,247,0.2)" }}
                    />
                  </div>
                </div>
                {/* Branch + Token (optional) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5 uppercase tracking-wider">
                      Branch <span className="text-[#475569] font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <GitBranch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" />
                      <input
                        type="text"
                        value={githubBranch}
                        onChange={(e) => setGithubBranch(e.target.value)}
                        placeholder="main"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-[#F9FAFB] placeholder-[#475569] outline-none focus:ring-1 focus:ring-[#7C3AED]/50 transition-all"
                        style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(168,85,247,0.2)" }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5 uppercase tracking-wider">
                      GitHub Token <span className="text-[#475569] font-normal">(private repos)</span>
                    </label>
                    <div className="relative">
                      <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" />
                      <input
                        type="password"
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxx"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-[#F9FAFB] placeholder-[#475569] outline-none focus:ring-1 focus:ring-[#7C3AED]/50 transition-all"
                        style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(168,85,247,0.2)" }}
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!githubUrl.trim() || githubScanSubmitting}
                  className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #3B82F6)", boxShadow: "0 4px 20px rgba(124,58,237,0.35)" }}
                >
                  {githubScanSubmitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Initializing scan...</>
                  ) : (
                    <><Github size={16} /> Scan Repository</>
                  )}
                </button>
              </form>
            </div>

            {/* ── Scan List + Viewer ── */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#94A3B8]">Your GitHub repository scans</p>
              <button
                onClick={fetchGithubScans}
                disabled={githubScansLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", color: "#A78BFA" }}
              >
                <RefreshCw size={13} className={githubScansLoading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>

            {githubScansLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={36} className="animate-spin text-[#7C3AED]" />
              </div>
            ) : githubScans.length === 0 ? (
              <div className="p-12 rounded-xl text-center" style={glass}>
                <Github size={48} className="mx-auto mb-4 text-[#94A3B8]/40" />
                <p className="text-[#94A3B8] mb-2">No GitHub scans yet.</p>
                <p className="text-xs text-[#475569]">Enter a GitHub repository URL above to start a security scan.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* ── Scan list ── */}
                <div className="lg:col-span-1 space-y-2">
                  {githubScans.map((s) => {
                    const risk       = riskLabel(s.riskScore);
                    const isSelected = selectedGithubScan?.meta?.scanId === s.scanId;
                    const isRunning  = s.status === "running";
                    const isFailed   = s.status === "failed";
                    return (
                      <div
                        key={s.scanId}
                        role="button"
                        tabIndex={0}
                        onClick={() => selectGithubScan(s)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") selectGithubScan(s); }}
                        className="w-full text-left px-4 py-3.5 rounded-xl transition-all duration-200 cursor-pointer"
                        style={{
                          background: isSelected ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.04)",
                          border: isSelected ? "1px solid rgba(124,58,237,0.35)" : "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          {isRunning ? (
                            <span className="flex items-center gap-1.5 text-xs text-[#A78BFA] font-semibold">
                              <Loader2 size={11} className="animate-spin" /> Scanning...
                            </span>
                          ) : isFailed ? (
                            <span className="text-xs text-red-400 font-semibold">Failed</span>
                          ) : (
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${risk.bg} ${risk.color}`}>
                              {risk.label}
                            </span>
                          )}
                          <span className="text-xs text-[#475569]">{timeAgo(s.createdAt)}</span>
                        </div>
                        <div className="text-sm text-[#F9FAFB] font-mono truncate flex items-center gap-1.5">
                          <Github size={12} className="text-[#7C3AED] shrink-0" />
                          {(s.repoUrl || "").replace("https://github.com/", "")}
                        </div>
                        {s.branch && (
                          <div className="flex items-center gap-1 text-xs text-[#475569] mt-0.5">
                            <GitBranch size={10} /> {s.branch}
                          </div>
                        )}
                        {isRunning && s.progressMessage && (
                          <div className="text-xs text-[#A78BFA] mt-1 truncate">{s.progressMessage}</div>
                        )}
                        {!isRunning && !isFailed && (
                          <div className="flex gap-3 mt-2 text-xs text-[#94A3B8]">
                            <span className="text-red-400 font-semibold">{s.bySeverity?.critical ?? 0} crit</span>
                            <span className="text-orange-400 font-semibold">{s.bySeverity?.high ?? 0} high</span>
                            <span className="text-yellow-400 font-semibold">{s.bySeverity?.medium ?? 0} med</span>
                            <span className="ml-auto">{s.vulnerabilityCount} total</span>
                          </div>
                        )}
                        <button
                          onClick={(e) => deleteGithubScan(s.scanId, e)}
                          disabled={deletingGithubScan === s.scanId}
                          title="Delete scan"
                          className="mt-1 text-[#475569] hover:text-red-400 transition-colors disabled:opacity-40 text-xs"
                        >
                          {deletingGithubScan === s.scanId ? "…" : "🗑"}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* ── Report viewer ── */}
                <div className="lg:col-span-2">
                  {!selectedGithubScan ? (
                    <div className="flex items-center justify-center h-full min-h-[400px] rounded-xl" style={glass}>
                      <div className="text-center">
                        <Github size={40} className="mx-auto mb-3 text-[#94A3B8]/40" />
                        <p className="text-sm text-[#94A3B8]">Select a scan to view the report</p>
                      </div>
                    </div>
                  ) : selectedGithubScan.meta?.status === "running" ? (
                    /* Live progress panel */
                    <div className="rounded-2xl p-6 min-h-[400px]" style={glass}>
                      <div className="flex items-center gap-3 mb-6">
                        <Loader2 size={20} className="animate-spin text-[#7C3AED]" />
                        <div>
                          <div className="text-sm font-bold text-[#F9FAFB]">Scan in progress...</div>
                          <div className="text-xs text-[#94A3B8]">
                            {selectedGithubScan.meta?.progressMessage || selectedGithubScan.liveLogs?.slice(-1)[0] || "Initializing..."}
                          </div>
                        </div>
                      </div>
                      {/* Stage indicator */}
                      {selectedGithubScan.meta?.currentStage && (
                        <div className="mb-4 px-3 py-2 rounded-lg text-xs font-mono text-[#A78BFA]"
                          style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)" }}>
                          Stage: {selectedGithubScan.meta.currentStage}
                        </div>
                      )}
                      {/* Live logs */}
                      <div className="rounded-xl p-3 max-h-64 overflow-y-auto font-mono text-[10px] space-y-0.5"
                        style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        {(selectedGithubScan.liveLogs || []).length === 0 ? (
                          <div className="text-[#475569]">Waiting for logs...</div>
                        ) : (
                          (selectedGithubScan.liveLogs || []).map((l, i) => (
                            <div key={i} className="text-[#94A3B8] leading-relaxed">{l}</div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : selectedGithubScan.meta?.status === "failed" ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[400px] rounded-xl" style={glass}>
                      <AlertCircle size={40} className="mb-3 text-red-400" />
                      <p className="text-sm text-red-400 font-semibold">Scan Failed</p>
                      <p className="text-xs text-[#94A3B8] mt-1">
                        {(selectedGithubScan.meta?.errors || [])[0] || "Unknown error occurred"}
                      </p>
                    </div>
                  ) : githubHtmlLoading ? (
                    <div className="flex items-center justify-center h-full min-h-[400px] rounded-xl" style={glass}>
                      <Loader2 size={32} className="animate-spin text-[#7C3AED]" />
                    </div>
                  ) : (
                    <div className="rounded-xl overflow-hidden" style={{ ...glass, height: "75vh" }}>
                      {/* Toolbar */}
                      <div
                        className="flex items-center gap-3 px-5 py-3 shrink-0"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
                      >
                        <Github size={15} className="text-[#7C3AED]" />
                        <span className="text-sm font-medium text-[#F9FAFB] truncate flex-1 font-mono">
                          {(selectedGithubScan.meta?.repoUrl || "").replace("https://github.com/", "")}
                        </span>
                        <span className="text-xs text-[#94A3B8]">{timeAgo(selectedGithubScan.meta?.createdAt)}</span>
                        <a
                          href={`${import.meta.env.VITE_API_URL ?? "http://localhost:5000/api"}/github/scans/${selectedGithubScan.meta?.scanId}/html?token=${encodeURIComponent(localStorage.getItem("vexstorm_token") ?? "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer text-[#A78BFA] hover:text-white"
                          style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)" }}
                        >
                          Open full page ↗
                        </a>
                      </div>
                      {/* iframe */}
                      {selectedGithubScan.html ? (
                        <iframe
                          title="GitHub Security Scan Report"
                          srcDoc={selectedGithubScan.html}
                          sandbox="allow-scripts allow-same-origin"
                          className="w-full border-0"
                          style={{ height: "calc(75vh - 48px)" }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-sm text-[#94A3B8]">
                          <div className="text-center">
                            <FileText size={32} className="mx-auto mb-2 opacity-40" />
                            <p>Select a completed scan to view the HTML report</p>
                          </div>
                        </div>
                      )}
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
