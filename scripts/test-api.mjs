import {spawn,spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),testDir=path.join(root,'.sites-runtime','auth-api-test');
await mkdir(testDir,{recursive:true});
const config=JSON.parse(await readFile('dist/server/wrangler.json','utf8'));
config.main=path.join(root,'dist/server/index.js');
config.assets.directory=path.join(root,'dist/client');
config.vars={APP_ORIGIN:'http://127.0.0.1:8787',GOOGLE_CLIENT_ID:'local-test-client',GOOGLE_CLIENT_SECRET:'local-test-only'};
const configPath=path.join(testDir,'wrangler.json');await writeFile(configPath,JSON.stringify(config));
const persist=path.join(root,'.wrangler','auth-api-test');
const args=['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js'];
for(const file of ['drizzle/0000_black_wiccan.sql','drizzle/0001_spicy_reptil.sql']){
 const sql=(await readFile(file,'utf8')).replaceAll('CREATE TABLE `','CREATE TABLE IF NOT EXISTS `').replaceAll('CREATE UNIQUE INDEX `','CREATE UNIQUE INDEX IF NOT EXISTS `');
 const bootstrap=path.join(testDir,path.basename(file));await writeFile(bootstrap,sql);
 const r=spawnSync(process.execPath,[...args,'d1','execute','DB','--local','--config',configPath,'--persist-to',persist,'--file',bootstrap],{encoding:'utf8'});
 if(r.status!==0){process.stderr.write(r.stderr);process.exit(1);}
}
const server=spawn(process.execPath,[...args,'dev','--local','--config',configPath,'--persist-to',persist,'--ip','127.0.0.1','--port','8787','--inspector-port','0'],{stdio:['ignore','ignore','pipe']});
let errors='';server.stderr.on('data',b=>{errors+=b.toString();});
try{
 let ready=false;
 for(let i=0;i<40;i++){
  if(server.exitCode!==null)throw new Error(errors);
  try{const r=await fetch('http://127.0.0.1:8787/api/auth/session');if(r.status===401){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,250));
 }
 if(!ready)throw new Error('Local test server did not become ready.');
 const code=await new Promise(resolve=>{const child=spawn(process.execPath,['--test','tests/api.test.mjs'],{stdio:'inherit',env:{...process.env,PIPWISE_TEST_DB_ROOT:persist}});child.on('exit',resolve);});
 process.exitCode=code||0;
}catch(e){process.stderr.write(String(e));process.exitCode=1;}finally{server.kill('SIGTERM');}
