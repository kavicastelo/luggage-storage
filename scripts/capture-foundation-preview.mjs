import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_URL = 'http://localhost:5173/dev/foundation-preview';
const OUT_DIR = path.resolve('docs/phase-2b-ux-audit/evidence/current/foundation');
const TMP_PROFILE = path.resolve('temp/chrome-foundation-profile');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}
if (!fs.existsSync(TMP_PROFILE)) {
  fs.mkdirSync(TMP_PROFILE, { recursive: true });
}

const VIEWPORTS = [
  {
    name: 'desktop',
    filename: 'foundation-preview-desktop.png',
    width: 1280,
    height: 900,
  },
  {
    name: 'mobile',
    filename: 'foundation-preview-mobile.png',
    width: 390,
    height: 844,
  },
];

console.log('Capturing CWCP Foundation Preview Screenshots...');

for (const vp of VIEWPORTS) {
  const outputPath = path.join(OUT_DIR, vp.filename);
  console.log(`\nCapturing ${vp.name} (${vp.width}x${vp.height}) -> ${outputPath}`);

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
        '--virtual-time-budget=5000',
        '--hide-scrollbars',
        TARGET_URL,
      ],
      { encoding: 'utf-8', timeout: 30000 }
    );

    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log(`✓ Successfully captured ${vp.filename} (${stats.size} bytes)`);
    } else {
      console.error(`✗ Failed: Output file not created: ${outputPath}`);
    }
  } catch (err) {
    console.error(`✗ Error capturing ${vp.name}:`, err.message);
  }
}

console.log('\nFoundation Preview Capture Complete.');
