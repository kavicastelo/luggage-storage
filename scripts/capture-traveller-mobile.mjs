import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 8082;
const BASE_URL = `http://localhost:${PORT}`;
const OUT_DIR = path.resolve('docs/phase-2b-ux-audit/evidence/current/traveller-mobile');
const TMP_PROFILE = path.resolve('temp/chrome-traveller-mobile-profile');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}
if (!fs.existsSync(TMP_PROFILE)) {
  fs.mkdirSync(TMP_PROFILE, { recursive: true });
}

const SCREENS = [
  {
    id: 'TM-011',
    name: 'tm-011-explore',
    route: '/(traveller)',
    viewports: ['mobile', 'mobile-small', 'tablet'],
  },
  {
    id: 'TM-012',
    name: 'tm-012-geospatial-map',
    route: '/(traveller)/explore',
    viewports: ['mobile', 'tablet'],
  },
  {
    id: 'TM-015',
    name: 'tm-015-location-dossier',
    route: '/(traveller)/location?id=loc-cmb-fort-01',
    viewports: ['mobile', 'mobile-small'],
  },
  {
    id: 'TM-017',
    name: 'tm-017-checkout-schedule',
    route: '/(traveller)/checkout?locId=loc-cmb-fort-01',
    viewports: ['mobile'],
  },
  {
    id: 'TM-024',
    name: 'tm-024-custody-pass',
    route: '/(traveller)/pass?ref=%23LS-2026-8841',
    viewports: ['mobile', 'mobile-small'],
  },
  {
    id: 'TM-027',
    name: 'tm-027-active-storage',
    route: '/(traveller)/bookings',
    viewports: ['mobile', 'tablet'],
  },
  {
    id: 'TM-036',
    name: 'tm-036-saved-spots',
    route: '/(traveller)/saved',
    viewports: ['mobile'],
  },
  {
    id: 'TM-039',
    name: 'tm-039-support-centre',
    route: '/(traveller)/support',
    viewports: ['mobile'],
  },
  {
    id: 'TM-042',
    name: 'tm-042-account-profile',
    route: '/(traveller)/profile',
    viewports: ['mobile'],
  },
  {
    id: 'TM-001',
    name: 'tm-001-onboarding-welcome',
    route: '/(traveller)/onboarding',
    viewports: ['mobile'],
  },
];

const VIEWPORT_CONFIGS = {
  mobile: { width: 390, height: 844, suffix: 'mobile' },
  'mobile-small': { width: 375, height: 812, suffix: 'mobile-small' },
  tablet: { width: 768, height: 1024, suffix: 'tablet' },
};

async function main() {
  console.log(`Connecting to mobile server at ${BASE_URL}...`);
  let totalCaptured = 0;

  for (const screen of SCREENS) {
    const targetUrl = `${BASE_URL}${screen.route}`;
    for (const vpKey of screen.viewports) {
      const vp = VIEWPORT_CONFIGS[vpKey];
      const outFileName = `${screen.name}-${vp.suffix}.png`;
      const outFilePath = path.join(OUT_DIR, outFileName);

      const chromeArgs = [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        `--user-data-dir=${TMP_PROFILE}`,
        `--window-size=${vp.width},${vp.height}`,
        `--screenshot=${outFilePath}`,
        '--virtual-time-budget=5000',
        targetUrl,
      ];

      console.log(`Capturing [${screen.id}] ${screen.name} @ ${vpKey} (${vp.width}x${vp.height})...`);
      try {
        execFileSync(CHROME_PATH, chromeArgs, { encoding: 'utf-8', timeout: 30000 });
        if (fs.existsSync(outFilePath)) {
          const stats = fs.statSync(outFilePath);
          console.log(`  ✓ ${outFileName} (${(stats.size / 1024).toFixed(1)} KB)`);
          totalCaptured++;
        }
      } catch (err) {
        console.error(`  × Error capturing ${outFileName}:`, err.message);
      }
    }
  }

  console.log(`Evidence capture complete: ${totalCaptured} screenshots stored in ${OUT_DIR}`);
}

main().catch(console.error);
