<div align="center">
  <img src="client/public/zerotrace.png" alt="ZeroTrace Logo" width="120" />

  <h1>ZeroTrace</h1>
  <p><strong>Multi-Agent AI Security Scanner powered by Mistral AI</strong></p>

  <p>
    <img src="https://img.shields.io/badge/AI-Mistral-7c3aed?style=flat-square&logo=ai&logoColor=white" />
    <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black" />
    <img src="https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js&logoColor=white" />
    <img src="https://img.shields.io/badge/MongoDB-Mongoose-47a248?style=flat-square&logo=mongodb&logoColor=white" />
    <a href="https://marketplace.visualstudio.com/items?itemName=santhsim.zerotrace"><img src="https://img.shields.io/badge/VS%20Code-Install%20Extension-007acc?style=flat-square&logo=visualstudiocode&logoColor=white" /></a>
    <img src="https://img.shields.io/visual-studio-marketplace/v/santhsim.zerotrace?style=flat-square&label=Marketplace&logo=visualstudiocode&color=007acc" />
    <img src="https://img.shields.io/visual-studio-marketplace/i/santhsim.zerotrace?style=flat-square&label=Installs&color=007acc" />
    <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" />
  </p>

  <p>
    ZeroTrace is an end-to-end AI-powered security platform that scans codebases, web targets, and GitHub repositories for vulnerabilities — from your editor, your browser, or the command line.
  </p>
<p>
  <strong>Live Deployments</strong><br/><br/>

  <strong>Frontend (Primary):</strong><br/>
  <a href="http://hackathon.acrossthe.cloud/" target="_blank">
    http://hackathon.acrossthe.cloud/
  </a>
  <br/><br/>

  <strong>Frontend (Render Mirror):</strong><br/>
  <a href="https://vexstorm-hackathon-1.onrender.com/" target="_blank">
    https://vexstorm-hackathon-1.onrender.com/
  </a>
  <br/><br/>

  <strong>Backend API:</strong><br/>
  <a href="https://vexstorm-hackathon-2.onrender.com/" target="_blank">
    https://vexstorm-hackathon-2.onrender.com/
  </a>
