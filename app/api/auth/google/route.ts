import {env} from 'cloudflare:workers';
import {getAuthConfig} from '../../../../lib/auth';
import {authCookie,cookieNames,FLOW_SECONDS,hashToken,randomToken,readCookie} from '../../../../lib/auth-utils';
import {safeReturnTo} from '../../../../lib/auth-navigation';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const config=getAuthConfig();
 if(!config)return Response.redirect(new URL('/login?error=configuration',request.url),303);
 const url=new URL(request.url),next=safeReturnTo(url.searchParams.get('next'));
 if(url.origin!==config.origin)return Response.redirect(`${config.origin}/api/auth/google?next=${encodeURIComponent(next)}`,303);
 if(request.headers.get('sec-fetch-site')==='cross-site')return new Response('Start sign-in from Pipwise.',{status:403});
 const state=randomToken(),browser=randomToken(),verifier=randomToken(),nonce=randomToken();
 const names=cookieNames(config.origin),previous=readCookie(request.headers.get('cookie'),names.flow)||'';
 try {
  await env.DB!.batch([
   env.DB!.prepare('DELETE FROM oauth_flows WHERE expires<? OR browser_hash=?').bind(Date.now(),await hashToken(previous)),
   env.DB!.prepare('INSERT INTO oauth_flows (state_hash,browser_hash,verifier,nonce,return_to,expires) VALUES (?,?,?,?,?,?)').bind(await hashToken(state),await hashToken(browser),verifier,nonce,next,Date.now()+FLOW_SECONDS*1000),
  ]);
  const authorization=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorization.search=new URLSearchParams({client_id:config.clientId,redirect_uri:config.redirectUri,response_type:'code',scope:'openid email profile',state,nonce,code_challenge:await hashToken(verifier),code_challenge_method:'S256',prompt:'select_account'}).toString();
  return new Response(null,{status:303,headers:{Location:authorization.toString(),'Set-Cookie':authCookie(config.origin,names.flow,browser,FLOW_SECONDS),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 }catch {return Response.redirect(`${config.origin}/login?error=unavailable`,303);}
}
