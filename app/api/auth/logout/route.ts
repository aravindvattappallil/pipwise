import {env} from 'cloudflare:workers';
import {getAuthConfig} from '../../../../lib/auth';
import {authCookie,cookieNames,hashToken,readCookie,sameOriginRequest} from '../../../../lib/auth-utils';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const config=getAuthConfig();
 if(!config)return Response.redirect(new URL('/login',request.url),303);
 if(!sameOriginRequest(request,config.origin))return new Response('Invalid request origin.',{status:403});
 const names=cookieNames(config.origin),token=readCookie(request.headers.get('cookie'),names.session);
 if(token)await env.DB!.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await hashToken(token)).run();
 const headers=new Headers({Location:`${config.origin}/login?logged_out=1`,'Cache-Control':'private,no-store'});
 headers.append('Set-Cookie',authCookie(config.origin,names.session,'',0));
 headers.append('Set-Cookie',authCookie(config.origin,names.flow,'',0));
 return new Response(null,{status:303,headers});
}
