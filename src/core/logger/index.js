import winston from 'winston';
import { config } from '../../config/env.js';

/**
 * Nama field yang isinya tidak boleh pernah muncul di log.
 */
const SENSITIVE_KEY_PATTERN =
  /(pass(word)?|secret|token|api[-_]?key|authorization|cookie|session|csrf|credential)/i;

/**
 * Sensor rekursif untuk objek/array. String yang sangat panjang
 * (mis. header Authorization) dipotong agar tidak membanjiri log.
 *
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {unknown}
 */
export function redact(value, depth = 0) {
  if (depth > 6) return '[TRUNCATED]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.length > 2048 ? `${value.slice(0, 2048)}…[TRUNCATED]` : value;
  }
  if (typeof value !== 'object') return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }

  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : redact(item, depth + 1);
  }
  return out;
}

const redactFormat = winston.format((info) => {
  // Sensor semua properti tambahan, biarkan level/message/timestamp.
  const { level, message, timestamp, service, ...rest } = info;
  const cleaned = redact(rest);
  return Object.assign(info, cleaned, { level, message, timestamp, service });
});

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  redactFormat(),
  winston.format.json(),
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  redactFormat(),
  winston.format.printf(({ timestamp, level, message, ...rest }) => {
    const extra = Object.keys(rest).length
      ? ` ${JSON.stringify(redact(rest))}`
      : '';
    return `${timestamp} ${level}: ${message}${extra}`;
  }),
);

const transports =
  config.NODE_ENV === 'production'
    ? [new winston.transports.Console({ format: jsonFormat })]
    : [new winston.transports.Console({ format: consoleFormat })];

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  defaultMeta: { service: 'rencanaku-ai' },
  transports,
  // Senyapkan log selama pengujian agar output Vitest bersih.
  // Set LOG_SILENT=0 bila perlu memeriksa isi log pada tes.
  silent: config.NODE_ENV === 'test' && process.env.LOG_SILENT !== '0',
});
