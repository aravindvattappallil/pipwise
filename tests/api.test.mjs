import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync} from 'node:fs';
import path from 'node:path';
import {randomToken,hashToken} from '../lib/auth-utils.ts';
if(!process.env.PIPWISE_TEST_DB_ROOT)throw new Error('Run npm run test:api to use the isolated test database.');
const directory=path.join(process.env.PIPWISE_TEST_DB_ROOT,'v3/d1/miniflare-D1DatabaseObject');
const filename=readdirSync(directory).find(n=>n.endsWith('.sqlite')&&n!=='metadata.sqlite');
const db=new DatabaseSync(path.join(directory,filename));db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON');
const sessions=new Map();
async function session(user){
 if(sessions.has(user))return sessions.get(user);
 const value=randomToken(),now=Date.now();
 db.prepare('INSERT OR IGNORE INTO profiles (id,name,username,bio,joined) VALUES (?,?,?,?,?)').run(user,'QA Trader',user,'',new Date(now).toISOString());
 db.prepare('INSERT OR IGNORE INTO google_accounts (subject,user_id,email,created,last_login) VALUES (?,?,?,?,?)').run(user,user,user+'@example.test',new Date(now).toISOString(),new Date(now).toISOString());
 db.prepare('INSERT INTO auth_sessions (token_hash,user_id,expires,created) VALUES (?,?,?,?)').run(await hashToken(value),user,now+3600000,now);
 const cookie='pipwise_session='+value;sessions.set(user,cookie);return cookie;
}
const origin='http://127.0.0.1:8787';
const run=Date.now().toString(36);
const a=`qa-author-${run}`,b=`qa-reader-${run}`;
const call=async(user,path='/api/community',data)=>{
 const headers=user?{Cookie:await session(user)}:{};
 const r=await fetch(origin+path,{method:data?'POST':'GET',headers:{...headers,...(data?{'Content-Type':'application/json',Origin:origin}:{})},body:data?JSON.stringify(data):undefined});
 return {status:r.status,data:await r.json()};
};
test('journal privacy, ownership, likes, bookmarks, profiles and deletion',async()=>{
 assert.equal((await call(null)).status,401);
 await call(a);await call(b);
 const draft={title:'API test journal',body:'Disposable local QA reflection.',category:'Trade recap',symbol:'EUR/USD'};
 const privateResult=await call(a,'/api/community',{...draft,action:'create',visibility:'private'});assert.equal(privateResult.status,200);const privateId=privateResult.data.id;
 const publicResult=await call(a,'/api/community',{...draft,action:'create',visibility:'public'});assert.equal(publicResult.status,200);const publicId=publicResult.data.id;
 const feed=(await call(b)).data.journals;assert.ok(feed.some(j=>j.id===publicId));assert.ok(!feed.some(j=>j.id===privateId));
 const personal=(await call(a,'/api/community?view=journal')).data.journals;assert.ok(personal.some(j=>j.id===privateId));
 const profile=(await call(b,`/api/community?view=profile&user=${a}`)).data.journals;assert.ok(profile.some(j=>j.id===publicId));assert.ok(!profile.some(j=>j.id===privateId));
 for(const action of ['edit','delete','like','save']) {const denied=await call(b,'/api/community',{...draft,action,id:privateId,active:true});assert.ok([403,404].includes(denied.status),action);}
 assert.equal((await call(b,'/api/community',{...draft,action:'edit',id:publicId})).status,404);
 assert.equal((await call(b,'/api/community',{action:'delete',id:publicId})).status,403);
 await call(b,'/api/community',{action:'like',id:publicId,active:true});await call(b,'/api/community',{action:'like',id:publicId,active:true});await call(b,'/api/community',{action:'save',id:publicId,active:true});
 const saved=(await call(b,'/api/community?view=saved')).data.journals.find(j=>j.id===publicId);assert.equal(saved.like_count,1);assert.equal(saved.liked,1);assert.equal(saved.saved,1);
 await call(a,'/api/community',{...draft,action:'edit',id:publicId,visibility:'private'});
 assert.ok(!(await call(b,'/api/community?view=saved')).data.journals.some(j=>j.id===publicId));
 assert.equal((await call(a,'/api/community',{action:'profile',name:'QA Author',username:`qa-${run}`,bio:'Test profile'})).status,200);
 assert.equal((await call(b,'/api/community',{action:'profile',name:'QA Reader',username:`qa-${run}`,bio:''})).status,409);
 assert.equal((await call(a,'/api/community',{...draft,action:'create',title:''})).status,400);
 await call(a,'/api/community',{action:'delete',id:privateId});await call(a,'/api/community',{action:'delete',id:publicId});
 const remaining=(await call(a,'/api/community?view=journal')).data.journals;assert.equal(remaining.length,0);
});
test('profile photo upload and retrieval',async()=>{
 const user=`qa-photo-${run}`;await call(user);
 const form=new FormData();form.append('photo',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')],{type:'image/png'}),'pixel.png');
 const headers={Cookie:await session(user),Origin:origin};
 const r=await fetch(origin+'/api/avatar',{method:'POST',headers,body:form});assert.equal(r.status,200);const {avatar}=await r.json();assert.ok(avatar.startsWith('avatars/'));
 const image=await fetch(origin+`/api/avatar?key=${encodeURIComponent(avatar)}`,{headers});assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');
 const remove=new FormData();remove.append('remove','true');assert.equal((await fetch(origin+'/api/avatar',{method:'POST',headers,body:remove})).status,200);
});

test('all app pages require a server-validated session',async()=>{
 for(const route of ['/','/journal','/saved','/profile','/tools/risk-calculator']){
  const r=await fetch(origin+route,{redirect:'manual'});assert.equal(r.status,307,route);assert.match(r.headers.get('location'),/^\/login\?next=/);const html=await r.text();assert.ok(!html.includes('YOUR COMMUNITY'));
 }
 const forged=await fetch(origin+'/api/community',{headers:{'oai-authenticated-user-id':a,'oai-authenticated-user-email':a+'@example.test',Cookie:'__sites_local_auth=1'}});assert.equal(forged.status,401);
 assert.equal((await fetch(origin+'/api/avatar?key=avatars/test')).status,401);
 const protectedPage=await fetch(origin+'/saved',{headers:{Cookie:await session(a)}});assert.equal(protectedPage.status,200);assert.match(protectedPage.headers.get('cache-control'),/no-store/);
});
test('OAuth uses browser-bound one-time state and safe return URLs',async()=>{
 const start=await fetch(origin+'/api/auth/google?next=https://evil.test',{redirect:'manual'});assert.equal(start.status,303);
 const auth=new URL(start.headers.get('location'));assert.equal(auth.origin,'https://accounts.google.com');assert.equal(auth.searchParams.get('code_challenge_method'),'S256');assert.equal(auth.searchParams.get('scope'),'openid email profile');assert.ok(!auth.toString().includes('local-test-only'));
 const cookie=start.headers.get('set-cookie').split(';')[0];
 const state=auth.searchParams.get('state');
 const unbound=await fetch(origin+'/api/auth/google/callback?state='+state+'&error=access_denied',{redirect:'manual'});assert.match(unbound.headers.get('location'),/error=expired/);
 const bound=await fetch(origin+'/api/auth/google/callback?state='+state+'&error=access_denied',{headers:{Cookie:cookie},redirect:'manual'});assert.match(bound.headers.get('location'),/error=cancelled/);
 const replay=await fetch(origin+'/api/auth/google/callback?state='+state+'&error=access_denied',{headers:{Cookie:cookie},redirect:'manual'});assert.match(replay.headers.get('location'),/error=expired/);
});
test('logout revokes sessions and rejects cross-origin requests',async()=>{
 const cookie=await session('qa-logout-'+run);
 assert.equal((await fetch(origin+'/api/auth/session',{headers:{Cookie:cookie}})).status,200);
 const denied=await fetch(origin+'/api/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:'https://evil.test'},redirect:'manual'});assert.equal(denied.status,403);
 const out=await fetch(origin+'/api/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:origin},redirect:'manual'});assert.equal(out.status,303);assert.match(out.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await fetch(origin+'/api/auth/session',{headers:{Cookie:cookie}})).status,401);
});
