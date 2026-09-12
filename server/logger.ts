import type { Store } from './storage';

import { Request, Response, NextFunction } from 'express';
import { SystemLogEntry, SystemLogLevel, SystemLogModule, SystemLogStats } from '../src/types';
import { formatJalaliDateTime } from '../src/utils/persianFormatter';

export function createLogger(store: Store) {
const MAX_MEMORY_LOGS = 2000;

// Format Persian timestamp with seconds for high-precision audit logs
function getPersianTimestamp(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return formatter.format(date);
  } catch {
    return formatJalaliDateTime(date);
  }
}

// Initial seed logs if none exist yet
const INITIAL_SEED_LOGS: SystemLogEntry[] = [
  {
    id: 'log-seed-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    jalaliTimestamp: getPersianTimestamp(new Date(Date.now() - 1000 * 60 * 60 * 3)),
    level: 'info',
    module: 'SYSTEM',
    message: 'راه‌اندازی اولیه و آماده‌سازی موتور نرخ‌گذاری و دیتابیس گالری اینانا',
    details: { version: '2.5.0', nodeEnv: 'production', port: 3000 },
    ip: '127.0.0.1',
  },
  {
    id: 'log-seed-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    jalaliTimestamp: getPersianTimestamp(new Date(Date.now() - 1000 * 60 * 60 * 2)),
    level: 'price',
    module: 'GOLD_PRICE',
    message: 'دریافت موفق نرخ لحظه‌ای طلای ۱۸ عیار از سامانه وب‌سرویس نوسان (Navasan API)',
    details: { pricePerGram: 23477540, changePercent: 2.03, source: 'Navasan.tech 18ayar' },
    ip: 'system-scheduler',
  },
  {
    id: 'log-seed-3',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    jalaliTimestamp: getPersianTimestamp(new Date(Date.now() - 1000 * 60 * 30)),
    level: 'security',
    module: 'AUTH',
    message: 'ورود موفق به حساب کاربری مدیر ارشد گالری',
    details: { email: 'amirbiashad@gmail.com', role: 'admin' },
    ip: '192.168.1.105',
    userEmail: 'amirbiashad@gmail.com',
  },
  {
    id: 'log-seed-4',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    jalaliTimestamp: getPersianTimestamp(new Date(Date.now() - 1000 * 60 * 15)),
    level: 'order',
    module: 'ORDERS',
    message: 'ثبت سفارش جدید با روش پرداخت کارت به کارت و آپلود موفق فیش بانکی',
    details: { orderId: 'ord-103', trackingCode: 'INA-91042', totalAmount: 24500000, customer: 'مریم کمالی' },
    ip: '5.120.45.18',
  },
];

let logsMemory: SystemLogEntry[] = [...store.map<SystemLogEntry>('logs').values()];
function scheduleSaveLogs(): void {
  store.replaceMap('logs', new Map(logsMemory.slice(0, MAX_MEMORY_LOGS).map(log => [log.id, log])));
}
class LoggerService {
  public addLog(entry: {
    level: SystemLogLevel;
    module: SystemLogModule;
    message: string;
    details?: Record<string, any>;
    ip?: string;
    userId?: string;
    userEmail?: string;
  }): SystemLogEntry {
    const now = new Date();
    const id = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    const newEntry: SystemLogEntry = {
      id,
      timestamp: now.toISOString(),
      jalaliTimestamp: getPersianTimestamp(now),
      level: entry.level,
      module: entry.module,
      message: entry.message,
      details: entry.details,
      ip: entry.ip,
      userId: entry.userId,
      userEmail: entry.userEmail,
    };

    // Prepend to memory buffer
    logsMemory.unshift(newEntry);
    if (logsMemory.length > MAX_MEMORY_LOGS) {
      logsMemory.pop();
    }

    scheduleSaveLogs();
    return newEntry;
  }

  public info(module: SystemLogModule, message: string, details?: Record<string, any>, meta?: { ip?: string; userId?: string; userEmail?: string }) {
    return this.addLog({ level: 'info', module, message, details, ...meta });
  }

  public warn(module: SystemLogModule, message: string, details?: Record<string, any>, meta?: { ip?: string; userId?: string; userEmail?: string }) {
    return this.addLog({ level: 'warn', module, message, details, ...meta });
  }

  public error(module: SystemLogModule, message: string, detailsOrError?: any, meta?: { ip?: string; userId?: string; userEmail?: string }) {
    let details: Record<string, any> = {};
    if (detailsOrError instanceof Error) {
      details = {
        name: detailsOrError.name,
        errorMessage: detailsOrError.message,
        stack: detailsOrError.stack,
      };
    } else if (typeof detailsOrError === 'object' && detailsOrError !== null) {
      details = detailsOrError;
    } else if (detailsOrError) {
      details = { info: String(detailsOrError) };
    }
    return this.addLog({ level: 'error', module, message, details, ...meta });
  }

  public security(module: SystemLogModule, message: string, details?: Record<string, any>, meta?: { ip?: string; userId?: string; userEmail?: string }) {
    return this.addLog({ level: 'security', module, message, details, ...meta });
  }

  public order(module: SystemLogModule, message: string, details?: Record<string, any>, meta?: { ip?: string; userId?: string; userEmail?: string }) {
    return this.addLog({ level: 'order', module, message, details, ...meta });
  }