</p>
</div>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Server Setup](#2-server-setup)
  - [3. Client Setup](#3-client-setup)
  - [4. VS Code Extension Setup](#4-vs-code-extension-setup)
  - [5. Test App (Vulnerable Target)](#5-test-app-vulnerable-target)
- [Environment Variables](#environment-variables)
- [Available Commands](#available-commands)
- [API Reference](#api-reference)
- [Agents](#agents)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

ZeroTrace is a three-part security platform:

| Component | Description |
|---|---|
| **Web Dashboard** (`client/`) | React SPA — view scans, manage history, authenticate |
| **API Server** (`server/`) | Express + MongoDB — orchestrates multi-agent scans, stores results |
| **VS Code Extension** (`extension/`) | Scan open workspaces locally, push reports to the dashboard |
| **Test App** (`test/`) | Next.js app with intentional vulnerabilities for local testing |

The core intelligence is a **multi-agent pipeline** where specialized AI agents each handle a distinct security domain, coordinated by an Orchestrator using Mistral AI for reasoning, payload generation, and remediation planning.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        ZeroTrace Platform                      │
│                                                                │
│   ┌──────────────────┐       ┌──────────────────────────────┐  │
│   │  Client (React)  │◄─────►│     Server (Express API)     │  │
│   │  localhost:5173  │  JWT  │       localhost:5000         │  │
│   └──────────────────┘       └──────────┬───────────────────┘  │
│                                         │                      │
│   ┌──────────────────┐       ┌──────────▼───────────────────┐  │
│   │  VS Code Ext.    │──────►│      Orchestrator Engine     │  │
│   │  (ZeroTrace)     │ HTTP  │  PlannerAgent → AgentPool    │  │
│   └──────────────────┘       └──────────┬───────────────────┘  │
│                                         │                      │
│                              ┌──────────▼───────────────────┐  │
│                              │       Mistral AI (LLM)        │  │
│                              │  Reasoning · Payloads · Fix   │  │
│                              └──────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### Scan Lifecycle

```
Target URL / Codebase
        │
        ▼
  1. Reconnaissance   →  Surface mapping, URL crawl, form discovery
  2. AI Planning      →  LLM prioritizes attack surface
  3. Agent Scanning   →  Parallel specialized vulnerability agents
  4. Risk Scoring     →  CVSS-like severity enrichment
  5. AI Remediation   →  Context-aware code fix generation
  6. Report           →  Structured HTML + JSON report
```

---

## Project Structure

```
VEXSTORM_HACKATHON/
├── client/                     # React + Vite frontend
│   ├── public/
│   │   ├── zerotrace.png       # App logo / meta image
│   │   └── logo.png
│   ├── src/
│   │   ├── api/                # Axios API wrappers
│   │   ├── assets/
│   │   ├── components/         # Navbar, ProtectedRoute, etc.
│   │   ├── context/            # AuthContext
│   │   └── pages/              # Landing, Login, Signup, Dashboard
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── server/                     # Express.js API backend
│   ├── agents/                 # Security agents (injection, xss, auth…)
│   ├── engine/                 # RiskEngine, ValidationEngine
│   ├── github/                 # GitHub repo scanner pipeline
│   ├── intelligence/           # FindingsStore, ScanMemory
│   ├── llm/                    # mistralClient.js
│   ├── middleware/             # JWT auth middleware
│   ├── models/                 # Mongoose schemas
│   ├── orchestrator/           # AgentRegistry, Orchestrator
│   ├── reporting/              # Report generation
│   ├── routes/                 # auth, scans, extension, github, user
│   ├── tools/                  # Reusable scan utilities
│   ├── utils/
│   ├── index.js                # App entry point
│   └── package.json
│
├── extension/                  # VS Code extension
│   ├── agents/                 # Local scan agents
│   ├── media/                  # Webview HTML templates
│   ├── tools/                  # AST scan, secret scan, etc.
│   ├── extension.js            # Extension entry point
│   └── package.json
│
├── test/                       # Vulnerable Next.js app for testing
│   ├── app/
│   ├── lib/
│   ├── VULNERABILITIES.md
│   └── package.json
│
└── README.md
```

---

## Features

### Web Dashboard
- **JWT-authenticated** user accounts (sign up / login)
- View all past scans and their full reports
- GitHub repository scanning from the UI
- Responsive, dark-mode UI with Tailwind CSS

### API Server
- REST API for all scan operations
- **15+ specialized security agents** covering OWASP Top 10
- AI-powered planning and remediation via Mistral AI
- MongoDB persistence for scan history and user data
- Supports both **URL-based web scans** and **GitHub repo scans**
- Chunked scan results with `scanRegistry` for large payloads

### VS Code Extension
- Scan the currently open workspace or any folder
- Displays rich HTML report in a VS Code webview panel
- **Connect to dashboard** to sync reports to your account
- Upload existing HTML reports to the dashboard
- Configurable Mistral API key and server URL

### Security Coverage
| Category | Agents |
|---|---|
| Injection | SQL, NoSQL, Command Injection |
| XSS | Reflected, Stored, DOM-based |
| Authentication | Broken Auth, Session management |
| Access Control | IDOR, privilege escalation |
| Cryptography | Weak ciphers, key management |
| Configuration | Security misconfigs, exposed headers |
| SSRF | Server-Side Request Forgery |
| Path Traversal | Directory traversal attacks |
| Dependencies | Known CVEs in packages |
| Business Logic | Logic flaw detection |
| Logging | Insufficient logging checks |
| Integrity | Insecure deserialization |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS 4, React Router 7 |
| Backend | Node.js, Express 4, MongoDB, Mongoose 8 |
| AI / LLM | Mistral AI (`@mistralai/mistralai`) |
| Auth | JWT (`jsonwebtoken`), bcryptjs |
| Web Scraping | Puppeteer Core, Cheerio |
| VS Code Ext. | VS Code Extension API 1.109+ |
| Test App | Next.js 16, TypeScript |
| HTTP Client | Axios |

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** `>= 18.x` — [Download](https://nodejs.org/)
- **npm** `>= 9.x` (comes with Node.js)
- **MongoDB** — Atlas URI or local instance
- **Mistral AI API Key** — [Get one free](https://console.mistral.ai/)
- **Git**
- **VS Code** (for the extension)

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/santhsim/VEXSTORM_HACKATHON.git
cd VEXSTORM_HACKATHON
```

---

### 2. Server Setup

```bash
cd server
npm install
```

Create a `.env` file in `server/`:

```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/zerotrace
JWT_SECRET=your_super_secret_jwt_key
MISTRAL_API_KEY=your_mistral_api_key
CLIENT_URL=http://localhost:5173
```

Start the server:

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

Server runs at `http://localhost:5000`

---

### 3. Client Setup

```bash
cd client
npm install
```

Create a `.env` file in `client/`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_URL=http://localhost:5173
```

Start the dev server:

```bash
npm run dev
```

Client runs at `http://localhost:5173`

Build for production:

```bash
npm run build
npm run preview
```

---

### 4. VS Code Extension Setup

#### Option A — Install from VS Code Marketplace (Recommended)

[![Install ZeroTrace](https://img.shields.io/badge/VS%20Code-Install%20ZeroTrace-007acc?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=santhsim.zerotrace)

1. Open VS Code
2. Go to the **Extensions** panel (`Ctrl+Shift+X`)
3. Search for **`ZeroTrace`** or click the badge above
4. Click **Install**

Or install via the CLI:

```bash
code --install-extension santhsim.zerotrace
```

#### Option B — Run from Source (Development)

```bash
cd extension
npm install
```

**Run in development (Extension Host):**

1. Open the `extension/` folder in VS Code
2. Press `F5` to launch the Extension Development Host
3. Use the Command Palette (`Ctrl+Shift+P`) and search for `ZeroTrace:`

**Package the extension:**

```bash
npm install -g @vscode/vsce
vsce package
# Generates zerotrace-x.x.x.vsix
```

**Install the packaged extension:**

```bash
code --install-extension zerotrace-0.0.4.vsix
```

**Extension Settings** (`settings.json`):

```json
{
  "zerotrace.mistralApiKey": "your_mistral_api_key",
  "zerotrace.serverUrl": "http://localhost:5000"
}
```

**Available Commands:**

| Command | Description |
|---|---|
| `ZeroTrace: Run Security Scan on Folder` | Pick a folder and scan it |
| `ZeroTrace: Scan Currently Open Workspace` | Scan the active workspace |
| `ZeroTrace: Connect to Dashboard (Sign In)` | Authenticate with ZeroTrace dashboard |
| `ZeroTrace: Disconnect from Dashboard (Sign Out)` | Sign out |
| `ZeroTrace: Upload Existing HTML Report to Dashboard` | Push a saved report |
| `ZeroTrace: Check Dashboard Connection Status` | Verify auth status |

---

### 5. Test App (Vulnerable Target)

The `test/` directory contains a **Next.js app with intentional vulnerabilities** for testing ZeroTrace scans locally.

```bash
cd test
npm install
npm run dev
```

Test app runs at `http://localhost:3000`

See [test/VULNERABILITIES.md](test/VULNERABILITIES.md) for the full list of seeded vulnerabilities.


ZeroTrace can also be tested against a live intentionally vulnerable application:

**OWASP Juice Shop (Deployed Instance)**  
https://juice-shop-vsq1.onrender.com/

Use this URL in the dashboard to simulate real-world vulnerability scans.

---

## Environment Variables

### `server/.env`

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: `5000`) |
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret key for signing JWTs |
| `MISTRAL_API_KEY` | Yes | Mistral AI API key |
| `CLIENT_URL` | No | Allowed CORS origin(s), comma-separated |

### `client/.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Backend API base URL |
| `VITE_APP_URL` | No | Frontend app URL (for meta/redirects) |

---

## Available Commands

### Server

```bash
npm run dev        # Start with nodemon (hot reload)
npm start          # Start in production mode
```

### Client

```bash
npm run dev        # Start Vite dev server
npm run build      # Build for production → dist/
npm run preview    # Preview production build locally
npm run lint       # Run ESLint
```

### Extension

```bash
npm run compile    # Compile extension source
npm run watch      # Watch mode for development
npm run lint       # Run ESLint
vsce package       # Package into .vsix
```

### Test App

```bash
npm run dev        # Start Next.js dev server
npm run build      # Build production bundle
npm start          # Start production server
npm run lint       # Run ESLint
```

---

## API Reference

Base URL: `http://localhost:5000/api`

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Register a new user |
| `POST` | `/auth/login` | Login, returns JWT |

### Scans

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/scans` | Start a new web scan |
| `GET` | `/scans` | Get all scans for the authenticated user |
| `GET` | `/scans/:id` | Get a specific scan by ID |
| `DELETE` | `/scans/:id` | Delete a scan |

### GitHub

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/github/scan` | Scan a GitHub repository |
| `GET` | `/github/scans` | Get all GitHub scans |
| `GET` | `/github/scans/:id` | Get a specific GitHub scan |

### Extension

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/extension/report` | Upload a scan report from the VS Code extension |
| `GET` | `/extension/reports` | Get reports uploaded from the extension |

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check |

> All protected routes require `Authorization: Bearer <token>` header.

---

## Agents

### Server Agents (`server/agents/`)

| Agent | Responsibility |
|---|---|
| `plannerAgent.js` | LLM-based scan strategy planning |
| `reconAgent.js` | URL crawling, surface discovery |
| `injectionAgent.js` | SQLi, NoSQLi, Command Injection |
| `xssAgent.js` | XSS payload fuzzing |
| `authAgent.js` | Broken authentication checks |
| `configAgent.js` | Security misconfiguration |
| `ssrfAgent.js` | SSRF detection |
| `pathTraversalAgent.js` | Directory traversal |
| `accessControlAgent.js` | IDOR, broken access control |
| `cryptoAgent.js` | Weak crypto / key exposures |
| `dependencyAgent.js` | Known CVEs in dependencies |
| `loggingAgent.js` | Insufficient logging / monitoring |
| `integrityAgent.js` | Insecure deserialization |
| `businessLogicAgent.js` | Business logic flaws |
| `remediationAgent.js` | AI-generated fix recommendations |

### Extension Agents (`extension/agents/`)

| Agent | Responsibility |
|---|---|
| `scannerAgent.js` | File system traversal scanner |
| `orchestratorAgent.js` | Coordinates local scan pipeline |
| `apiSecurityAgent.js` | API key / token exposure in code |
| `authSecurityAgent.js` | Hardcoded credentials detection |
| `businessLogicAgent.js` | Logic flaw patterns |
| `cryptoLoggingAgent.js` | Weak crypto / sensitive logging |
| `frontendSecurityAgent.js` | CSP, innerHTML, eval usage |
| `infrastructureAgent.js` | Config files, Dockerfile issues |
| `llmAnalyzerAgent.js` | LLM-assisted deep analysis |
| `patternAnalysisAgent.js` | Regex pattern matching |
| `reporterAgent.js` | HTML report generation |
| `verifierAgent.js` | Result verification & deduplication |

---

## Deployment

### Server (Render / Railway / Fly.io)

1. Set all environment variables from `server/.env` in your hosting provider's dashboard.
2. Set the **start command** to `node index.js`.
3. The server is stateless — no file system persistence required.

### Client (Vercel / Netlify / Render Static)

1. Set `VITE_API_URL` to your deployed server URL.
2. Build command: `npm run build`
3. Output directory: `dist/`

### VS Code Extension (VS Code Marketplace)

The extension is published at:
**[marketplace.visualstudio.com/items?itemName=santhsim.zerotrace](https://marketplace.visualstudio.com/items?itemName=santhsim.zerotrace)**

To publish updates:

```bash
vsce login santhsim
vsce publish
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

Please follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

---

## License

This project is licensed under the **MIT License**.

---

<div align="center">
  <img src="client/public/zerotrace.png" alt="ZeroTrace" width="48" />
  <br />
  <sub>Built with 🍵 by <strong>BOSS BANDITS</strong> · VexStorm Hackathon 2026</sub>
</div>
