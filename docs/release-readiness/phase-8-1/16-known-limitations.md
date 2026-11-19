# Known Limitations and Demo Scope

**Document ID:** `docs/release-readiness/phase-8-1/16-known-limitations.md`  
**Phase:** 8.1 Demo Readiness  
**Target:** Transparency & Operational Scope  
**Status:** Approved

---

## 1. Executive Summary

This document provides a transparent, comprehensive inventory of all architectural simplifications, cost optimizations, and deliberate tradeoffs present in the demo environment. Each entry specifies its operational impact during demonstrations, the immediate demo mitigation, and the documented transition path to full production.

---

## 2. Inventory of Known Limitations

### 2.1 Single EC2 Compute Instance (No Auto-Scaling)
- **Description:** The demo API runs on a single AWS EC2 instance (t4g.small or t3.small) managed by systemd and PM2.
- **Operational Impact:** A host-level hardware fault or kernel crash will cause temporary API downtime until rebooted. No elastic horizontal auto-scaling is active.
- **Demo Mitigation:** Systemd and PM2 automatically restart the process on application-level unhandled exceptions or crashes. Traffic load during demonstrations is predictable and well within single-instance capacity (up to ~500 req/s).
- **Production Path:** Migration to AWS ECS Fargate or Kubernetes (EKS) across multi-AZ behind an Application Load Balancer with autoscaling targets.

### 2.2 Supabase Managed Database Limits (Free/Pro Tier)
- **Description:** Demo database runs on Supabase PostgreSQL 16.8 with PostGIS 3.5.
- **Operational Impact:** Free tier instances pause after inactivity; connection limit is bounded (typically 60 direct connections). Direct connection string (Port 5432) must be used rather than transaction pooler (Port 6543) due to advisory locks.
- **Demo Mitigation:** Fastify database connection pool is configured with `max: 10` connections per worker to prevent pool exhaustion. API readiness probes keep the database active.
- **Production Path:** AWS RDS Aurora PostgreSQL multi-AZ cluster with auto-scaling read replicas and AWS Secrets Manager integration.

### 2.3 Simulated / Sandbox Payments
- **Description:** Payment processing operates strictly in sandbox test mode using Stripe test card numbers (`4242...`) and PayPal sandbox buyer accounts.
- **Operational Impact:** No real monetary funds are transacted. Real credit cards will be rejected by the Stripe test gateway.
- **Demo Mitigation:** Stakeholders and testers are provided with the documented Stripe test cards for instant, risk-free validation of booking checkout and QR custody release.
- **Production Path:** Transition to live Stripe Merchant Account and PayPal Live Marketplace credentials managed via secure environment secrets.

### 2.4 Ephemeral & Local File Storage
- **Description:** Luggage custody intake and release photographs are stored locally on the EC2 instance filesystem (`STORAGE_PROVIDER=local`) or ephemeral memory in tests.
- **Operational Impact:** If the EC2 instance root volume is destroyed or terminated, stored intake photographs are lost.
- **Demo Mitigation:** Photographs are preserved during PM2 restarts and routine API updates. Automated database backups include metadata references.
- **Production Path:** AWS S3 private buckets with server-side encryption (SSE-S3/KMS), CloudFront signed CDN URLs, and automated S3 lifecycle transitions to Glacier.

### 2.5 Demo Email Delivery
- **Description:** Outbound email notifications (email verification, password reset, booking receipts) use Ethereal or console logging (`EMAIL_PROVIDER=ethereal`).
- **Operational Impact:** Emails are not delivered to real external inbox servers (e.g. Gmail or Outlook).
- **Demo Mitigation:** Fastify logger outputs Ethereal inspection URLs in API logs, allowing instantaneous viewing of rendered HTML emails in a web browser.
- **Production Path:** Production uses SendGrid or AWS SES with verified custom sender domains, DKIM, and SPF authentication.

### 2.6 Hardware Device Integration
- **Description:** Custody validation relies on visual camera QR scanning and manual alphanumeric code fallbacks rather than specialized barcode scanners or IoT electronic smart locks.
- **Operational Impact:** Physical smart locker solenoids cannot be actuated over the demo software.
- **Demo Mitigation:** Visual QR scanner works universally on any smartphone camera via Expo Camera / HTML5 WebRTC. Alphanumeric 6-character passcodes serve as redundant fallback.
- **Production Path:** Integration with IoT locker hardware controllers via MQTT/HTTPS webhooks as hardware partnerships mature.

---

## 3. Summary Table

| Area | Demo Mode | Production Architecture | Risk to Demo |
| :--- | :--- | :--- | :---: |
| **Compute** | Single EC2 Node | Multi-AZ ECS Fargate | Negligible |
| **Database** | Supabase PostGIS (Direct 5432) | AWS Aurora Multi-AZ | Negligible |
| **Payments** | Sandbox / Test Cards | Live Stripe / PayPal | None (Intended) |
| **Storage** | Local disk | AWS S3 Bucket | Low |
| **Email** | Ethereal / Console | SendGrid / AWS SES | None |
| **Hardware** | Camera QR Scan | Camera QR + IoT Lockers | None |
