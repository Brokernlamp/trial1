import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function NotificationBell() {
  const { data: members = [] } = useQuery({
    queryKey: ["/api/members"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["/api/payments"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Calculate notification count: pending payments + expiring members this week
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const pendingPayments = payments.filter((p: any) => p.status === "pending" || p.status === "overdue");
  const expiringThisWeek = members.filter((m: any) => {
    if (!m.expiryDate || m.status !== "active") return false;
    const expiry = new Date(m.expiryDate);
    expiry.setHours(0, 0, 0, 0);
    return expiry >= today && expiry <= nextWeek;
  });

  const notificationCount = pendingPayments.length + expiringThisWeek.length;

  return (
    <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
      <Bell className="h-5 w-5" />
      {notificationCount > 0 && (
        <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-destructive text-destructive-foreground text-xs">
          {notificationCount > 99 ? "99+" : notificationCount}
        </Badge>
      )}
    </Button>
  );
}

