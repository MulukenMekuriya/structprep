import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { GraduationCap } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex items-center gap-2.5 border-b px-4 py-2.5 md:hidden">
          <SidebarTrigger />
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600">
              <GraduationCap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight">StructPrep</span>
          </div>
        </div>
        <div className="relative flex-1 min-h-0 overflow-auto p-4 md:p-6 lg:p-8 dot-grid-bg">
          {children}
        </div>
      </main>
    </SidebarProvider>
  );
}
