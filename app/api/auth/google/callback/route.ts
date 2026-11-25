import {env} from 'cloudflare:workers';
import {getAuthConfig} from '../../../../../lib/auth';
import {authCookie,cookieNames,hashToken,randomToken,readCookie,SESSION_SECONDS,validToken} from '../../../../../lib/auth-utils';
import {safeReturnTo} from '../../../../../lib/auth-navigation';
import {verifyGoogleToken} from '../../../../../lib/google-token';
export const dynamic='force-dynamic';
type Flow={verifier:string;nonce:string;return_to:string};
export async function GET(request:Request){
 const config=getAuthConfig();
 if(!config)return Response.redirect(new URL('/login?error=configuration',request.url),303);
 const names=cookieNames(config.origin);
 function response(path:string,session?:string){
  const headers=new Headers({Location:config!.origin+path,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
  headers.append('Set-Cookie',authCookie(config!.origin,names.flow,'',0));
  if(session)headers.append('Set-Cookie',authCookie(config!.origin,names.session,session,SESSION_SECONDS));
  return new Response(null,{status:303,headers});
 }
 try {
  const url=new URL(request.url),state=url.searchParams.get('state'),browser=readCookie(request.headers.get('cookie'),names.flow);
  if(url.origin!==config.origin || !validToken(state)||!validToken(browser))return response('/login?error=expired');
  // One-time state is bound to this browser and consumed atomically.
  const flow=await env.DB!.prepare('DELETE FROM oauth_flows WHERE state_hash=? AND browser_hash=? AND expires>? RETURNING verifier,nonce,return_to').bind(await hashToken(state),await hashToken(browser),Date.now()).first<Flow>();
  if(!flow)return response('/login?error=expired');
  if(url.searchParams.has('error'))return response('/login?error=cancelled');
  const code=url.searchParams.get('code');
  if(!code || code.length>4096)return response('/login?error=failed');
  const tokens=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,code,code_verifier:flow.verifier,grant_type:'authorization_code',redirect_uri:config.redirectUri}),signal:AbortSignal.timeout(15000)});
  if(!tokens.ok)return response('/login?error=failed');
  const result=await tokens.json() as {id_token?:string};
  if(typeof result.id_token!=='string')return response('/login?error=failed');
  const identity=await verifyGoogleToken(result.id_token,config.clientId,flow.nonce);
  let account=await env.DB!.prepare('SELECT user_id FROM google_accounts WHERE subject=?').bind(identity.subject).first<{user_id:string}>();
  const now=new Date().toISOString();
  if(!account){
   const userId=crypto.randomUUID();
   // Never associate accounts from an email address alone.
   await env.DB!.batch([
    env.DB!.prepare('INSERT INTO profiles (id,name,username,bio,joined) VALUES (?,?,?,?,?)').bind(userId,identity.name,`trader-${crypto.randomUUID().slice(0,12)}`,'',now),
    env.DB!.prepare('INSERT OR IGNORE INTO google_accounts (subject,user_id,email,created,last_login) VALUES (?,?,?,?,?)').bind(identity.subject,userId,identity.email,now,now),
   ]);
   account=await env.DB!.prepare('SELECT user_id FROM google_accounts WHERE subject=?').bind(identity.subject).first<{user_id:string}>();
   if(!account)return response('/login?error=failed');
  }
  const session=randomToken(),previous=readCookie(request.headers.get('cookie'),names.session)||'';
  await env.DB!.batch([
   env.DB!.prepare('UPDATE google_accounts SET email=?,last_login=? WHERE subject=?').bind(identity.email,now,identity.subject),
   env.DB!.prepare('DELETE FROM auth_sessions WHERE expires<? OR token_hash=?').bind(Date.now(),await hashToken(previous)),
   env.DB!.prepare('INSERT INTO auth_sessions (token_hash,user_id,expires,created) VALUES (?,?,?,?)').bind(await hashToken(session),account.user_id,Date.now()+SESSION_SECONDS*1000,Date.now()),
  ]);
  return response(safeReturnTo(flow.return_to),session);
 }catch {return response('/login?error=failed');}
}
