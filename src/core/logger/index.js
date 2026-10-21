import winston from 'winston';
import { config } from '../../config/env.js';

// Konfigurasi formatter untuk log structured
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Konfigurasi transport berdasarkan environment
const transports = [];

if (config.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'data/logs/error.log',
      level: 'error',
      format: logFormat,
    }),
    new winston.transports.File({
      filename: 'data/logs/combined.log',
      format: logFormat,
    })
  );
} else {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

/**
 * Logger instance dengan konfigurasi yang disesuaikan
 */
export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: logFormat,
  defaultMeta: { service: 'rencanaku-ai' },
  transports,
});

// Redaction untuk menghindari log sensitive data
export function redactSecrets(obj) {
  const redacted = { ...obj };
  
  // Daftar field yang mungkin berisi secret
  const sensitiveFields = ['password', 'secret', 'token', 'key', 'apiKey', 'session'];
  
  function recursivelyRedact(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => recursivelyRedact(item));
    }
    
    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.length > 0) {
        // Jika field mengandung sensitive field, redact
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          newObj[key] = '[REDACTED]';
        } else {
          newObj[key] = value;
        }
      } else {
        newObj[key] = recursivelyRedact(value);
      }
    }
    
    return newObj;
  }
  
  return recursivelyRedact(redacted);
}
