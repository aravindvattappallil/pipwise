import { env } from 'cloudflare:workers';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { appOrigin, cookieNames, hashToken, readCookie, validToken } from './auth-utils';
import { loginPath } from './auth-navigation';

export type AuthUser = {userId:string;displayName:string;fullName:string;email:string};
export function getAuthConfig() {
  const origin = appOrigin(env.APP_ORIGIN);
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!origin || !clientId || !clientSecret) return null;
  return {origin,clientId,clientSecret,redirectUri:`${origin}/api/auth/google/callback`};
}
export async function getUserFromHeaders(requestHeaders: Pick<Headers,'get'>): Promise<AuthUser | null> {
  const config=getAuthConfig();
  if(!config || !env.DB)return null;
  const token=readCookie(requestHeaders.get('cookie'),cookieNames(config.origin).session);
  if(!validToken(token))return null;
  const hash=await hashToken(token);
  const result=await env.DB.prepare(`SELECT p.id AS userId,p.name AS displayName,p.name AS fullName,a.email FROM auth_sessions s JOIN profiles p ON p.id=s.user_id JOIN google_accounts a ON a.user_id=p.id WHERE s.token_hash=? AND s.expires>?`).bind(hash,Date.now()).first<AuthUser>();
  return result || null;
}
export async function getCurrentUser(): Promise<AuthUser|null> {
  return getUserFromHeaders(await headers());
}
export async function requireUser(returnTo: string): Promise<AuthUser> {
  const user=await getCurrentUser();
  if(!user)redirect(loginPath(returnTo));
  return user;
}
