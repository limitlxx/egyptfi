import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'System Monitoring - EGYPTFI',
  description: 'Real-time system health and performance monitoring dashboard',
};

export default function MonitoringLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="pt-16"> {/* Account for fixed navbar */}
        {children}
      </div>
    </div>
  );
}