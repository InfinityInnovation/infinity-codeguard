import { Dashboard } from '../../../features/dashboard/dashboard';

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  return <Dashboard locale={(await params).locale} />;
}
