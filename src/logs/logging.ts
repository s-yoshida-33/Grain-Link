/**
 * Logging wrapper for Grain Link renderer process
 * Provides unified logging functions with scope/tag support
 * All logs are forwarded to the main process via IPC and written to log file
 */

import type { LogTag, LogContext } from '../types/logging';

/**
 * Build base context with tag and optional extra data
 */
function baseContext(tag: LogTag, extra?: LogContext) {
  return {
    tag,
    scope: tag,  // backward compatibility with main process logger
    ...extra,
  };
}

/**
 * Debug level - Development console only
 * Not written to log file in production
 * @param tag - Log category/scope
 * @param message - Log message
 * @param context - Optional additional context data
 */
export function logDebug(tag: LogTag, message: string, context?: LogContext) {
  window.logger?.debug(message, baseContext(tag, context));
}

/**
 * Info level - Normal operation information
 * Used for successful operations, state changes, etc.
 * @param tag - Log category/scope
 * @param message - Log message
 * @param context - Optional additional context data
 */
export function logInfo(tag: LogTag, message: string, context?: LogContext) {
  window.logger?.info(message, baseContext(tag, context));
}

/**
 * Warning level - Something unexpected but system continues
 * E.g., API returned 0 results, fallback behavior, deprecated usage
 * @param tag - Log category/scope
 * @param message - Log message
 * @param context - Optional additional context data
 */
export function logWarn(tag: LogTag, message: string, context?: LogContext) {
  window.logger?.warn(message, baseContext(tag, context));
}

/**
 * Error level - Error occurred, feature may be broken
 * E.g., API call failed, file not found, invalid data
 * @param tag - Log category/scope
 * @param message - Log message
 * @param context - Optional additional context data
 */
export function logError(tag: LogTag, message: string, context?: LogContext) {
  window.logger?.error(message, baseContext(tag, context));
}

/**
 * Generic log function for non-standard use
 * Prefer specific logDebug/logInfo/logWarn/logError over this
 * @param level - Log level ('debug' | 'info' | 'warn' | 'error')
 * @param message - Log message
 * @param context - Optional context data
 */
export function logMessage(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  context?: LogContext
) {
  window.logger?.[level](message, context);
}
