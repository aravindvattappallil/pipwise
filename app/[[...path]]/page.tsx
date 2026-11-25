import Community from '../../components/community';
import { requireUser } from '../../lib/auth';
import { safeReturnTo } from '../../lib/auth-navigation';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const { path = [] } = await params;
  const query = await searchParams;
  const returnUrl = new URL(`/${path.map(encodeURIComponent).join('/')}`, 'https://pipwise.local');
  if (typeof query.user === 'string') returnUrl.searchParams.set('user', query.user);
  const returnTo = safeReturnTo(returnUrl.pathname + returnUrl.search);
  return <AuthenticatedCommunity returnTo={returnTo} />;
}

async function AuthenticatedCommunity({ returnTo }: { returnTo: string }) {
  await requireUser(returnTo);
  return <Community />;
}
