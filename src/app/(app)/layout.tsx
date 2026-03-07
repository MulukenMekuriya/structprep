import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="flex items-center gap-2 border-b px-4 py-2 md:hidden">
          <SidebarTrigger />
          <span className="text-sm font-semibold">StructPrep</span>
        </div>
        <div className="p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </SidebarProvider>
  );
}
