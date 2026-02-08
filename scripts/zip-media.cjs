// scripts/zip-media.cjs
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

// Load default settings to get mallId
let mallId = 'sakaikitahanada'; // Fallback
try {
  const settingsPath = path.join(__dirname, '..', 'src', 'config', 'default-settings.json');
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (settings.mallId) {
      mallId = settings.mallId;
    }
  }
} catch (e) {
  console.warn('Failed to load default-settings.json, using fallback mallId', e);
}

const SOURCE_DIR = path.join(__dirname, '..', 'tmp', mallId, 'assets', 'videos');
const OUTPUT_DIR = path.join(__dirname, '..', 'release');
const OUTPUT_FILE = path.join(OUTPUT_DIR, `${mallId}-media.zip`);

if (!fs.existsSync(SOURCE_DIR)) {
  console.error(`Source directory not found: ${SOURCE_DIR}`);
  console.log(`Please ensure you have placed video files in tmp/${mallId}/assets/videos`);
  process.exit(1);
}

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log(`Zipping contents of ${SOURCE_DIR} to ${OUTPUT_FILE}...`);

try {
  const zip = new AdmZip();
  // Add contents of the video folder to the root of the zip
  zip.addLocalFolder(SOURCE_DIR);
  zip.writeZip(OUTPUT_FILE);
  console.log(`Successfully created ${OUTPUT_FILE}`);
} catch (error) {
  console.error('Failed to create zip file:', error);
  process.exit(1);
}