  public price(module: SystemLogModule, message: string, details?: Record<string, any>, meta?: { ip?: string; userId?: string; userEmail?: string }) {
    return this.addLog({ level: 'price', module, message, details, ...meta });
  }

  public getLogs(params: {
    level?: string;
    module?: string;
    search?: string;
    limit?: number;
    offset?: number;
    since?: string;
  }): { logs: SystemLogEntry[]; total: number; filteredCount: number } {
    const { level, module, search, limit = 50, offset = 0, since } = params;

    let filtered = logsMemory;

    if (level && level !== 'all') {
      filtered = filtered.filter((l) => l.level === level);
    }

    if (module && module !== 'all') {
      filtered = filtered.filter((l) => l.module === module);
    }

    if (since) {
      const sinceTime = new Date(since).getTime();
      filtered = filtered.filter((l) => new Date(l.timestamp).getTime() >= sinceTime);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((l) => {
        const msg = (l.message || '').toLowerCase();
        const ip = (l.ip || '').toLowerCase();
        const user = (l.userEmail || l.userId || '').toLowerCase();
        const mod = (l.module || '').toLowerCase();
        const detailsStr = l.details ? JSON.stringify(l.details).toLowerCase() : '';
        return msg.includes(q) || ip.includes(q) || user.includes(q) || mod.includes(q) || detailsStr.includes(q);
      });
    }

    const total = logsMemory.length;
    const filteredCount = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return { logs: paginated, total, filteredCount };
  }

  public getStats(): SystemLogStats {
    const byLevel: Record<SystemLogLevel, number> = {
      info: 0,
      warn: 0,
      error: 0,
      security: 0,
      order: 0,
      price: 0,
      debug: 0,
    };

    const byModule: Record<SystemLogModule, number> = {
      API: 0,
      AUTH: 0,
      ADMIN: 0,
      ORDERS: 0,
      GOLD_PRICE: 0,
      INVENTORY: 0,
      CLIENT: 0,
      SYSTEM: 0,
    };

    let lastErrorAt: string | undefined = undefined;

    for (const log of logsMemory) {
      if (byLevel[log.level] !== undefined) byLevel[log.level]++;
      if (byModule[log.module] !== undefined) byModule[log.module]++;

      if (log.level === 'error' && !lastErrorAt) {
        lastErrorAt = log.timestamp;
      }
    }

    return {
      total: logsMemory.length,
      byLevel,
      byModule,
      errorsCount: byLevel.error,
      warningsCount: byLevel.warn,
      securityCount: byLevel.security,
      ordersCount: byLevel.order,
      priceCount: byLevel.price,
      lastErrorAt,
    };
  }

  public clearLogs(retainCount: number = 0): void {
    if (retainCount <= 0) {
      logsMemory = [];
    } else {
      logsMemory = logsMemory.slice(0, retainCount);
    }
    scheduleSaveLogs();
  }

  public exportCsv(): string {
    const headers = ['شناسه', 'زمان میلادی', 'زمان شمسی', 'سطح', 'ماژول', 'پیام', 'آدرس IP', 'کاربر', 'جزئیات'];
    const rows = logsMemory.map((l) => [
      l.id,
      l.timestamp,
      `"${l.jalaliTimestamp}"`,
      l.level,
      l.module,
      `"${(l.message || '').replace(/"/g, '""')}"`,
      l.ip || '-',
      l.userEmail || l.userId || '-',
      `"${JSON.stringify(l.details || {}).replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}

const logger = new LoggerService();

// Express Request Logging Middleware
function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Only log API routes and ignore static assets, vite, HMR, etc.
  if (!req.path.startsWith('/api')) {
    return next();
  }

  // Skip high-frequency health checks from polluting logs excessively
  if (req.path === '/api/health') {
    return next();
  }

  const startHr = process.hrtime();
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || '';

  // Intercept response completion
  res.on('finish', () => {
    const diff = process.hrtime(startHr);
    const durationMs = Math.round((diff[0] * 1e3 + diff[1] * 1e-6) * 10) / 10;
    const statusCode = res.statusCode;

    let level: SystemLogLevel = 'info';
    if (statusCode >= 500) {
      level = 'error';
    } else if (statusCode >= 400) {
      level = 'warn';
    }

    let logModule: SystemLogModule = 'API';
    if (req.path.includes('/auth')) logModule = 'AUTH';
    else if (req.path.includes('/orders')) logModule = 'ORDERS';
    else if (req.path.includes('/gold-price') || req.path.includes('/gold-history')) logModule = 'GOLD_PRICE';
    else if (req.path.includes('/cart')) logModule = 'INVENTORY';

    // If order was created or status changed
    if (req.path.startsWith('/api/orders') && req.method === 'POST') {
      level = 'order';
    }

    // Skip verbose logs for admin polling of logs themselves
    if (req.path.startsWith('/api/admin/logs') || (req.method === 'GET' && statusCode < 400)) {
      return;
    }

    logger.addLog({
      level,
      module: logModule,
      message: `${req.method} ${req.path} -> ${statusCode} (${durationMs}ms)`,
      details: {
        method: req.method,
        path: req.path,
        statusCode,
        durationMs,
        userAgent: userAgent.substring(0, 100),
      },
      ip: clientIp,
    });
  });

  next();
}

return { logger, requestLoggerMiddleware };
}
