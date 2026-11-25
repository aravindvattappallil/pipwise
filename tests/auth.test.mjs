import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT,createLocalJWKSet,exportJWK} from 'jose';
import {safeReturnTo,loginPath} from '../lib/auth-navigation.ts';
import {randomToken,hashToken,validToken,readCookie,authCookie,cookieNames,appOrigin,sameOriginRequest} from '../lib/auth-utils.ts';
import {verifyGoogleToken} from '../lib/google-token.ts';
test('return URLs cannot escape the app or loop through authentication',()=>{
 for(const unsafe of ['https://evil.test','//evil.test','/\\evil.test','/api/auth/google','/login','javascript:alert(1)',null])assert.equal(safeReturnTo(unsafe),'/');
 assert.equal(safeReturnTo('/profile?user=abc'),'/profile?user=abc');
 assert.equal(loginPath('/saved'),'/login?next=%2Fsaved');
});
test('tokens are random, hashed, and validated',async()=>{const a=randomToken(),b=randomToken();assert.ok(validToken(a));assert.notEqual(a,b);assert.notEqual(await hashToken(a),a);assert.equal(await hashToken(a),await hashToken(a));assert.ok(!validToken('1'));});
test('cookies have secure scope and ambiguous cookies are rejected',()=>{
 assert.equal(readCookie('pipwise_session=a; pipwise_session=b','pipwise_session'),null);
 const names=cookieNames('https://example.com');assert.equal(names.session,'__Host-pipwise_session');
 const c=authCookie('https://example.com',names.session,'abc',60);assert.match(c,/Secure/);assert.match(c,/HttpOnly/);assert.match(c,/SameSite=Lax/);assert.ok(!c.includes('Domain='));
 assert.equal(appOrigin('http://evil.test'),null);assert.equal(appOrigin('http://127.0.0.1:5173'),'http://127.0.0.1:5173');
});
test('logout requires a same-origin request',()=>{
 assert.ok(sameOriginRequest(new Request('https://app.test/logout',{headers:{Origin:'https://app.test'}}),'https://app.test'));
 assert.ok(!sameOriginRequest(new Request('https://app.test/logout',{headers:{Origin:'https://evil.test'}}),'https://app.test'));
});
const pair=await generateKeyPair('RS256');const jwk=await exportJWK(pair.publicKey);jwk.kid='test';const keys=createLocalJWKSet({keys:[jwk]});
async function token(overrides={}){return new SignJWT({email:'trader@example.test',email_verified:true,nonce:'test-nonce',name:'Test Trader',...overrides}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://accounts.google.com').setAudience('test-client').setSubject('google-subject').setIssuedAt().setExpirationTime('5m').sign(pair.privateKey);}
test('Google tokens require verified signature, issuer, audience and nonce',async()=>{
 const good=await token();const user=await verifyGoogleToken(good,'test-client','test-nonce',keys);assert.equal(user.subject,'google-subject');
 await assert.rejects(()=>verifyGoogleToken(good,'other-client','test-nonce',keys));
 await assert.rejects(()=>verifyGoogleToken(good,'test-client','wrong-nonce',keys));
 await assert.rejects(async()=>verifyGoogleToken(await token({email_verified:false}),'test-client','test-nonce',keys));
 await assert.rejects(async()=>verifyGoogleToken(await token({azp:'other-client'}),'test-client','test-nonce',keys));
 const badPair=await generateKeyPair('RS256');const forged=await new SignJWT({email:'trader@example.test',email_verified:true,nonce:'test-nonce'}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://accounts.google.com').setAudience('test-client').setSubject('google-subject').setIssuedAt().setExpirationTime('5m').sign(badPair.privateKey);
 await assert.rejects(()=>verifyGoogleToken(forged,'test-client','test-nonce',keys));
});
