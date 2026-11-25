import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {exportSql} from '../scripts/export-local-data.mjs';
function database(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const file of ['0000_black_wiccan.sql','0001_spicy_reptil.sql'])db.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));return db;}
test('cloud export preserves ownership, visibility and Unicode without copying sessions',()=>{
 const source=database(),target=database();
 source.prepare('INSERT INTO profiles(id,name,username,bio,joined) VALUES (?,?,?,?,?)').run('one','Trader','trader',"A quote ' and മലയാളം",'2026-11-25');
 source.prepare('INSERT INTO google_accounts VALUES (?,?,?,?,?)').run('subject','one','trader@example.test','2026-11-25','2026-11-25');
 source.prepare('INSERT INTO journals VALUES (?,?,?,?,?,?,?,?,?)').run('journal','one',"Trader's notes",'Private reflection','Trade recap','private','','2026-11-25','2026-11-25');
 source.prepare('INSERT INTO auth_sessions VALUES (?,?,?,?)').run('session-secret','one',999999,0);
 const snapshot=exportSql(source);target.exec(snapshot.sql);
 assert.equal(target.prepare('SELECT bio FROM profiles').get().bio,"A quote ' and മലയാളം");
 assert.deepEqual({...target.prepare('SELECT author_id,visibility FROM journals').get()},{author_id:'one',visibility:'private'});
 assert.equal(target.prepare('SELECT COUNT(*) AS count FROM auth_sessions').get().count,0);
 assert.equal(target.prepare('SELECT subject FROM google_accounts').get().subject,'subject');
 assert.throws(()=>target.exec(snapshot.sql),/UNIQUE/);
 assert.equal(source.prepare('SELECT COUNT(*) AS count FROM journals').get().count,1);
 source.close();target.close();
});
test('export refuses to silently omit uploaded photos',()=>{
 const db=database();db.exec("INSERT INTO profiles VALUES ('one','Trader','trader','','avatars/photo','2026-11-25')");
 assert.throws(()=>exportSql(db),/R2 objects/);db.close();
});
