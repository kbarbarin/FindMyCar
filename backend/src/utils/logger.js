// Logger minimaliste structuré JSON en prod, humain en dev.
import { config } from '../config/index.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function emit(level, msg, ctx = {}) {
  if (LEVELS[level] < MIN) return;
  const line = { ts: new Date().toISOString(), level, msg, ...ctx };
  if (config.env === 'production') {
    process.stdout.write(JSON.stringify(line) + '\n');
  } else {
    const tag = { debug: '·', info: '›', warn: '⚠', error: '✖' }[level] || '·';
    const extra = Object.keys(ctx).length ? ' ' + JSON.stringify(ctx) : '';
    process.stdout.write(`${tag} [${level}] ${msg}${extra}\n`);
  }
}

export const logger = {
  debug: (msg, ctx) => emit('debug', msg, ctx),
  info:  (msg, ctx) => emit('info',  msg, ctx),
  warn:  (msg, ctx) => emit('warn',  msg, ctx),
  error: (msg, ctx) => emit('error', msg, ctx),
  child: (base) => ({
    debug: (msg, ctx) => emit('debug', msg, { ...base, ...ctx }),
    info:  (msg, ctx) => emit('info',  msg, { ...base, ...ctx }),
    warn:  (msg, ctx) => emit('warn',  msg, { ...base, ...ctx }),
    error: (msg, ctx) => emit('error', msg, { ...base, ...ctx }),
  }),
};
