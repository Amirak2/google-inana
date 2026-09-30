import { isIP } from 'node:net';
import type { Application } from 'express';

export function normalizeClientIp(value?: string): string {
  if (!value || !isIP(value)) return 'unknown';
  return value.startsWith('::ffff:') && isIP(value.slice(7)) === 4 ? value.slice(7) : value.toLowerCase();
}

// Liara's ingress reaches the app over its private network. Trust only that
// immediate hop, never arbitrary public peers or a client-supplied CF header.
export function configureTrustedProxy(app: Application, cidrs?: string): void {
  app.set('trust proxy', cidrs ? cidrs.split(',').map(value => value.trim()).filter(Boolean) : ['loopback', 'linklocal', 'uniquelocal']);
  const trustedAddress = app.get('trust proxy fn');
  app.set('trust proxy', (address: string, hop: number) => hop === 0 && trustedAddress(address));
}
