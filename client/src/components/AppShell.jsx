import { Sidebar } from "@/components/Sidebar";
import { PageHeader } from "@/components/layout/PageHeader";

export function AppShell({ pageTitle, pageSubtitle, rightActions, stats, quickActions, children }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="flex-1 overflow-y-auto min-w-0">
        {/* Page hero strip */}
        <div className="page-hero px-5 lg:px-8 pt-16 lg:pt-7 pb-6">
          <div className="max-w-7xl mx-auto">
            <PageHeader
              title={pageTitle}
              subtitle={pageSubtitle}
              rightActions={rightActions}
            />
          </div>
        </div>

        {/* Content area */}
        <div className="px-5 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {stats}
            {quickActions}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
