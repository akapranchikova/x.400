import pino, { Logger, LoggerOptions } from 'pino';

const baseConfig: LoggerOptions = {
  level: process.env.X400_LOG_LEVEL || 'info',
  redact: {
    paths: ['headers.authorization', 'attachments', 'envelope.to', 'envelope.cc', 'envelope.bcc'],
    censor: '[REDACTED]'
  },
  messageKey: 'message',
  timestamp: pino.stdTimeFunctions.isoTime
};

let rootLogger: Logger | undefined;

export const getLogger = (options: LoggerOptions = {}): Logger => {
  if (!rootLogger) {
    rootLogger = pino({ ...baseConfig, ...options });
  }

  return rootLogger.child(options);
};

export const createChildLogger = (bindings: Record<string, unknown>): Logger => {
  const logger = getLogger();
  return logger.child(bindings);
};
