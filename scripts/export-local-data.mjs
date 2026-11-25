import {DatabaseSync} from 'node:sqlite';
import {readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const dataTables=['profiles','google_accounts','journals','likes','bookmarks'];
export function exportSql(db){
 db.exec('BEGIN');
 try{
  const rows=Object.fromEntries(dataTables.map(t=>[t,db.prepare(`SELECT * FROM ${t}`).all()]));
  if(rows.profiles.some(p=>p.avatar))throw Error('Profile photos exist. Copy the R2 objects as part of migration before importing this database.');
  const literal=v=>v===null?'NULL':typeof v==='number'?String(v):`CAST(X'${Buffer.from(String(v),'utf8').toString('hex')}' AS TEXT)`;
  const statements=['-- Pipwise data only. Import once into a new, migrated D1 database.','-- Sessions and OAuth flows are deliberately excluded.'];
  for(const t of dataTables)for(const row of rows[t]){
   const columns=Object.keys(row);
   statements.push(`INSERT INTO ${t} (${columns.map(c=>'"'+c+'"').join(',')}) VALUES (${columns.map(c=>literal(row[c])).join(',')});`);
  }
  return {sql:statements.join('\n')+'\n',counts:Object.fromEntries(dataTables.map(t=>[t,rows[t].length]))};
 }finally{db.exec('ROLLBACK');}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=fileURLToPath(new URL('../',import.meta.url));
 const dir=path.join(root,'.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
 const files=readdirSync(dir).filter(n=>n.endsWith('.sqlite')&&n!=='metadata.sqlite');
 if(files.length!==1)throw Error('Expected one local database; select the intended database before exporting.');
 const db=new DatabaseSync(path.join(dir,files[0]),{readOnly:true});
 const snapshot=exportSql(db);db.close();
 const outputDir=path.join(root,'.sites-runtime/backups');mkdirSync(outputDir,{recursive:true});
 const output=path.join(outputDir,`pipwise-data-${Date.now()}.sql`);
 writeFileSync(output,snapshot.sql,{mode:0o600});
 console.log(JSON.stringify({file:output,counts:snapshot.counts}));
}
