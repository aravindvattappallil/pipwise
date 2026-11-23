import test from 'node:test';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:8787';
const run=Date.now().toString(36);
const a=`qa-author-${run}`,b=`qa-reader-${run}`;
const call=async(user,path='/api/community',data)=>{
 const headers=user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':`${user}@example.test`}:{};
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
 const headers={'oai-authenticated-user-id':user,'oai-authenticated-user-email':`${user}@example.test`,Origin:origin};
 const r=await fetch(origin+'/api/avatar',{method:'POST',headers,body:form});assert.equal(r.status,200);const {avatar}=await r.json();assert.ok(avatar.startsWith('avatars/'));
 const image=await fetch(origin+`/api/avatar?key=${encodeURIComponent(avatar)}`);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');
 const remove=new FormData();remove.append('remove','true');assert.equal((await fetch(origin+'/api/avatar',{method:'POST',headers,body:remove})).status,200);
});
