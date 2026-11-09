import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const OUT_DIR = path.resolve('docs/phase-2b-ux-audit/evidence/current/public-web');
const TMP_PROFILE = path.resolve('temp/chrome-public-web-profile');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}
if (!fs.existsSync(TMP_PROFILE)) {
  fs.mkdirSync(TMP_PROFILE, { recursive: true });
}

// 11 Screens to capture
const SCREENS = [
  {
    id: 'PW-001',
    name: 'pw-001-landing',
    route: '/',
    extraViewports: ['mobile-small', 'tablet', 'wide'],
  },
  {
    id: 'PW-002',
    name: 'pw-002-search',
    route: '/search',
    extraViewports: ['mobile-small', 'tablet', 'wide'],
  },
  {
    id: 'PW-003',
    name: 'pw-003-location-details',
    route: '/locations/colombo-fort-railway-hub',
    extraViewports: [],
  },
  {
    id: 'PW-004',
    name: 'pw-004-checkout',
    route: '/checkout/loc-cmb-fort-01',
    extraViewports: ['mobile-small'],
  },
  {
    id: 'PW-005',
    name: 'pw-005-custody-pass',
    route: '/booking/confirm?loc=loc-cmb-fort-01',
    extraViewports: ['mobile-small'],
  },
  {
    id: 'PW-006',
    name: 'pw-006-become-a-host',
    route: '/become-a-host',
    extraViewports: [],
  },
  {
    id: 'PW-007',
    name: 'pw-007-how-it-works',
    route: '/how-it-works',
    extraViewports: [],
  },
  {
    id: 'PW-008',
    name: 'pw-008-help-centre',
    route: '/help',
    extraViewports: [],
  },
  {
    id: 'PW-009',
    name: 'pw-009-contact-us',
    route: '/contact',
    extraViewports: [],
  },
  {
    id: 'PW-010',
    name: 'pw-010-terms-privacy',
    route: '/terms',
    extraViewports: [],
  },
  {
    id: 'PW-011',
    name: 'pw-011-traveller-portal',
    route: '/portal/bookings',
    extraViewports: [],
  },
];

const VIEWPORT_CONFIGS = {
  desktop: { width: 1280, height: 900, suffix: 'desktop' },
  mobile: { width: 390, height: 844, suffix: 'mobile' },
  'mobile-small': { width: 375, height: 812, suffix: 'mobile-small' },
  tablet: { width: 768, height: 1024, suffix: 'tablet' },
  wide: { width: 1440, height: 900, suffix: 'wide' },
};

console.log('Capturing CWCP Public Traveller Web Screenshots across 11 Screens & 5 Viewports...');

let totalCaptured = 0;

for (const screen of SCREENS) {
  const targetUrl = `${BASE_URL}${screen.route}`;
  const viewportsToCapture = ['desktop', 'mobile', ...screen.extraViewports];

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

console.log(`\nPublic Traveller Web Capture Complete: ${totalCaptured} screenshots successfully captured in ${OUT_DIR}.`);
