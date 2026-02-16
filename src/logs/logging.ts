import type { LogTag, LogContext } from '../types/logging';

const logToConsole = (
  level: 'debug' | 'info' | 'warn' | 'error',
  tag: LogTag,
  message: string,
  context?: LogContext
) => {
  const payload = { tag, scope: tag, ...context };
  const logger = console[level] ?? console.log;
  logger(`[${tag}] ${message}`, payload);
};

export function logDebug(tag: LogTag, message: string, context?: LogContext) {
  logToConsole('debug', tag, message, context);
}

export function logInfo(tag: LogTag, message: string, context?: LogContext) {
  logToConsole('info', tag, message, context);
}

export function logWarn(tag: LogTag, message: string, context?: LogContext) {
  logToConsole('warn', tag, message, context);
}

export function logError(tag: LogTag, message: string, context?: LogContext) {
  logToConsole('error', tag, message, context);
}

export function logMessage(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  context?: LogContext
) {
  logToConsole(level, 'GENERAL', message, context);
}
