import { getUser } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { AdminSidebar } from './AdminSidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user || user.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen bg-muted/40">
      <AdminSidebar />
      <main className="flex flex-1 flex-col sm:pl-64">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}