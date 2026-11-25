export const SESSION_SECONDS = 60 * 60 * 24 * 7;
export const FLOW_SECONDS = 60 * 10;

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64url(bytes);
}
function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function hashToken(token: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))));
}
export function validToken(token: string | null): token is string {
  return token !== null && /^[A-Za-z0-9_-]{43}$/.test(token);
}
export function readCookie(cookie: string | null, name: string): string | null {
  const values = (cookie || '').split(';').map(v => v.trim()).filter(v => v.startsWith(`${name}=`));
  if (values.length !== 1) return null;
  return values[0].slice(name.length + 1);
}
export function appOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) return null;
    return url.origin;
  } catch { return null; }
}
export function cookieNames(origin: string) {
  const prefix = origin.startsWith('https:') ? '__Host-' : '';
  return { session: `${prefix}pipwise_session`, flow: `${prefix}pipwise_oauth` };
}
export function authCookie(origin: string, name: string, value: string, maxAge: number): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${origin.startsWith('https:') ? '; Secure' : ''}`;
}
export function sameOriginRequest(request: Request, origin: string): boolean {
  return request.headers.get('origin') === origin && request.headers.get('sec-fetch-site') !== 'cross-site';
}
