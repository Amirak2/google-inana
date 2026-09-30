import assert from 'node:assert/strict';
import { loadGoldHistory } from '../src/utils/goldHistory.ts';
const point = { price: 25000000, time: 'امروز', date: '۱۴۰۵/۷/۹', isEstimated: false };
const estimated = { ...point, isEstimated: true };
for (const range of ['24h', '7d', '1m', '3m', '1y']) {
  const result = await loadGoldHistory(range, undefined, async url => {
    assert.equal(url, `/api/gold-history?range=${range}`);
    return Response.json({ points: [point, estimated] });
  });
  assert.deepEqual(result, [point, estimated]);
}
await assert.rejects(loadGoldHistory('1y', undefined, async () => { throw new Error('Network failure'); }), /Network failure/);
await assert.rejects(loadGoldHistory('1y', undefined, async () => new Response('', { status: 503 })), /انجام نشد/);
await assert.rejects(loadGoldHistory('7d', undefined, async () => Response.json({ points: [{ price: -1 }] })), /معتبر نیست/);
await assert.rejects(loadGoldHistory('7d', undefined, async () => new Response('not json')), SyntaxError);
assert.deepEqual(await loadGoldHistory('1y', undefined, async () => Response.json({ points: [] })), []);
console.log('PASS: correct ranges, preserve estimation labels, error/invalid data never creates artificial prices, empty history stays empty.');
