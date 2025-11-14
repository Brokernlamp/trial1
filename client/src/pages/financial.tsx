import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaymentTable } from "@/components/payment-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Wallet,
  Download,
  FileText,
  Plus,
} from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Financial() {
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [open, setOpen] = useState(false);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const { toast } = useToast();

  const { data: payments = [] } = useQuery({
    queryKey: ["/api/payments"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["/api/members"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["/api/plans"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const formSchema = z.object({
    memberId: z.string().min(1),
    amount: z.string().min(1),
    paymentMethod: z.enum(["cash", "card", "upi", "online"]).default("cash"),
    status: z.enum(["paid", "pending", "overdue"]).default("paid"),
  });

  type FormValues = z.infer<typeof formSchema>;
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { paymentMethod: "cash", status: "paid" } as any,
  });

  // Calculate remaining amount when member is selected
  const selectedMember = members.find((m: any) => m.id === selectedMemberId);
  const selectedMemberPayments = payments.filter((p: any) => p.memberId === selectedMemberId);
  const selectedMemberPlan = plans.find((p: any) => p.id === selectedMember?.planId);
  const planPrice = selectedMemberPlan ? Number(selectedMemberPlan.price) : 0;
  const totalPaid = selectedMemberPayments
    .filter((p: any) => p.status === "paid")
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const remainingAmount = Math.max(0, planPrice - totalPaid);

  const processPayment = useMutation({
    mutationFn: async (values: FormValues) => {
      await apiRequest("POST", "/api/payments", {
        ...values,
        amount: String(values.amount), // Ensure amount is a string
        paidDate: values.status === "paid" ? new Date().toISOString() : null,
      });
    },
    onSuccess: async () => {
      // Invalidate triggers automatic refetch
      await queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      setOpen(false);
      form.reset({ paymentMethod: "cash", status: "paid" } as any);
      setMemberSearchOpen(false);
      setSelectedMemberId("");
      toast({
        title: "Payment processed",
        description: "Payment has been recorded successfully.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Payment failed",
        description: err?.message || "Failed to process payment. Please try again.",
        variant: "destructive",
      });
    },
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

  // Build member lookup map first
  const memberById = new Map(members.map((m: any) => [m.id, m] as const));

  // Calculate revenue by plan from paid payments
  const paidPayments = payments.filter((p: any) => p.status === "paid");
  const planRevenue = new Map<string, number>();
  paidPayments.forEach((p: any) => {
    // Try to get plan name from payment, member, or plan lookup
    let planName = p.planName;
    if (!planName) {
      const member = memberById.get(p.memberId);
      planName = member?.planName;
    }
    if (!planName) {
      const member = memberById.get(p.memberId);
      if (member?.planId) {
        const plan = plans.find((pl: any) => pl.id === member.planId);
        planName = plan?.name;
      }
    }
    const plan = planName || "Unknown Plan";
    planRevenue.set(plan, (planRevenue.get(plan) || 0) + Number(p.amount || 0));
  });
  const chartColors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];
  const revenueByPlan = Array.from(planRevenue.entries())
    .map(([name, value], idx) => ({
      name,
      value,
      color: chartColors[idx % chartColors.length],
    }))
    .sort((a, b) => b.value - a.value);

  // Calculate monthly revenue for last 6 months
  const now = new Date();
  const sixMonthsAgo = subMonths(now, 5);
  const months = eachMonthOfInterval({ start: sixMonthsAgo, end: now });
  const monthlyRevenue = months.map((month) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const monthRevenue = paidPayments
      .filter((p: any) => {
        const paid = parseDate(p.paidDate);
        return paid && paid >= monthStart && paid <= monthEnd;
      })
      .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    return {
      month: format(month, "MMM"),
      revenue: monthRevenue,
      expenses: 0, // Expenses not tracked in DB - set to 0
    };
  });
  
  // Filter pending payments - check payment status directly
  const pendingPayments = payments
    .filter((p: any) => p.status === "pending" || p.status === "overdue")
    .map((p: any) => ({
      id: p.id,
      memberName: memberById.get(p.memberId)?.name ?? p.memberId,
      amount: Number(p.amount ?? 0),
      dueDate: p.dueDate ? new Date(p.dueDate) : undefined,
      status: p.status,
      planName: p.planName ?? undefined,
    }));
  
  // Also add members with pending payment status who don't have payment records yet
  const membersWithPendingPaymentStatus = members
    .filter((m: any) => (m.paymentStatus === "pending" || m.paymentStatus === "overdue") && !pendingPayments.find((p) => memberById.get(p.memberId)?.id === m.id))
    .map((m: any) => ({
      id: `member_pending_${m.id}`,
      memberName: m.name,
      amount: 0, // Amount not specified yet
      dueDate: m.expiryDate ? new Date(m.expiryDate) : undefined,
      status: m.paymentStatus,
      planName: m.planName ?? undefined,
    }));
  
  // Combine both lists
  const allPendingPayments = [...pendingPayments, ...membersWithPendingPaymentStatus];

  // Recent transactions - last 10 paid payments
  const recentTransactions = paidPayments
    .slice()
    .sort((a: any, b: any) => {
      const dateA = parseDate(a.paidDate);
      const dateB = parseDate(b.paidDate);
      if (!dateA || !dateB) return 0;
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 10)
    .map((p: any) => {
      const member = memberById.get(p.memberId);
      return {
        id: p.id,
        memberName: member?.name || p.memberId,
        amount: Number(p.amount || 0),
        method: p.paymentMethod || "Unknown",
        date: parseDate(p.paidDate),
        planName: p.planName || "Unknown Plan",
      };
    })
    .filter((t) => t.date); // Only include transactions with valid dates

  // Calculate real metrics
  const currentMonthData = monthlyRevenue[monthlyRevenue.length - 1];
  const totalRevenue = currentMonthData.revenue;
  const totalExpenses = currentMonthData.expenses;
  const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;
  
  const totalPayments = payments.length;
  const paidCount = paidPayments.length;
  const collectionRate = totalPayments > 0 ? (paidCount / totalPayments) * 100 : 0;
  
  const activeMemberCount = members.filter((m: any) => m.status === "active").length;
  const avgRevenuePerMember = activeMemberCount > 0 ? Math.round(totalRevenue / activeMemberCount) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Financial Dashboard</h1>
          <p className="text-muted-foreground">Track revenue, expenses, and payments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-export-financial" onClick={() => {
            const csv = [
              ["Member", "Amount", "Method", "Status", "Date"].join(","),
              ...paidPayments.slice().sort((a: any, b: any) => {
                const dateA = parseDate(a.paidDate);
                const dateB = parseDate(b.paidDate);
                if (!dateA || !dateB) return 0;
                return dateB.getTime() - dateA.getTime();
              }).map((p: any) => {
                const member = memberById.get(p.memberId);
                return [
                  member?.name || p.memberId,
                  p.amount || 0,
                  p.paymentMethod || "Unknown",
                  p.status,
                  parseDate(p.paidDate) ? format(parseDate(p.paidDate)!, "yyyy-MM-dd") : "",
                ].join(",");
              }),
            ].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `financial-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast({ title: "Report exported", description: "Financial report downloaded as CSV." });
          }}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button data-testid="button-process-payment" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Process Payment
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Monthly Revenue"
          value={`₹${totalRevenue.toLocaleString()}`}
          icon={DollarSign}
        />
        <MetricCard
          title="Profit Margin"
          value={`${profitMargin.toFixed(1)}%`}
          icon={TrendingUp}
        />
        <MetricCard
          title="Collection Rate"
          value={`${collectionRate}%`}
          icon={CreditCard}
          subtitle="Payment success rate"
        />
        <MetricCard
          title="Avg Revenue/Member"
          value={`₹${avgRevenuePerMember.toLocaleString()}`}
          icon={Wallet}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyRevenue}>
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
                <Bar dataKey="revenue" fill="hsl(var(--chart-1))" name="Revenue" />
                <Bar dataKey="expenses" fill="hsl(var(--chart-5))" name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={revenueByPlan}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {revenueByPlan.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                  formatter={(value: number) => `₹${value.toLocaleString()}`}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members by Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {plans.filter((p: any) => p.isActive).map((plan: any) => {
              const planMembers = members.filter((m: any) => 
                m.planId === plan.id || m.planName === plan.name
              );
              if (planMembers.length === 0) return null;
              
              return (
                <div key={plan.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        ₹{Number(plan.price).toLocaleString()} • {plan.duration} days
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-sm">
                      {planMembers.length} {planMembers.length === 1 ? "member" : "members"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {planMembers.map((member: any) => (
                      <div 
                        key={member.id} 
                        className="flex items-center gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => {
                          window.location.href = `/members/history?id=${member.id}`;
                        }}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.photoUrl} alt={member.name} />
                          <AvatarFallback>
                            {member.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{member.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        </div>
                        <Badge 
                          variant={member.status === "active" ? "default" : member.status === "expired" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {member.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {plans.filter((p: any) => p.isActive).every((p: any) => 
              !members.some((m: any) => m.planId === p.id || m.planName === p.name)
            ) && (
              <p className="text-center text-muted-foreground py-8">No members assigned to any plan yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Pending Payments</CardTitle>
          <div className="flex gap-2">
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="w-[150px]" data-testid="select-payment-method">
                <SelectValue placeholder="Payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
            <PaymentTable
            payments={allPendingPayments}
            onSendReminder={async (id) => {
              try {
                const payment = allPendingPayments.find((p) => p.id === id);
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
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          form.reset({ paymentMethod: "cash", status: "paid" } as any);
          setMemberSearchOpen(false);
          setSelectedMemberId("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Payment</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => processPayment.mutate(v))} className="space-y-4">
              <FormField
                control={form.control}
                name="memberId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Member</FormLabel>
                    <Popover open={memberSearchOpen} onOpenChange={setMemberSearchOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? members.find((m: any) => m.id === field.value)?.name || `ID: ${field.value}`
                              : "Search member by name or ID..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search member by name or ID..." />
                          <CommandList>
                            <CommandEmpty>No member found.</CommandEmpty>
                            <CommandGroup>
                              {members.map((member: any) => (
                                <CommandItem
                                  value={`${member.name} ${member.id} ${member.loginCode || ""}`}
                                  key={member.id}
                                  onSelect={() => {
                                    form.setValue("memberId", member.id);
                                    setSelectedMemberId(member.id);
                                    // Auto-fill amount with remaining amount
                                    const memberPayments = payments.filter((p: any) => p.memberId === member.id);
                                    const memberPlan = plans.find((p: any) => p.id === member.planId);
                                    const planPrice = memberPlan ? Number(memberPlan.price) : 0;
                                    const totalPaid = memberPayments
                                      .filter((p: any) => p.status === "paid")
                                      .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
                                    const remaining = Math.max(0, planPrice - totalPaid);
                                    if (remaining > 0) {
                                      form.setValue("amount", remaining.toFixed(2));
                                    }
                                    setMemberSearchOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      member.id === field.value ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">{member.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      ID: {member.id} {member.loginCode ? `• Code: ${member.loginCode}` : ""}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {selectedMember && (
                <div className="p-3 border rounded-md bg-muted/50">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Plan:</span>
                      <span className="font-medium">{selectedMember.planName || "No Plan"}</span>
                    </div>
                    {selectedMemberPlan && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Plan Price:</span>
                          <span className="font-medium">₹{planPrice.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Paid:</span>
                          <span className="font-medium">₹{totalPaid.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-t pt-1 mt-1">
                          <span className="text-muted-foreground">Remaining:</span>
                          <span className={`font-medium ${remainingAmount > 0 ? "text-destructive" : "text-chart-3"}`}>
                            ₹{remainingAmount.toLocaleString()}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder={remainingAmount > 0 ? remainingAmount.toFixed(2) : "0.00"} 
                        {...field}
                        value={field.value || (remainingAmount > 0 ? remainingAmount.toFixed(2) : "")}
                      />
                    </FormControl>
                    {selectedMember && remainingAmount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Remaining amount: ₹{remainingAmount.toLocaleString()} (pre-filled)
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Method</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="upi">UPI</SelectItem>
                          <SelectItem value="online">Online</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={processPayment.isPending}>Save</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Recent Transactions</CardTitle>
          <Button size="sm" variant="outline" data-testid="button-view-all-transactions" onClick={() => setShowAllTransactions(!showAllTransactions)}>
            {showAllTransactions ? "Show Less" : "View All"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentTransactions.length > 0 ? (
              (showAllTransactions ? recentTransactions : recentTransactions.slice(0, 5)).map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 border rounded-md hover-elevate"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{transaction.memberName}</div>
                    <div className="text-sm text-muted-foreground">
                      {transaction.planName} • {transaction.method}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold font-mono">₹{transaction.amount.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">
                      {transaction.date ? format(transaction.date, "MMM dd, yyyy") : "N/A"}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">No recent transactions</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Expense tracking not implemented in database - removed expense breakdown section */}
    </div>
  );
}
