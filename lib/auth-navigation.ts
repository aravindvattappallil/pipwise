const destinations = new Set(['/', '/journal', '/saved', '/profile', '/tools/risk-calculator']);

/** Only return to a known application page, never an external origin or auth route. */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  try {
    const url = new URL(value, 'https://pipwise.local');
    if (url.origin !== 'https://pipwise.local' || !destinations.has(url.pathname)) return '/';
    return url.pathname + url.search;
  } catch { return '/'; }
}

export function loginPath(returnTo: unknown = '/'): string {
  return `/login?next=${encodeURIComponent(safeReturnTo(returnTo))}`;
}
