import handler from 'vinext/server/fetch-handler';
export default {
 async fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext){
  const response=await handler.fetch(request,env,ctx);
  const path=new URL(request.url).pathname;
  if(path.startsWith('/_next/')||path==='/favicon.svg')return response;
  const result=new Response(response.body,response);
  result.headers.set('Cache-Control','private, no-store');
  return result;
 },
};
