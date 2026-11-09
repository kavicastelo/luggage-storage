import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const OUT_DIR = path.resolve('docs/phase-2b-ux-audit/evidence/current/host-dashboard');
const TMP_PROFILE = path.resolve('temp/chrome-host-web-profile');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}
if (!fs.existsSync(TMP_PROFILE)) {
  fs.mkdirSync(TMP_PROFILE, { recursive: true });
}

// 14 Canonical Host Dashboard Screens
const SCREENS = [
  {
    id: 'HD-001',
    name: 'hd-001-overview',
    route: '/host/dashboard?preview=demo',
    extraViewports: ['tablet'],
  },
  {
    id: 'HD-002',
    name: 'hd-002-locations',
    route: '/host/locations?preview=demo',
    extraViewports: ['tablet'],
  },
  {
    id: 'HD-003',
    name: 'hd-003-profile-editor',
    route: '/host/locations/loc-cmb-fort-01?preview=demo',
    extraViewports: [],
  },
  {
    id: 'HD-004',
    name: 'hd-004-schedule',
    route: '/host/locations/loc-cmb-fort-01/schedule?preview=demo',
    extraViewports: [],
  },
  {
    id: 'HD-005',
    name: 'hd-005-capacity',
    route: '/host/locations/loc-cmb-fort-01/capacity?preview=demo',
    extraViewports: [],
  },
  {
    id: 'HD-006',
    name: 'hd-006-pricing',
    route: '/host/locations/loc-cmb-fort-01/pricing?preview=demo',
    extraViewports: [],
  },
  {
    id: 'HD-007',
    name: 'hd-007-bookings',
    route: '/host/bookings?preview=demo',
    extraViewports: ['tablet'],
  },
  {
    id: 'HD-008',
    name: 'hd-008-modal',
    route: '/host/bookings?inspect=bkg-1001&preview=demo',
    extraViewports: [],
  },
  {
    id: 'HD-009',
    name: 'hd-009-operations',
    route: '/host/operations?preview=demo',
    extraViewports: ['tablet'],
  },
  {
    id: 'HD-010',
    name: 'hd-010-finance',
    route: '/host/finance?preview=demo',
    extraViewports: [],
  },
  {
    id: 'HD-011',
    name: 'hd-011-payouts',
    route: '/host/payouts?preview=demo',
    extraViewports: [],
  },
  {
    id: 'HD-012',
    name: 'hd-012-reviews',
    route: '/host/reviews?preview=demo',
    extraViewports: [],
  },
  {
    id: 'HD-013',
    name: 'hd-013-staff',
    route: '/host/staff?preview=demo',
    extraViewports: [],
  },
  {
    id: 'HD-014',
    name: 'hd-014-settings',
    route: '/host/settings?preview=demo',
    extraViewports: [],
  },
];

const VIEWPORT_CONFIGS = {
  desktop: { width: 1280, height: 900, suffix: 'desktop' },
  tablet: { width: 768, height: 1024, suffix: 'tablet' },
};

console.log('Capturing CWCP Host Web Dashboard Screenshots across 14 Screens...');

let totalCaptured = 0;

for (const screen of SCREENS) {
  const targetUrl = `${BASE_URL}${screen.route}`;
  const viewportsToCapture = ['desktop', ...screen.extraViewports];

  for (const vpKey of viewportsToCapture) {
    const vp = VIEWPORT_CONFIGS[vpKey];
    const filename = `${screen.name}-${vp.suffix}.png`;
    const outputPath = path.join(OUT_DIR, filename);

    console.log(`\n[${screen.id}] ${screen.name} -> ${vpKey} (${vp.width}x${vp.height})`);

    try {
      execFileSync(
        CHROME_PATH,
        [
          '--headless=new',
          '--no-sandbox',
          '--disable-gpu',
          `--user-data-dir=${TMP_PROFILE}`,
          `--screenshot=${outputPath}`,
          `--window-size=${vp.width},${vp.height}`,
          '--virtual-time-budget=6000',
          '--hide-scrollbars',
          targetUrl,
        ],
        { encoding: 'utf-8', timeout: 35000 }
      );

      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        console.log(`  ✓ ${filename} (${stats.size} bytes)`);
        totalCaptured++;
      } else {
        console.error(`  ✗ Output file not found: ${outputPath}`);
      }
    } catch (err) {
      console.error(`  ✗ Error capturing ${filename}:`, err.message);
    }
  }
}

console.log(`\nHost Web Dashboard Capture Complete: ${totalCaptured} screenshots successfully captured in ${OUT_DIR}.`);
