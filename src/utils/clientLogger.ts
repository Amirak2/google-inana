import { SystemLogLevel, SystemLogModule } from '../types';

interface LogPayload {
  level: SystemLogLevel;
  module: SystemLogModule;
  message: string;
  details?: Record<string, any>;
}

const recentLogs = new Set<string>();

export async function logClientEvent(
  level: SystemLogLevel,
  module: SystemLogModule,
  message: string,
  details?: Record<string, any>
): Promise<void> {
  const dedupeKey = `${level}-${module}-${message}`;
  if (recentLogs.has(dedupeKey)) return;
  recentLogs.add(dedupeKey);
  setTimeout(() => recentLogs.delete(dedupeKey), 5000);

  try {
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level,
        module,
        message,
        details: {
          ...details,
          url: window.location.href,
          userAgent: navigator.userAgent,
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
        },
      } as LogPayload),
    });
  } catch {
    // Fail silently on network errors so logging never breaks app flow
  }
}

// Global window error listener setup
let isInitialized = false;
export function initClientErrorLogging(): void {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  window.addEventListener('error', (event) => {
    // Filter out benign Vite websocket reload errors
    if (event.message && event.message.includes('WebSocket')) return;

    logClientEvent('error', 'CLIENT', `خطای کلاینت: ${event.message || 'نامشخص'}`, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const errorMsg = typeof reason === 'string' ? reason : reason?.message || 'رد شدن ناشناخته Promise';
    
    if (errorMsg.includes('WebSocket')) return;

    logClientEvent('error', 'CLIENT', `خطای پردازش‌نشده ناهمگام: ${errorMsg}`, {
      reason: String(reason),
      stack: reason?.stack,
    });
  });
}
