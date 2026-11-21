const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function generate() {
  const assetsDir = path.resolve(__dirname, '../apps/mobile/assets');
  const mascotWave = path.join(assetsDir, 'mascots/LS-mascot_01_wave.png');

  if (!fs.existsSync(mascotWave)) {
    throw new Error(`Mascot file not found at: ${mascotWave}`);
  }

  // 1. App Icon (1024x1024)
  // Background: Deep Navy #0A192F with subtle brand ring and Kiri waving
  const iconBgSvg = Buffer.from(`
    <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <rect width="1024" height="1024" rx="224" fill="#0A192F" />
      <circle cx="512" cy="512" r="430" stroke="#1E293B" stroke-width="4" fill="none" opacity="0.6" />
      <circle cx="512" cy="512" r="390" fill="#112240" />
      <circle cx="512" cy="512" r="370" stroke="#C55013" stroke-width="6" stroke-opacity="0.4" fill="none" />
    </svg>
  `);

  const mascotIcon = await sharp(mascotWave)
    .resize(680, 680, { fit: 'inside' })
    .toBuffer();

  const iconMeta = await sharp(mascotIcon).metadata();
  const topIcon = Math.round((1024 - (iconMeta.height || 680)) / 2 + 10);
  const leftIcon = Math.round((1024 - (iconMeta.width || 680)) / 2);

  await sharp(iconBgSvg)
    .composite([{ input: mascotIcon, top: topIcon, left: leftIcon }])
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));
  console.log('Successfully generated apps/mobile/assets/icon.png');

  // 2. Android Adaptive Icon (1024x1024 foreground, safe area within 66% circle = ~670px)
  const adaptiveMascot = await sharp(mascotWave)
    .resize(560, 560, { fit: 'inside' })
    .toBuffer();
  const adaptMeta = await sharp(adaptiveMascot).metadata();
  const topAdapt = Math.round((1024 - (adaptMeta.height || 560)) / 2);
  const leftAdapt = Math.round((1024 - (adaptMeta.width || 560)) / 2);

  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: adaptiveMascot, top: topAdapt, left: leftAdapt }])
    .png()
    .toFile(path.join(assetsDir, 'adaptive-icon.png'));
  console.log('Successfully generated apps/mobile/assets/adaptive-icon.png');

  // 3. Splash Screen (2048x2048)
  const splashBgSvg = Buffer.from(`
    <svg width="2048" height="2048" viewBox="0 0 2048 2048" xmlns="http://www.w3.org/2000/svg">
      <rect width="2048" height="2048" fill="#0A192F" />
      <circle cx="1024" cy="940" r="480" fill="#112240" />
      <circle cx="1024" cy="940" r="470" stroke="#C55013" stroke-width="4" stroke-opacity="0.3" fill="none" />
      <text x="1024" y="1460" font-family="system-ui, -apple-system, sans-serif" font-size="76" font-weight="800" fill="#FAF8F5" text-anchor="middle" letter-spacing="4">LUGGAGE STORAGE</text>
      <text x="1024" y="1530" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="600" fill="#C55013" text-anchor="middle" letter-spacing="8">SRI LANKA</text>
      <text x="1024" y="1580" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="400" fill="#94A3B8" text-anchor="middle" letter-spacing="2">Verified Travel Custody Network</text>
    </svg>
  `);

  const splashMascot = await sharp(mascotWave)
    .resize(760, 760, { fit: 'inside' })
    .toBuffer();
  const splashMascotMeta = await sharp(splashMascot).metadata();
  const topSplash = Math.round(940 - (splashMascotMeta.height || 760) / 2);
  const leftSplash = Math.round((2048 - (splashMascotMeta.width || 760)) / 2);

  await sharp(splashBgSvg)
    .composite([{ input: splashMascot, top: topSplash, left: leftSplash }])
    .png()
    .toFile(path.join(assetsDir, 'splash.png'));
  console.log('Successfully generated apps/mobile/assets/splash.png');
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});

