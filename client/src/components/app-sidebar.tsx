import {
  LayoutDashboard,
  Users,
  CreditCard,
  Calendar,
  Dumbbell,
  Wrench,
  BarChart3,
  Settings,
  Package,
  MessageSquare,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Members",
    url: "/members",
    icon: Users,
  },
  {
    title: "Plans",
    url: "/plans",
    icon: Package,
  },
  {
    title: "Financial",
    url: "/financial",
    icon: CreditCard,
  },
  {
    title: "Attendance",
    url: "/attendance",
    icon: Calendar,
  },
  {
    title: "Classes",
    url: "/classes",
    icon: Dumbbell,
  },
  {
    title: "Equipment",
    url: "/equipment",
    icon: Wrench,
  },
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
  },
  {
    title: "WhatsApp",
    url: "/whatsapp",
    icon: MessageSquare,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <Dumbbell className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">GymAdmin</h2>
            <p className="text-xs text-muted-foreground">Pro Dashboard</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase()}`}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/settings" data-testid="link-settings">
                <Settings className="h-5 w-5" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
