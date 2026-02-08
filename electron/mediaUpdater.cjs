// electron/mediaUpdater.cjs
const { app, net } = require('electron');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const logger = require('electron-log');

// Load settings to get mallId
let MALL_ID = 'sakaikitahanada'; // Fallback
try {
  const userDataPath = app.getPath('userData');
  const settingsPath = path.join(userDataPath, 'settings.json');
  
  // Try to load from User Data first
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (settings.mallId) {
      MALL_ID = settings.mallId;
    }
  } else {
    // Fallback to default settings if user settings don't exist yet
    // (Though main process should have created it by now usually)
    const defaultSettingsPath = app.isPackaged
      ? path.join(process.resourcesPath, 'default-settings.json')
      : path.join(__dirname, '..', 'src', 'config', 'default-settings.json');

    if (fs.existsSync(defaultSettingsPath)) {
      const settings = JSON.parse(fs.readFileSync(defaultSettingsPath, 'utf8'));
      if (settings.mallId) {
        MALL_ID = settings.mallId;
      }
    }
  }
} catch (e) {
  logger.warn('Failed to load settings, using fallback mallId', e);
}

const REPO = 's-yoshida-33/Grain-Link';
const MEDIA_FILENAME = `${MALL_ID}-media.zip`;
const META_FILE = path.join(app.getPath('userData'), 'media-meta.json');
// User data path: C:\Users\{userName}\AppData\Roaming\grain-link\videos
const VIDEO_DIR = path.join(app.getPath('userData'), 'videos');

// Helper to get local meta
function getLocalMediaMeta() {
  try {
    if (fs.existsSync(META_FILE)) {
      return JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
    }
  } catch (e) {
    logger.warn('Failed to read media meta', e);
  }
  return { id: null, updated_at: null, version: null };
}

// Helper to save local meta
function saveLocalMediaMeta(meta) {
  try {
    fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
  } catch (e) {
    logger.error('Failed to save media meta', e);
  }
}

/**
 * Check for media updates on GitHub Releases
 */
async function checkForMediaUpdates() {
  logger.info(`Checking for media updates (${MEDIA_FILENAME})...`);
  
  try {
    const response = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: {
        'User-Agent': 'Grain-Link-App',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}: ${response.statusText}`);
    }

    const release = await response.json();
    const asset = release.assets.find(a => a.name === MEDIA_FILENAME);

    if (!asset) {
      logger.info(`No ${MEDIA_FILENAME} found in latest release`);
      return null;
    }

    const localMeta = getLocalMediaMeta();
    
    // Simple check: if asset ID is different, it's an update
    // Alternatively check updated_at timestamp
    if (localMeta.id !== asset.id) {
      logger.info(`New media update found: ${asset.id} (Local: ${localMeta.id})`);
      return {
        id: asset.id,
        url: asset.browser_download_url,
        updated_at: asset.updated_at,
        size: asset.size,
        release_tag: release.tag_name
      };
    }

    logger.info('Media is up to date');
    return null;

  } catch (error) {
    logger.error('Error checking for media updates:', error);
    return null; // Fail silently or let caller handle
  }
}

/**
 * Download and extract media update
 * @param {object} updateInfo - Info returned by checkForMediaUpdates
 * @param {function} onProgress - Callback (percent, transferred, total)
 */
async function downloadAndInstallMediaUpdate(updateInfo, onProgress) {
  logger.info(`Starting media download from ${updateInfo.url}`);
  
  const tempZipPath = path.join(app.getPath('temp'), `media-${updateInfo.id}.zip`);
  
  try {
    // 1. Download
    await new Promise((resolve, reject) => {
      const request = net.request(updateInfo.url);
      
      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with status ${response.statusCode}`));
          return;
        }

        const totalBytes = parseInt(response.headers['content-length'], 10) || updateInfo.size || 0;
        let downloadedBytes = 0;
        
        const fileStream = fs.createWriteStream(tempZipPath);
        
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          fileStream.write(chunk);
          
          if (onProgress && totalBytes > 0) {
            onProgress(
              (downloadedBytes / totalBytes) * 100,
              downloadedBytes,
              totalBytes
            );
          }
        });
        
        response.on('end', () => {
          fileStream.end();
          resolve();
        });
        
        response.on('error', (err) => {
          fileStream.close();
          fs.unlink(tempZipPath, () => {}); // Clean up
          reject(err);
        });
      });
      
      request.on('error', (err) => reject(err));
      request.end();
    });

    logger.info('Download complete. Extracting...');
    if (onProgress) onProgress(100, updateInfo.size, updateInfo.size);

    // 2. Extract
    // Ensure video directory exists
    if (!fs.existsSync(VIDEO_DIR)) {
      fs.mkdirSync(VIDEO_DIR, { recursive: true });
    }

    const zip = new AdmZip(tempZipPath);
    zip.extractAllTo(VIDEO_DIR, true); // overwrite = true

    logger.info(`Extracted to ${VIDEO_DIR}`);

    // 3. Cleanup and Save Meta
    fs.unlinkSync(tempZipPath);
    
    saveLocalMediaMeta({
      id: updateInfo.id,
      updated_at: updateInfo.updated_at,
      version: updateInfo.release_tag
    });

    logger.info('Media update successfully installed');
    return true;

  } catch (error) {
    logger.error('Failed to download/install media update:', error);
    // Try to cleanup
    if (fs.existsSync(tempZipPath)) {
      try { fs.unlinkSync(tempZipPath); } catch (e) {}
    }
    throw error;
  }
}

module.exports = {
  checkForMediaUpdates,
  downloadAndInstallMediaUpdate
};
