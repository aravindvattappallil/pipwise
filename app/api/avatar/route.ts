import { env } from 'cloudflare:workers';
import { getCurrentUser } from '../../../lib/auth';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
  if (!await getCurrentUser()) return Response.json({error:'Please sign in to view profile photos.'},{status:401,headers:{'Cache-Control':'no-store'}});
  const key=new URL(req.url).searchParams.get('key');
  if(!key || !key.startsWith('avatars/')) return new Response('Not found',{status:404});
  const obj=await env.BUCKET!.get(key);
  if(!obj) return new Response('Not found',{status:404});
  return new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'image/jpeg','Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'}});
}
export async function POST(req:Request) {
  const user=await getCurrentUser();
  if(!user)return Response.json({error:'Sign in required.'},{status:401});
  if(req.headers.get('origin') && req.headers.get('origin')!==new URL(req.url).origin)return new Response('Forbidden',{status:403});
  try {
    const form=await req.formData(); const file=form.get('photo');
    const old=await env.DB!.prepare('SELECT avatar FROM profiles WHERE id=?').bind(user.userId).first<{avatar:string|null}>();
    let key:string|null=null;
    if(file instanceof File) {
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2*1024*1024) return Response.json({error:'Choose a JPG, PNG or WebP image smaller than 2 MB.'},{status:400});
      key=`avatars/${crypto.randomUUID()}`;
      await env.BUCKET!.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type}});
    } else if(form.get('remove')!=='true') return Response.json({error:'Choose a photo.'},{status:400});
    await env.DB!.prepare('UPDATE profiles SET avatar=? WHERE id=?').bind(key,user.userId).run();
    if(old?.avatar) await env.BUCKET!.delete(old.avatar);
    return Response.json({avatar:key});
  }catch(e){console.error(e);return Response.json({error:'Could not update your photo.'},{status:500});}
}
