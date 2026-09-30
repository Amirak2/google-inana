import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const port=43127;
const child=spawn(process.execPath,['dist/server.js'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
try {
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Server startup timed out')),10000);
    child.once('exit',code=>{clearTimeout(timeout);reject(new Error(`Server exited: ${code}`));});
    child.stdout.on('data',chunk=>{if(chunk.toString().includes('listening')){clearTimeout(timeout);resolve();}});
  });
  for(const sku of ['p3','class10','p9']){
    const response=await fetch(`http://127.0.0.1:${port}/products/pearls/${sku}-white.png`);
    assert.equal(response.status,200);
    assert.equal(response.headers.get('content-type'),'image/png');
    const bytes=Buffer.from(await response.arrayBuffer());
    const original=await readFile(path.join(process.env.PEARL_MEDIA_DIR,`${sku}-white.png`));
    assert.ok(bytes.equals(original));
    console.log(`Backend storage route verified: ${sku}`);
  }
  const direct=await fetch(`${process.env.LIARA_ENDPOINT}/${process.env.LIARA_BUCKET_NAME}/products/pearls/p3-white.png`);
  assert.ok([401,403].includes(direct.status),`Bucket must block anonymous access; received ${direct.status}`);
  console.log('Anonymous direct bucket access denied');
} finally {
  child.kill();
}
