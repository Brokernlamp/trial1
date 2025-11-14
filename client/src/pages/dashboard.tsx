import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { MetricCard } from "@/components/metric-card";
import { RevenueChart } from "@/components/revenue-chart";
import { PaymentTable } from "@/components/payment-table";
import { AttendanceHeatmap } from "@/components/attendance-heatmap";
import { Users, DollarSign, TrendingUp, AlertCircle, Calendar, UserCheck, UserPlus, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: members = [] } = useQuery({
    queryKey: ["/api/members"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["/api/payments"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["/api/attendance"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Parse dates safely
  const parseDate = (dateStr: any) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  };

  // Calculate real metrics
  const activeMembers = members.filter((m: any) => m.status === "active");
  const activeCount = activeMembers.length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  const todayCheckIns = attendance.filter((a: any) => {
    const checkIn = parseDate(a.checkInTime);
    return checkIn && checkIn.toDateString() === todayStr;
  });
  const yesterdayCheckIns = attendance.filter((a: any) => {
    const checkIn = parseDate(a.checkInTime);
    return checkIn && checkIn.toDateString() === yesterdayStr;
  });
  const todayCheckInsCount = todayCheckIns.length;
  const yesterdayCheckInsCount = yesterdayCheckIns.length;
  const checkInsTrend = yesterdayCheckInsCount > 0 
    ? ((todayCheckInsCount - yesterdayCheckInsCount) / yesterdayCheckInsCount) * 100 
    : 0;

  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const monthlyRevenue = payments
    .filter((p: any) => {
      if (p.status !== "paid" || !p.paidDate) return false;
      const paid = parseDate(p.paidDate);
      return paid && paid.getMonth() === currentMonth && paid.getFullYear() === currentYear;
    })
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

  // Get pending payments from payments table
  const pendingPaymentsFromTable = payments.filter((p: any) => 
    p.status === "pending" || p.status === "overdue"
  );
  
  // Also get members with pending payment status
  const membersWithPendingStatus = members.filter((m: any) => 
    (m.paymentStatus === "pending" || m.paymentStatus === "overdue") && 
    !pendingPaymentsFromTable.find((p) => p.memberId === m.id)
  );
  
  // Combine for total count
  const allPendingPaymentsCount = pendingPaymentsFromTable.length + membersWithPendingStatus.length;
  const pendingAmount = pendingPaymentsFromTable.reduce((sum: number, p: any) => 
    sum + Number(p.amount || 0), 0
  );

  const todayRevenue = payments
    .filter((p: any) => {
      if (p.status !== "paid" || !p.paidDate) return false;
      const paid = parseDate(p.paidDate);
      return paid && paid.toDateString() === todayStr;
    })
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const newSignups = members.filter((m: any) => {
    const startDate = parseDate(m.startDate);
    return startDate && startDate >= weekAgo;
  }).length;

  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const expiringThisWeek = members.filter((m: any) => {
    const expiry = parseDate(m.expiryDate);
    return expiry && expiry >= today && expiry <= nextWeek;
  }).length;

  // Revenue chart - last 6 months
  const revenueData = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(today);
    monthDate.setMonth(monthDate.getMonth() - i);
    const monthName = format(monthDate, "MMM");
    const monthRevenue = payments
      .filter((p: any) => {
        if (p.status !== "paid" || !p.paidDate) return false;
        const paid = parseDate(p.paidDate);
        return paid && paid.getMonth() === monthDate.getMonth() && paid.getFullYear() === monthDate.getFullYear();
      })
      .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    revenueData.push({ month: monthName, revenue: monthRevenue });
  }

  // Heatmap from real attendance data
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const heatmapData: { hour: number; day: string; count: number }[] = [];
  const memberById = new Map(members.map((m: any) => [m.id, m] as const));

  attendance.forEach((a: any) => {
    const checkIn = parseDate(a.checkInTime);
    if (!checkIn) return;
    const dayOfWeek = checkIn.getDay();
    const dayName = days[dayOfWeek === 0 ? 6 : dayOfWeek - 1];
    const hour = checkIn.getHours();
    if (hour >= 6 && hour < 20) {
      const existing = heatmapData.find((h) => h.hour === hour && h.day === dayName);
      if (existing) {
        existing.count++;
      } else {
        heatmapData.push({ hour, day: dayName, count: 1 });
      }
    }
  });
  
  // Fill missing slots with 0
  days.forEach((day) => {
    for (let hour = 6; hour < 20; hour++) {
      if (!heatmapData.find((h) => h.hour === hour && h.day === day)) {
        heatmapData.push({ hour, day, count: 0 });
      }
    }
  });

  // Today's check-ins with member names
  const todayCheckInsList = todayCheckIns
    .map((a: any) => {
      const checkIn = parseDate(a.checkInTime);
      const member = memberById.get(a.memberId);
      return {
        name: member?.name || a.memberId,
        time: checkIn ? format(checkIn, "hh:mm a") : "",
      };
    })
    .sort((a, b) => {
      // Sort by time (simple string sort works for formatted time)
      return a.time.localeCompare(b.time);
    });

  // Pending payments with member names - combine from both sources
  const pendingPaymentsList = [
    ...pendingPaymentsFromTable.map((p: any) => {
      const member = memberById.get(p.memberId);
      return {
        id: p.id,
        memberName: member?.name || p.memberId,
        amount: Number(p.amount || 0),
        dueDate: parseDate(p.dueDate),
        status: p.status,
        planName: p.planName || undefined,
      };
    }),
    ...membersWithPendingStatus.slice(0, 10 - pendingPaymentsFromTable.length).map((m: any) => ({
      id: `member_pending_${m.id}`,
      memberName: m.name,
      amount: 0,
      dueDate: parseDate(m.expiryDate),
      status: m.paymentStatus,
      planName: m.planName || undefined,
    })),
  ].slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your gym overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Members"
          value={activeCount}
          icon={Users}
        />
        <MetricCard
          title="Today's Check-ins"
          value={todayCheckInsCount}
          icon={Calendar}
          subtitle={yesterdayCheckInsCount > 0 ? `vs ${yesterdayCheckInsCount} yesterday` : undefined}
          trend={checkInsTrend !== 0 ? { value: Math.abs(checkInsTrend), isPositive: checkInsTrend > 0 } : undefined}
        />
        <MetricCard
          title="Monthly Revenue (MRR)"
          value={`₹${monthlyRevenue.toLocaleString()}`}
          icon={DollarSign}
        />
        <MetricCard
          title="Pending Payments"
          value={allPendingPaymentsCount}
          icon={AlertCircle}
          subtitle={`₹${pendingAmount.toLocaleString()} total due`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Today's Revenue"
          value={`₹${todayRevenue.toLocaleString()}`}
          icon={TrendingUp}
        />
        <MetricCard
          title="New Signups"
          value={newSignups}
          icon={UserPlus}
          subtitle="This week"
        />
        <MetricCard
          title="Expiring This Week"
          value={expiringThisWeek}
          icon={UserCheck}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RevenueChart data={revenueData} />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>Today's Check-ins</CardTitle>
            <Button size="sm" variant="outline" data-testid="button-view-all-checkins" onClick={() => setLocation("/attendance")}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todayCheckInsList.length > 0 ? (
                todayCheckInsList.slice(0, 5).map((checkin, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-md hover-elevate"
                  >
                    <span className="font-medium">{checkin.name}</span>
                    <span className="text-sm text-muted-foreground font-mono">{checkin.time}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">No check-ins today</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <AttendanceHeatmap data={heatmapData} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Pending Payments</CardTitle>
          <Button size="sm" variant="outline" data-testid="button-view-all-payments" onClick={() => setLocation("/financial")}>
            View All
          </Button>
        </CardHeader>
        <CardContent>
          {pendingPaymentsList.length > 0 ? (
            <PaymentTable
              payments={pendingPaymentsList}
              onSendReminder={async (id) => {
                try {
                  const payment = pendingPaymentsList.find((p) => p.id === id);
                  const res = await fetch(`/api/payments/${id}/send-reminder`, { method: "POST", credentials: "include" });
                  const data = await res.json();
                  if (res.ok) {
                    toast({
                      title: "Reminder sent",
                      description: payment ? `Payment reminder sent to ${payment.memberName}` : "Reminder sent",
                    });
                  } else {
                    toast({
                      title: "Failed to send reminder",
                      description: data.message || "Could not send reminder. Make sure WhatsApp is connected.",
                      variant: "destructive",
                    });
                  }
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error?.message || "Failed to send reminder",
                    variant: "destructive",
                  });
                }
              }}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">No pending payments</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
