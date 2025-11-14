import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  Download,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  FileText,
} from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { format, startOfMonth, eachMonthOfInterval, subMonths, endOfMonth } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function Reports() {
  const [dateRange, setDateRange] = useState("last-12-months");
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

  // Calculate membership growth (last 12 months)
  const now = new Date();
  const twelveMonthsAgo = subMonths(now, 11);
  const months = eachMonthOfInterval({ start: twelveMonthsAgo, end: now });
  const membershipGrowth = months.map((month) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    
    // Total members at end of month (members who started before or during month and haven't expired)
    const totalMembers = members.filter((m: any) => {
      const startDate = parseDate(m.startDate);
      const expiryDate = parseDate(m.expiryDate);
      return startDate && startDate <= monthEnd && (!expiryDate || expiryDate > monthEnd);
    }).length;
    
    // New signups in this month
    const newSignups = members.filter((m: any) => {
      const startDate = parseDate(m.startDate);
      return startDate && startDate >= monthStart && startDate <= monthEnd;
    }).length;
    
    // Churn in this month (expired members)
    const churn = members.filter((m: any) => {
      const expiryDate = parseDate(m.expiryDate);
      return expiryDate && expiryDate >= monthStart && expiryDate <= monthEnd;
    }).length;
    
    return {
      month: format(month, "MMM 'yy"),
      members: totalMembers,
      newSignups,
      churn,
    };
  });

  // Calculate churn rate (expired members / total)
  const expiredMembers = members.filter((m: any) => {
    const expiryDate = parseDate(m.expiryDate);
    return expiryDate && expiryDate < now;
  }).length;
  const totalMembers = members.length;
  const churnRate = totalMembers > 0 ? ((expiredMembers / totalMembers) * 100).toFixed(1) : "0.0";

  // Calculate lifetime value from payments (average total payments per member)
  const paidPayments = payments.filter((p: any) => p.status === "paid");
  const memberPayments = new Map<string, number>();
  paidPayments.forEach((p: any) => {
    const total = memberPayments.get(p.memberId) || 0;
    memberPayments.set(p.memberId, total + Number(p.amount || 0));
  });
  const totalLifetimeValue = Array.from(memberPayments.values()).reduce((sum, val) => sum + val, 0);
  const lifetimeValue = memberPayments.size > 0 ? Math.round(totalLifetimeValue / memberPayments.size) : 0;

  // Peak seasons from attendance (monthly attendance counts)
  const attendanceByMonth = new Map<string, number>();
  attendance.forEach((a: any) => {
    const checkIn = parseDate(a.checkInTime);
    if (checkIn) {
      const monthKey = format(checkIn, "MMM");
      attendanceByMonth.set(monthKey, (attendanceByMonth.get(monthKey) || 0) + 1);
    }
  });
  const avgAttendance = Array.from(attendanceByMonth.values()).reduce((sum, val) => sum + val, 0) / attendanceByMonth.size;
  const peakSeasons = Array.from(attendanceByMonth.entries()).map(([month, count]) => ({
    month,
    type: count > avgAttendance * 1.2 ? "Peak" : count < avgAttendance * 0.8 ? "Slow" : "Normal",
    members: Math.round(count / 30), // Approximate daily average * 30
  })).sort((a, b) => {
    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
  });

  // Demographics and churn reasons not tracked in DB - show empty/placeholder
  const demographics = {
    age: [], // Not tracked
    gender: [], // Not tracked
  };

  const churnReasons: { reason: string; count: number }[] = []; // Not tracked
  const totalChurn = expiredMembers;
  const conversionRate = 0; // Not tracked - lead conversion requires lead tracking
  const npsScore = 0; // Not tracked - requires survey data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground">Business intelligence and insights</p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]" data-testid="select-date-range">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last-30-days">Last 30 Days</SelectItem>
              <SelectItem value="last-3-months">Last 3 Months</SelectItem>
              <SelectItem value="last-6-months">Last 6 Months</SelectItem>
              <SelectItem value="last-12-months">Last 12 Months</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" data-testid="button-export-pdf" onClick={() => {
            toast({ title: "Export PDF", description: "PDF export feature coming soon" });
          }}>
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" data-testid="button-export-excel" onClick={() => {
            const csv = [
              ["Month", "Total Members", "New Signups", "Churn"].join(","),
              ...membershipGrowth.map((m) => [m.month, m.members, m.newSignups, m.churn].join(",")),
            ].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `reports-${format(new Date(), "yyyy-MM-dd")}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast({ title: "Report exported", description: "Reports data downloaded as CSV." });
          }}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Churn Rate"
          value={`${churnRate}%`}
          icon={TrendingUp}
        />
        <MetricCard
          title="Lead Conversion"
          value="N/A"
          icon={Users}
          subtitle="Not tracked"
        />
        <MetricCard
          title="Lifetime Value"
          value={`₹${lifetimeValue.toLocaleString()}`}
          icon={DollarSign}
        />
        <MetricCard
          title="NPS Score"
          value="N/A"
          icon={BarChart3}
          subtitle="Not tracked"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Membership Growth (12 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={membershipGrowth}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="members"
                stroke="hsl(var(--chart-1))"
                strokeWidth={3}
                dot={{ fill: "hsl(var(--chart-1))" }}
                name="Total Members"
              />
              <Line
                type="monotone"
                dataKey="newSignups"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--chart-3))" }}
                name="New Signups"
              />
              <Line
                type="monotone"
                dataKey="churn"
                stroke="hsl(var(--chart-5))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--chart-5))" }}
                name="Churn"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Age Demographics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              Age demographics not tracked in database
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gender Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              Gender demographics not tracked in database
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Churn Rate Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {totalChurn > 0 ? (
              <div className="text-center py-8">
                <div className="text-2xl font-bold">{totalChurn}</div>
                <div className="text-sm text-muted-foreground">Total expired members</div>
                <div className="mt-4 text-xs text-muted-foreground">
                  Churn reasons not tracked in database
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No churn data available</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Peak Season Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {peakSeasons.map((season) => (
              <div
                key={season.month}
                className="flex items-center justify-between p-3 border rounded-md"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{season.month}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono">{season.members} members</span>
                  {season.type === "Peak" && (
                    <span className="px-3 py-1 rounded-full bg-chart-3 text-white text-xs font-semibold">
                      PEAK
                    </span>
                  )}
                  {season.type === "Slow" && (
                    <span className="px-3 py-1 rounded-full bg-chart-4 text-white text-xs font-semibold">
                      SLOW
                    </span>
                  )}
                  {season.type === "Normal" && (
                    <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-semibold">
                      NORMAL
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
