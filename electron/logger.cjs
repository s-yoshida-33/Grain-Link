// electron/logger.cjs
// Unified logging (file + console).

const path = require('path');
const os = require('os');
const { app } = require('electron');
const log = require('electron-log');

const hostname = os.hostname();

/**
 * Configure file logger (electron-log)
 */
function configureLogger() {
  const userData = app.getPath('userData');
  const logDir = path.join(userData, 'logs');

  // Log file path: logs/grain-link.log
  log.transports.file.resolvePath = () =>
    path.join(logDir, 'grain-link.log');

  log.transports.file.maxSize = 5 * 1024 * 1024; // 5 MB per file
  log.transports.console.level =
    process.env.NODE_ENV === 'development' ? 'debug' : 'info';
  log.transports.file.level = 'info';
}

/* --------------------------------------------------------------------------
   Core logging wrapper
   -------------------------------------------------------------------------- */

const listeners = [];

function onLog(callback) {
  listeners.push(callback);
}

function notifyListeners(level, message, context, line) {
  for (const listener of listeners) {
    try {
      listener({ level, message, context, line, timestamp: new Date().toISOString() });
    } catch (e) {
      console.error('Error in log listener', e);
    }
  }
}

function truncate(val, maxLen = 500) {
  if (typeof val === 'string') {
    return val.length > maxLen
      ? val.substring(0, maxLen) + `...[TRUNCATED ${val.length} chars]`
      : val;
  }
  return val;
}

function safeLogObject(obj, maxLen = 500, depth = 3) {
  if (depth < 0) return '[MAX_DEPTH]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return truncate(obj, maxLen);
  if (typeof obj !== 'object') return obj;

  try {
    if (Array.isArray(obj)) {
      return obj.map((item) => safeLogObject(item, maxLen, depth - 1));
    }

    const newObj = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = safeLogObject(obj[key], maxLen, depth - 1);
      }
    }
    return newObj;
  } catch (e) {
    return '[CIRCULAR_OR_ERROR]';
  }
}

function formatMessage(level, message, context = {}) {
  const appVersion = app.getVersion ? app.getVersion() : 'dev';
  const safeContext = safeLogObject(context);

  const base = {
    level,
    app: 'Grain Link',
    version: appVersion,
    host: hostname,
    ...safeContext,
  };

  return JSON.stringify({
    ...base,
    message,
    ts: new Date().toISOString(),
  });
}

function write(level, message, context = {}) {
  const line = formatMessage(level, message, context);

  // Notify listeners (e.g. for potential debug window)
  if (level !== 'debug') {
    notifyListeners(level, message, context, line);
  }

  switch (level) {
    case 'debug':
      log.debug(line);
      break;
    case 'info':
      log.info(line);
      break;
    case 'warn':
      log.warn(line);
      break;
    case 'error':
    case 'fatal':
      log.error(line);
      break;
    default:
      log.info(line);
      break;
  }
}

module.exports = {
  configureLogger,
  debug: (msg, ctx) => write('debug', msg, ctx),
  info: (msg, ctx) => write('info', msg, ctx),
  warn: (msg, ctx) => write('warn', msg, ctx),
  error: (msg, ctx) => write('error', msg, ctx),
  fatal: (msg, ctx) => write('fatal', msg, ctx),

  /**
   * Called from renderer via IPC:
   * { level, message, context } is forwarded to the logger.
   */
  logFromRenderer: ({ level = 'info', message = '', context = {} } = {}) => {
    write(level, message, { ...context, source: 'renderer' });
  },
  onLog,
};
