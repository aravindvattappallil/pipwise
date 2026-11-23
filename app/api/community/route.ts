import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control':'no-store'}});
const categories = ['Trade recap','Market outlook','Trading psychology','Lesson learned'];
export async function GET(req: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return json({error:'Sign in to join the community.'},401);
    const db = env.DB!;
    const now = new Date().toISOString();
    await db.prepare('INSERT OR IGNORE INTO profiles (id,name,username,bio,joined) VALUES (?,?,?,?,?)').bind(user.userId, user.fullName || 'New trader', `trader-${crypto.randomUUID().slice(0,8)}`, '', now).run();
    const me = await db.prepare('SELECT * FROM profiles WHERE id=?').bind(user.userId).first();
    const params = new URL(req.url).searchParams;
    const view = params.get('view') || 'community';
    const profileId = params.get('user') || user.userId;
    const profile = view === 'profile' ? await db.prepare('SELECT * FROM profiles WHERE id=?').bind(profileId).first() : null;
    let where = 'j.visibility = ?'; let bindings: string[] = ['public'];
    if (view === 'journal') { where = 'j.author_id = ?'; bindings = [user.userId]; }
    if (view === 'profile') { where = 'j.author_id = ? AND (j.visibility = ? OR j.author_id = ?)'; bindings = [profileId,'public',user.userId]; }
    if (view === 'saved') { where = 'EXISTS (SELECT 1 FROM bookmarks b WHERE b.journal_id=j.id AND b.user_id=?) AND (j.visibility=? OR j.author_id=?)'; bindings=[user.userId,'public',user.userId]; }
    const result = await db.prepare(`SELECT j.*, p.name, p.username, p.avatar, (SELECT COUNT(*) FROM likes l WHERE l.journal_id=j.id) AS like_count, EXISTS(SELECT 1 FROM likes l WHERE l.journal_id=j.id AND l.user_id=?) AS liked, EXISTS(SELECT 1 FROM bookmarks b WHERE b.journal_id=j.id AND b.user_id=?) AS saved FROM journals j JOIN profiles p ON j.author_id=p.id WHERE ${where} ORDER BY ${params.get('sort')==='liked'?'like_count DESC, ':''}j.created DESC LIMIT 200`).bind(user.userId,user.userId,...bindings).all();
    const counts = await db.prepare(`SELECT (SELECT COUNT(*) FROM journals WHERE author_id=? AND visibility='public') AS public, (SELECT COUNT(*) FROM journals WHERE author_id=? AND visibility='private') AS private, (SELECT COUNT(*) FROM bookmarks b JOIN journals j ON j.id=b.journal_id WHERE b.user_id=? AND (j.visibility='public' OR j.author_id=?)) AS saved, (SELECT COUNT(DISTINCT author_id) FROM journals WHERE visibility='public') AS traders, (SELECT COUNT(*) FROM journals WHERE visibility='public') AS total`).bind(user.userId,user.userId,user.userId,user.userId).first();
    return json({me,profile,journals:result.results,counts});
  } catch (e) { console.error('Community load failed',e); return json({error:'Your journals could not be loaded. Please try again.'},500); }
}
export async function POST(req: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({error:'Please sign in to continue.'},401);
  if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) return json({error:'Invalid request origin.'},403);
  try {
    const data = await req.json() as Record<string,unknown>;
    const db = env.DB!;
    if (data.action === 'profile') {
      const name=String(data.name||'').trim(), username=String(data.username||'').trim().toLowerCase(), bio=String(data.bio||'').trim();
      if (!name || name.length>80 || !/^[a-z0-9_-]{3,30}$/.test(username) || bio.length>500) return json({error:'Use a name up to 80 characters and a username with 3–30 letters, numbers, underscores or hyphens.'},400);
      const taken=await db.prepare('SELECT id FROM profiles WHERE username=? AND id!=?').bind(username,user.userId).first();
      if(taken) return json({error:'That username is already in use.'},409);
      await db.prepare('UPDATE profiles SET name=?,username=?,bio=? WHERE id=?').bind(name,username,bio,user.userId).run();
      return json({ok:true});
    }
    if(data.action === 'create' || data.action === 'edit') {
      const title=String(data.title||'').trim(),body=String(data.body||'').trim(),category=String(data.category||'Trade recap'),visibility=data.visibility==='public'?'public':'private',symbol=String(data.symbol||'').trim().toUpperCase();
      if(!title || title.length>160 || !body || body.length>20000 || symbol.length>24 || !categories.includes(category)) return json({error:'Add a title and reflection. Titles can be up to 160 characters and reflections up to 20,000.'},400);
      const now=new Date().toISOString();
      if(data.action==='create') { const id=crypto.randomUUID(); await db.prepare('INSERT INTO journals (id,author_id,title,body,category,visibility,symbol,created,updated) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,user.userId,title,body,category,visibility,symbol,now,now).run(); return json({ok:true,id}); }
      const existing=await db.prepare('SELECT id FROM journals WHERE id=? AND author_id=?').bind(String(data.id),user.userId).first();
      if(!existing) return json({error:'Journal not found.'},404);
      await db.prepare('UPDATE journals SET title=?,body=?,category=?,visibility=?,symbol=?,updated=? WHERE id=? AND author_id=?').bind(title,body,category,visibility,symbol,now,String(data.id),user.userId).run();
      return json({ok:true});
    }
    const id=String(data.id||'');
    const journal=await db.prepare("SELECT * FROM journals WHERE id=? AND (visibility='public' OR author_id=?)").bind(id,user.userId).first();
    if(!journal) return json({error:'This journal is no longer available.'},404);
    if(data.action==='delete') {
      if(journal.author_id!==user.userId) return json({error:'Only the author can delete this journal.'},403);
      await db.batch([db.prepare('DELETE FROM likes WHERE journal_id=?').bind(id),db.prepare('DELETE FROM bookmarks WHERE journal_id=?').bind(id),db.prepare('DELETE FROM journals WHERE id=? AND author_id=?').bind(id,user.userId)]);
      return json({ok:true});
    }
    if(data.action==='like' || data.action==='save') {
      if(journal.visibility!=='public' && data.action==='like') return json({error:'Likes are available on public journals.'},400);
      const table=data.action==='like'?'likes':'bookmarks';
      if(data.active) {
        await db.prepare(table==='likes'?'INSERT OR IGNORE INTO likes (user_id,journal_id) VALUES (?,?)':'INSERT OR IGNORE INTO bookmarks (user_id,journal_id,created) VALUES (?,?,?)').bind(...(table==='likes'?[user.userId,id]:[user.userId,id,new Date().toISOString()])).run();
      } else await db.prepare(`DELETE FROM ${table} WHERE user_id=? AND journal_id=?`).bind(user.userId,id).run();
      return json({ok:true});
    }
    return json({error:'Unknown action.'},400);
  } catch(e) {console.error('Community update failed',e);return json({error:'Could not save your changes. Please try again.'},500);}
}
