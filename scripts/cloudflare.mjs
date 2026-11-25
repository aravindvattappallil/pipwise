import {spawnSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {configureToolEnvironment} from './tool-environment.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);configureToolEnvironment(root);
const action=process.argv[2];
if(!['check','build','deploy','migrate'].includes(action))throw Error('Expected check, build, migrate, or deploy.');
const checking=action==='check';
const configPath=path.resolve(checking?'wrangler.cloudflare.example.json':'wrangler.cloudflare.json');
if(!existsSync(configPath))throw Error('Copy wrangler.cloudflare.example.json to wrangler.cloudflare.json and fill in your Cloudflare account, database ID and app URL.');
const config=JSON.parse(readFileSync(configPath,'utf8'));
if(!checking){
 if(!/^[a-f0-9]{32}$/i.test(config.account_id)||config.d1_databases?.[0]?.database_id==='00000000-0000-4000-8000-000000000000')throw Error('Configure your actual Cloudflare account and D1 database IDs first.');
 const origin=new URL(config.vars?.APP_ORIGIN);
 if(origin.protocol!=='https:'||origin.origin!==config.vars.APP_ORIGIN||origin.hostname.endsWith('.chatgpt.site')||origin.hostname.includes('YOUR-SUBDOMAIN'))throw Error('APP_ORIGIN must be your independent HTTPS app origin, with no trailing slash.');
}
function run(args,env={}){
 const r=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,...env}});
 if(r.error)throw r.error;if(r.status!==0)process.exit(r.status??1);
}
const wrangler=['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js'];
if(action!=='migrate')run(['scripts/run-framework.mjs','build'],{PIPWISE_CLOUDFLARE_CONFIG:configPath});
if(action==='migrate'||action==='deploy')run([...wrangler,'d1','migrations','apply','DB','--remote','--config',configPath]);
if(checking)run([...wrangler,'deploy','--dry-run','--config','dist/server/wrangler.json']);
if(action==='deploy')run([...wrangler,'deploy','--config','dist/server/wrangler.json']);
