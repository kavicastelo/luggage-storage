# Phase 8.1 — Workstream 3: AWS EC2 Demo API Deployment Guide

**Document:** `docs/release-readiness/phase-8-1/06-aws-ec2-api-deployment.md`  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Phase:** 8.1 — Checkpoint 1  
**Date:** November 19, 2026  
**Auditor:** Independent Release Readiness Lead  

---

## 1. Executive Summary

The demo backend API must run directly on AWS EC2 as a native Node.js process using the compiled distribution artifact (`apps/api/dist`).

**Zero Docker Deployment Constraint:** Docker containers, Docker Compose, and container engines are strictly prohibited for the EC2 demo deployment.

---

## 2. Server Architecture & Directory Structure

```text
/opt/luggage-storage/
├── current -> /opt/luggage-storage/releases/20261119_100000
├── releases/
│   ├── 20261119_093000/
│   └── 20261119_100000/
│       ├── dist/
│       │   ├── app.js
│       │   ├── server.js
│       │   └── infrastructure/database/migrations/
│       ├── node_modules/
│       └── package.json
└── shared/
    ├── .env.demo
    └── logs/
```

---

## 3. Host Initialization & Provisioning

On a fresh Ubuntu 24.04 LTS instance (AWS EC2 t3.micro / t3.small):

```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 22 LTS, Nginx, and Certbot
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx

# 3. Install global process manager PM2
sudo npm install -g pm2

# 4. Create deployment directories
sudo mkdir -p /opt/luggage-storage/{releases,shared/logs}
sudo chown -R ubuntu:ubuntu /opt/luggage-storage

# 5. Place demo environment configuration
# Copy .envs/demo.example to /opt/luggage-storage/shared/.env.demo
```

---

## 4. Nginx Reverse Proxy & TLS Configuration

Create `/etc/nginx/sites-available/luggage-demo-api`:

```nginx
server {
    server_name api-demo.yourdomain.com; # Or EC2 Public IP / Elastic IP

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90s;
    }
}
```

Enable site and acquire SSL:
```bash
sudo ln -s /etc/nginx/sites-available/luggage-demo-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api-demo.yourdomain.com
```

---

## 5. Deployment & Rollback Automation

- **Deploy:** `bash scripts/deploy-demo-api.sh`
  1. Validates `.env.demo` and prerequisites.
  2. Unpacks compiled artifact into `/opt/luggage-storage/releases/<timestamp>`.
  3. Symlinks shared `.env`.
  4. Runs migrations via `node dist/infrastructure/database/migrate.js`.
  5. Atomically switches `/opt/luggage-storage/current` symlink.
  6. Restarts process via PM2 / systemd.
  7. Probes `/live` health check up to 15 times.
  8. Triggers automatic rollback if health checks fail.
- **Rollback:** `bash scripts/rollback-demo-api.sh`
  - Reverts `/opt/luggage-storage/current` to previous release and restarts process.
