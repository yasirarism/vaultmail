import { cookies } from 'next/headers';
import { AdminDashboard } from '@/components/admin-dashboard';
import { AdminLogin } from '@/components/admin-login';
import { isAdminSessionValid, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';

export default async function AdminPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const isAuthed = await isAdminSessionValid(sessionToken);

  return isAuthed ? <AdminDashboard /> : <AdminLogin />;
}
