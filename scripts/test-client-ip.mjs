import assert from 'node:assert/strict';
import express from 'express';
import router from '../server/router.ts';
import { configureTrustedProxy, normalizeClientIp } from '../server/clientIp.ts';
import { requestWrites } from '../server/requestPolicy.ts';

const app = express();
configureTrustedProxy(app);
const trust = app.get('trust proxy fn');
assert.equal(trust('10.0.0.5', 0), true);
assert.equal(trust('10.0.0.5', 1), false);
assert.equal(trust('203.0.113.10', 0), false);
assert.equal(normalizeClientIp('::ffff:198.51.100.9'), '198.51.100.9');
assert.equal(normalizeClientIp('invalid'), 'unknown');
app.get('/', (req,res) => res.json({ ip: normalizeClientIp(req.ip) }));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
try {
  const response = await fetch(`http://127.0.0.1:${server.address().port}`, { headers: { 'x-forwarded-for': '203.0.113.1, 198.51.100.7', 'cf-connecting-ip': '192.0.2.44' } });
  assert.equal((await response.json()).ip, '198.51.100.7'); // Closest ingress entry, not spoofed leftmost/CF.
} finally { await new Promise(resolve => server.close(resolve)); }
const adapter = router();
adapter.get('/', (req,res) => res.json({ ip: req.ip }));
const forged = new Request('http://localhost', { headers: { 'x-forwarded-for': '192.0.2.1', 'cf-connecting-ip': '192.0.2.2' } });
assert.equal((await (await adapter.fetch(forged)).json()).ip, 'unknown');
assert.equal((await (await adapter.fetch(forged, { clientIp: '198.51.100.8' })).json()).ip, '198.51.100.8');
assert.equal(requestWrites('GET', '/api/orders/track/SALE01'), true);
assert.equal(requestWrites('HEAD', '/api/orders/track/SALE01'), true);
assert.equal(requestWrites('GET', '/api/products/pearl-p3'), true);
assert.equal(requestWrites('GET', '/api/collections'), false);
console.log('PASS: immediate trusted proxy only, Liara XFF, spoofed CF/leftmost XFF ignored, IP normalization and tracking persistence policy.');
