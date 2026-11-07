# Engineering Governance — Local Development Setup

**Document ID:** ENG-DOC-002  
**Version:** 1.0.0  
**Phase:** Phase 1A — Engineering Foundation  
**Status:** Approved Engineering Baseline  
**Applicability:** All software engineers, QA engineers, and automated agents  

---

## 1. Prerequisites & Tooling Requirements

Before developing in the Global Luggage Storage Marketplace monorepo, ensure the following core tools are installed and verified on your host machine:

| Component | Minimum Version | Recommended Version | Verification Command | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js** | `>= 20.0.0` | `20.x` or `22.x` LTS | `node -v` | Managed via `nvm` or `nvm-windows` |
| **pnpm** | `>= 9.0.0` | `9.15.x` or `12.x` | `pnpm -v` | Fast, disk-efficient package manager |
| **Docker Engine** | `>= 24.0.0` | Latest Docker Desktop | `docker --version` | Required for PostgreSQL 16 + PostGIS |
| **Docker Compose**| `>= 2.20.0` | Latest | `docker compose version` | Manages local infrastructure containers |
| **Git** | `>= 2.30.0` | Latest | `git --version` | Ensure `core.autocrlf` is configured |

---

## 2. Windows Environment Notes

If developing on a Windows host machine:
1. **PowerShell Execution Policy:** If running pnpm scripts fails with script execution errors, run PowerShell as Administrator and execute:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
2. **Git Line Endings:** Configure Git to prevent Windows CRLF conversions from dirtying repository files:
   ```bash
   git config --global core.autocrlf input
   ```
3. **Sandbox Command Execution:** In agentic workflows, always run package-altering commands (`pnpm install`, `pnpm add`) outside sandboxed environments if required by tool constraints.

---

## 3. Step-by-Step Quickstart Guide

### Step 1: Clone Repository & Install Dependencies
```bash
git clone <repository-url>
cd luggage-storage
pnpm install
```

### Step 2: Provision Local PostGIS Database
Launch the local PostgreSQL 16 instance with the PostGIS 3 extension using Docker Compose:
```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```
> [!NOTE]
> Ensure the **Docker Desktop daemon** is running before executing this command. On Windows, if the Docker daemon is stopped, start Docker Desktop from the Start Menu or Services control panel.
> If Docker is unavailable in your environment, backend `/health` (liveness) will still function with exit code 200, while `/ready` (readiness) will accurately return `503 Service Unavailable` with structured diagnostic details and zero leaked secrets.

Verify container status:
```bash
docker compose -f infrastructure/docker/docker-compose.yml ps
```
The database will be accessible at:
- **Host:** `localhost`
- **Port:** `5432`
- **Database:** `luggage_storage_dev`
- **Username:** `postgres`
- **Password:** `postgres`

To verify PostGIS spatial extension manually:
```bash
docker compose -f infrastructure/docker/docker-compose.yml exec postgres psql -U postgres -d luggage_storage_dev -c "SELECT PostGIS_Full_Version();"
```

### Step 3: Configure Environment Variables
Copy the baseline environment templates for each application:
```bash
# Backend API configuration
cp apps/api/.env.example apps/api/.env

# Web Portal configuration
cp apps/web/.env.example apps/web/.env
```

### Step 4: Verify System Baseline
Execute compilation, type-checking, and test suites across all workspaces:
```bash
pnpm typecheck
pnpm test
pnpm build
```

### Step 5: Start Local Development Servers
Run the full stack concurrently via Turborepo:
```bash
pnpm dev
```
Alternatively, launch individual application servers in separate terminal sessions:
```bash
# Fastify Backend API (starts at http://localhost:4000)
pnpm --filter @luggage-storage/api dev

# Web Portal Vite Dev Server (starts at http://localhost:5173)
pnpm --filter @luggage-storage/web dev

# Mobile Metro Bundler (starts at http://localhost:8081)
pnpm --filter @luggage-storage/mobile dev
```

---

## 4. Verification Checkpoints & Endpoints

| Service | Target URL | Expected Response | Description |
| :--- | :--- | :--- | :--- |
| **API Liveness** | `http://localhost:4000/health` | `{"status":"ok","uptime":...,"timestamp":...}` | Basic process health check |
| **API Readiness** | `http://localhost:4000/ready` | `{"status":"ok","database":"connected","postgis":true}` | Verifies DB & PostGIS connectivity |
| **API Swagger UI** | `http://localhost:4000/docs` | Interactive Swagger UI | OpenAPI documentation explorer |
| **Web Portal** | `http://localhost:5173` | React Application Landing Page | Admin & Host desktop interface |
| **Mobile Bundler**| `http://localhost:8081` | Metro Bundler UI | Expo developer tools interface |

---

## 5. Teardown & Reset Commands

To reset the local development environment:
```bash
# Stop and remove containers and database volumes
docker compose -f infrastructure/docker/docker-compose.yml down -v

# Clean build artifacts and caches across the monorepo
pnpm clean

# Re-install dependencies if needed
pnpm install
```

