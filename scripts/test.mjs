import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
export async function run(args) {
  await new Promise((resolve, reject) => {
    const processHandle = spawn(process.execPath, args, { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test' } });
    processHandle.once('error', reject);
    processHandle.once('exit', code => code === 0 ? resolve() : reject(new Error(`Check failed (${code}): ${args.join(' ')}`)));
  });
}
const tests = (await readdir(new URL('./', import.meta.url))).filter(name => /^test-.+\.mjs$/.test(name)).sort();
await run(['node_modules/typescript/bin/tsc', '--noEmit']);
for (const test of [...tests, 'verify-auth-security.mjs', 'verify.mjs']) {
  console.log(`\nChecking ${test}`);
  await run(['--import', 'tsx', `scripts/${test}`]);
}
console.log(`PASS: TypeScript and ${tests.length + 2} test suites.`);
