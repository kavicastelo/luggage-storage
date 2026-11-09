import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

/**
 * Mascot Derivative Asset Pipeline
 * Generates lightweight WebP derivative images without modifying original PNG files.
 * Enforces strict SHA-256 immutability verification on all original PNG assets.
 */

const TARGET_DIRECTORIES = [
  {
    name: 'apps/web',
    sourceDir: path.resolve('apps/web/public/assets/mascots'),
    derivativeDir: path.resolve('apps/web/public/assets/mascots/webp'),
  },
  {
    name: 'apps/mobile',
    sourceDir: path.resolve('apps/mobile/assets/mascots'),
    derivativeDir: path.resolve('apps/mobile/assets/mascots/webp'),
  },
];

function computeSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

async function runPipeline() {
  console.log('===============================================================');
  console.log('  MASCOT DERIVATIVE ASSET PIPELINE (Phase 2C.1)');
  console.log('===============================================================\n');

  const fullReport = {
    timestamp: new Date().toISOString(),
    directories: [],
  };

  for (const target of TARGET_DIRECTORIES) {
    console.log(`Processing directory: ${target.name} (${target.sourceDir})`);
    if (!fs.existsSync(target.sourceDir)) {
      console.warn(`[WARN] Directory does not exist: ${target.sourceDir}`);
      continue;
    }

    const pngFiles = fs
      .readdirSync(target.sourceDir)
      .filter((file) => file.endsWith('.png') && file.startsWith('LS-mascot_'))
      .sort();

    console.log(`Found ${pngFiles.length} original mascot PNG files.`);

    if (pngFiles.length !== 20) {
      throw new Error(`Expected exactly 20 original mascot PNG files, found ${pngFiles.length}`);
    }

    // Step 1: Pre-execution Checksums
    const preChecksums = new Map();
    let totalOriginalBytes = 0;
    for (const file of pngFiles) {
      const fullPath = path.join(target.sourceDir, file);
      const stat = fs.statSync(fullPath);
      totalOriginalBytes += stat.size;
      const hash = computeSha256(fullPath);
      preChecksums.set(file, { hash, size: stat.size });
    }

    // Ensure derivative directory exists
    if (!fs.existsSync(target.derivativeDir)) {
      fs.mkdirSync(target.derivativeDir, { recursive: true });
    }

    // Step 2: Generate WebP derivatives
    let totalWebpBytes = 0;
    const items = [];

    for (const file of pngFiles) {
      const sourcePath = path.join(target.sourceDir, file);
      const baseName = path.parse(file).name;
      const webpName = `${baseName}.webp`;
      const webpPath = path.join(target.derivativeDir, webpName);

      const webpBuffer = await sharp(sourcePath)
        .webp({ quality: 85, effort: 6 })
        .toBuffer();

      fs.writeFileSync(webpPath, webpBuffer);
      totalWebpBytes += webpBuffer.length;

      const webpHash = crypto.createHash('sha256').update(webpBuffer).digest('hex');
      const originalInfo = preChecksums.get(file);
      const savingPercent = ((1 - webpBuffer.length / originalInfo.size) * 100).toFixed(1);

      items.push({
        file,
        originalBytes: originalInfo.size,
        originalSha256: originalInfo.hash,
        webpFile: webpName,
        webpBytes: webpBuffer.length,
        webpSha256: webpHash,
        savingPercent: `${savingPercent}%`,
      });

      console.log(
        `  ✓ ${baseName}: ${(originalInfo.size / 1024).toFixed(0)}KB -> ${(webpBuffer.length / 1024).toFixed(0)}KB (-${savingPercent}%)`
      );
    }

    // Step 3: Post-execution Checksum Verification
    console.log(`\nVerifying post-execution SHA-256 immutability for ${target.name}...`);
    for (const file of pngFiles) {
      const fullPath = path.join(target.sourceDir, file);
      const postHash = computeSha256(fullPath);
      const preHash = preChecksums.get(file).hash;

      if (postHash !== preHash) {
        throw new Error(
          `[CRITICAL MUTATION DETECTED] Original file ${file} was altered! Pre: ${preHash}, Post: ${postHash}`
        );
      }
    }
    console.log(`✓ All 20 original PNG files in ${target.name} confirmed 100% byte-identical!\n`);

    const dirSummary = {
      target: target.name,
      originalFilesCount: pngFiles.length,
      totalOriginalBytes,
      totalWebpBytes,
      overallSavings: `${((1 - totalWebpBytes / totalOriginalBytes) * 100).toFixed(2)}%`,
      items,
    };

    fullReport.directories.push(dirSummary);
  }

  // Write evidence register
  const reportPath = path.resolve('scripts/mascot-derivative-register.json');
  fs.writeFileSync(reportPath, JSON.stringify(fullReport, null, 2), 'utf-8');
  console.log(`Mascot derivative report saved to: ${reportPath}`);

  console.log('\n===============================================================');
  console.log('  PIPELINE COMPLETE & VERIFIED');
  console.log('===============================================================\n');
}

runPipeline().catch((err) => {
  console.error('[ERROR] Pipeline failed:', err);
  process.exit(1);
});
