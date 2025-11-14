import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { useEffect } from "react";
import { useRealtimeInvalidation } from "./lib/realtime";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import Dashboard from "@/pages/dashboard";
import Members from "@/pages/members";
import Financial from "@/pages/financial";
import Attendance from "@/pages/attendance";
import Classes from "@/pages/classes";
import Equipment from "@/pages/equipment";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import Plans from "@/pages/plans";
import WhatsApp from "@/pages/whatsapp";
import UserAttendance from "@/pages/user-attendance";
import MemberHistory from "@/pages/member-history";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/members" component={Members} />
      <Route path="/plans" component={Plans} />
      <Route path="/financial" component={Financial} />
      <Route path="/attendance" component={Attendance} />
      <Route path="/classes" component={Classes} />
      <Route path="/equipment" component={Equipment} />
      <Route path="/reports" component={Reports} />
      <Route path="/settings" component={Settings} />
      <Route path="/whatsapp" component={WhatsApp} />
      <Route path="/user/attendance" component={UserAttendance} />
      <Route path="/members/history" component={MemberHistory} />
      <Route component={NotFound} />
    </Switch>
  );
}

function RealtimeBridge() {
  useEffect(() => {
    useRealtimeInvalidation(queryClient);
    // Attempt a background sync from Turso to local when app starts (desktop)
    fetch("/api/sync/pull", { method: "POST", credentials: "include" }).catch(() => {});
  }, []);
  return null;
}

export default function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeBridge />
      <ThemeProvider>
        <TooltipProvider>
          <>
            <SidebarProvider style={style as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <div className="flex flex-col flex-1">
                  <header className="flex items-center justify-between p-4 border-b bg-background sticky top-0 z-10">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <div className="flex items-center gap-2">
                      <ThemeToggle />
                    </div>
                  </header>
                  <main className="flex-1 overflow-auto p-6 bg-background">
                    <div className="max-w-7xl mx-auto">
                      <Router />
                    </div>
                  </main>
                </div>
              </div>
            </SidebarProvider>
            <Toaster />
          </>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
