import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { MemberCard } from "@/components/member-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, UserPlus, Trash2, Edit, Download, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Fingerprint } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function Members() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [viewMemberId, setViewMemberId] = useState<string | null>(null);
  const [renewMemberId, setRenewMemberId] = useState<string | null>(null);
  const [renewPlanId, setRenewPlanId] = useState<string>("");
  const [editMemberId, setEditMemberId] = useState<string | null>(null);
  const [extendMemberId, setExtendMemberId] = useState<string | null>(null);
  const [infoMemberId, setInfoMemberId] = useState<string | null>(null);
  const { toast } = useToast();
  const [linkBiometricForId, setLinkBiometricForId] = useState<string | null>(null);
  const [biometricUserId, setBiometricUserId] = useState<string>("");

  const { data: members = [], isLoading, error } = useQuery({
    queryKey: ["/api/members"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["/api/plans"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["/api/payments"],
    queryFn: getQueryFn({ on401: "throw" }),
  });


  const formSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(6),
    planId: z.string().min(1, "Plan is required"),
    status: z.enum(["active", "expired", "pending", "frozen"]).default("active"),
    paymentStatus: z.enum(["paid", "pending", "overdue"]).default("paid"),
    partialPaymentAmount: z.string().optional(),
    fullAmountRemaining: z.boolean().optional(),
  }).refine((data) => {
    // If payment status is pending, either partialPaymentAmount or fullAmountRemaining must be set
    if (data.paymentStatus === "pending") {
      return data.fullAmountRemaining === true || (data.partialPaymentAmount && Number(data.partialPaymentAmount) > 0);
    }
    return true;
  }, {
    message: "Please enter payment amount or check 'Full amount remaining'",
    path: ["partialPaymentAmount"],
  });

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      name: "", 
      email: "", 
      phone: "", 
      planId: "", 
      status: "active", 
      paymentStatus: "paid",
      partialPaymentAmount: "",
      fullAmountRemaining: false,
    },
  });

  const paymentStatus = form.watch("paymentStatus");
  const fullAmountRemaining = form.watch("fullAmountRemaining");

  const sendInvoicesToday = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/whatsapp/send-invoices-today", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "E-bills sent",
        description: `Attempted: ${data.count}, Sent: ${data.sent}, Failed: ${data.failed}`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Failed to send", description: error?.message || "Unknown error", variant: "destructive" });
    },
  });

  const createMember = useMutation({
    mutationFn: async (values: FormValues) => {
      // Get selected plan
      const selectedPlan = plans.find((p: any) => p.id === values.planId);
      const startDate = new Date();
      const expiryDate = selectedPlan 
        ? new Date(startDate.getTime() + selectedPlan.duration * 24 * 60 * 60 * 1000)
        : null;
      
      const memberData: any = {
        ...values,
        loginCode: String(Math.floor(Math.random() * 900000) + 100000),
        planName: selectedPlan?.name,
        startDate: startDate.toISOString(),
        expiryDate: expiryDate?.toISOString(),
      };
      
      // Remove form-only fields from member data
      delete memberData.partialPaymentAmount;
      delete memberData.fullAmountRemaining;
      
      const createdMember = await apiRequest("POST", "/api/members", memberData);
      const member = await createdMember.json();
      
      // Store created member ID for invoice download
      (createMember as any).createdMemberId = member.id;
      
      // Create payment record based on payment status
      if (member.id && selectedPlan) {
        const planPrice = Number(selectedPlan.price) || 0;
        
        if (values.paymentStatus === "paid") {
          // Fully paid - create a paid payment record for the full amount
          await apiRequest("POST", "/api/payments", {
            memberId: member.id,
            amount: String(planPrice),
            paymentMethod: "cash",
            status: "paid",
            planName: selectedPlan.name,
            paidDate: new Date().toISOString(),
          });
        } else if (values.paymentStatus === "pending") {
          const planPricePending = Number(selectedPlan.price) || 0;
          
          if (values.fullAmountRemaining) {
            // Full amount remaining - create one pending payment for full amount
            await apiRequest("POST", "/api/payments", {
              memberId: member.id,
              amount: String(planPricePending),
              paymentMethod: "cash",
              status: "pending",
              planName: selectedPlan.name,
              dueDate: expiryDate?.toISOString() || new Date().toISOString(),
            });
          } else {
            // Partial payment - create two records
            const paidAmount = Number(values.partialPaymentAmount || 0);
            const remainingAmount = planPricePending - paidAmount;
            
            // Create paid payment record for the amount already paid
            if (paidAmount > 0) {
              await apiRequest("POST", "/api/payments", {
                memberId: member.id,
                amount: String(paidAmount),
                paymentMethod: "cash",
                status: "paid",
                planName: selectedPlan.name,
                paidDate: new Date().toISOString(),
              });
            }
            
            // Create pending payment record for remaining amount
            if (remainingAmount > 0) {
              await apiRequest("POST", "/api/payments", {
                memberId: member.id,
                amount: String(remainingAmount),
                paymentMethod: "cash",
                status: "pending",
                planName: selectedPlan.name,
                dueDate: expiryDate?.toISOString() || new Date().toISOString(),
              });
            }
          }
        }
      }
    },
    onSuccess: async () => {
      // Invalidate all related queries to ensure sync across pages (invalidate triggers refetch automatically)
      await queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      setOpen(false);
      form.reset({
        name: "",
        email: "",
        phone: "",
        planId: "",
        status: "active",
        paymentStatus: "paid",
        partialPaymentAmount: "",
        fullAmountRemaining: false,
      });
      const createdMemberId = (createMember as any).createdMemberId;
      toast({
        title: "Member created",
        description: "Member has been added successfully. Invoice has been sent via WhatsApp if connected.",
        action: createdMemberId ? (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const response = await fetch(`/api/members/${createdMemberId}/invoice`, { credentials: "include" });
                if (response.ok) {
                  const blob = await response.blob();
                  const url = URL.createObjectURL(blob);
                  const printWindow = window.open(url, "_blank");
                  if (printWindow) {
                    printWindow.onload = () => {
                      printWindow.print();
                    };
                  }
                  URL.revokeObjectURL(url);
                }
              } catch (error) {
                console.error("Failed to print invoice:", error);
              }
            }}
          >
            Print Invoice
          </Button>
        ) : undefined,
      });
    },
    onError: (error: any) => {
      const message = error?.message || "Failed to create member";
      // Try to extract server-provided JSON message if present
      toast({
        title: "Create member failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const editForm = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const editPaymentStatus = editForm.watch("paymentStatus");
  const editFullAmountRemaining = editForm.watch("fullAmountRemaining");

  const updateMember = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: FormValues }) => {
      // Get selected plan
      const selectedPlan = plans.find((p: any) => p.id === values.planId);
      const memberData: any = {
        ...values,
        planName: selectedPlan?.name,
      };
      
      // Remove form-only fields from member data
      delete memberData.partialPaymentAmount;
      delete memberData.fullAmountRemaining;
      
      await apiRequest("PATCH", `/api/members/${id}`, memberData);
      
      // If payment status changed to pending, create payment record(s)
      const member = members.find((m: any) => m.id === id);
      if (values.paymentStatus === "pending" && selectedPlan && member) {
        const planPrice = Number(selectedPlan.price) || 0;
        
        if (values.fullAmountRemaining) {
          // Full amount remaining - create one pending payment for full amount
          await apiRequest("POST", "/api/payments", {
            memberId: id,
            amount: String(planPrice),
            paymentMethod: "cash",
            status: "pending",
            planName: selectedPlan.name,
            dueDate: member.expiryDate || new Date().toISOString(),
          });
        } else {
          // Partial payment - create two records
          const paidAmount = Number(values.partialPaymentAmount || 0);
          const remainingAmount = planPrice - paidAmount;
          
          // Create paid payment record for the amount already paid
          if (paidAmount > 0) {
            await apiRequest("POST", "/api/payments", {
              memberId: id,
              amount: String(paidAmount),
              paymentMethod: "cash",
              status: "paid",
              planName: selectedPlan.name,
              paidDate: new Date().toISOString(),
            });
          }
          
          // Create pending payment record for remaining amount
          if (remainingAmount > 0) {
            await apiRequest("POST", "/api/payments", {
              memberId: id,
              amount: String(remainingAmount),
              paymentMethod: "cash",
              status: "pending",
              planName: selectedPlan.name,
              dueDate: member.expiryDate || new Date().toISOString(),
            });
          }
        }
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      setEditMemberId(null);
      editForm.reset();
      toast({ title: "Member updated", description: "Member details have been updated." });
    },
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/members/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({ title: "Member deleted", description: "Member has been removed." });
    },
  });

  const freezeMember = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/members/${id}`, { status: "frozen" });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({ title: "Membership frozen", description: "Member's membership has been frozen." });
    },
  });

  const extendForm = useForm<{ months: string }>({
    resolver: zodResolver(z.object({ months: z.string().min(1) })),
    defaultValues: { months: "1" },
  });

  const extendMember = useMutation({
    mutationFn: async ({ id, months }: { id: string; months: number }) => {
      const member = members.find((m: any) => m.id === id);
      if (!member) return;
      const currentExpiry = member.expiryDate ? new Date(member.expiryDate) : new Date();
      const newExpiry = new Date(currentExpiry);
      newExpiry.setMonth(newExpiry.getMonth() + months);
      await apiRequest("PATCH", `/api/members/${id}`, { expiryDate: newExpiry.toISOString() });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      setExtendMemberId(null);
      extendForm.reset();
      toast({ title: "Membership extended", description: "Member's expiry date has been extended." });
    },
  });

  const linkBiometric = useMutation({
    mutationFn: async ({ memberId, biometricId }: { memberId: string; biometricId: string }) => {
      await apiRequest("POST", "/api/biometric/map-member", { memberId, biometricId });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      setLinkBiometricForId(null);
      setBiometricUserId("");
      toast({ title: "Linked", description: "Biometric User ID linked successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to link", description: error?.message || "Could not link biometric.", variant: "destructive" });
    },
  });

  const handleSendReminder = async (id: string) => {
    try {
      const member = members.find((m: any) => m.id === id);
      // Find pending payment for this member
      const { data: payments = [] } = await queryClient.fetchQuery({
        queryKey: ["/api/payments"],
        queryFn: getQueryFn({ on401: "throw" }),
      });
      const pendingPayment = payments.find((p: any) => p.memberId === id && (p.status === "pending" || p.status === "overdue"));
      
      if (pendingPayment) {
        const res = await apiRequest("POST", `/api/payments/${pendingPayment.id}/send-reminder`, {});
        toast({
          title: "Reminder sent",
          description: member ? `Payment reminder sent to ${member.name}` : "Reminder sent",
        });
      } else {
        toast({
          title: "No pending payment",
          description: member ? `${member.name} has no pending payments` : "No pending payment found",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Failed to send reminder",
        description: error?.message || "Could not send reminder. Make sure WhatsApp is connected.",
        variant: "destructive",
      });
    }
  };

  const handleViewProfile = (id: string) => {
    setViewMemberId(id);
  };

  const handleEdit = (id: string) => {
    const member = members.find((m: any) => m.id === id);
    if (member) {
      editForm.reset({
        name: member.name,
        email: member.email,
        phone: member.phone,
        status: member.status,
        paymentStatus: member.paymentStatus,
      });
      setEditMemberId(id);
    }
  };

  const [planFilter, setPlanFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "plan" | "status">("name");

  const filteredMembers = members.filter((member) => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || member.status === statusFilter;
    const matchesPlan = planFilter === "all" || member.planId === planFilter || member.planName === planFilter;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  // Sort members
  const sortedMembers = [...filteredMembers].sort((a: any, b: any) => {
    if (sortBy === "name") {
      return a.name.localeCompare(b.name);
    } else if (sortBy === "plan") {
      const planA = a.planName || "No Plan";
      const planB = b.planName || "No Plan";
      return planA.localeCompare(planB);
    } else if (sortBy === "status") {
      return a.status.localeCompare(b.status);
    }
    return 0;
  });

  const biometricLinkedMembers = filteredMembers.filter((m: any) => !!(m.biometricId ?? m.biometric_id));

  // Calculate expiring this week
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const expiringThisWeek = members.filter((m: any) => {
    if (!m.expiryDate) return false;
    const expiry = new Date(m.expiryDate);
    expiry.setHours(0, 0, 0, 0);
    return expiry >= today && expiry <= nextWeek;
  }).length;

  const stats = {
    active: members.filter((m: any) => m.status === "active").length,
    expiringThisWeek,
    expired: members.filter((m: any) => m.status === "expired").length,
    paymentPending: members.filter((m: any) => m.paymentStatus === "pending" || m.paymentStatus === "overdue").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Members</h1>
          <p className="text-muted-foreground">Manage your gym members</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => sendInvoicesToday.mutate()} disabled={sendInvoicesToday.isPending}>
            {sendInvoicesToday.isPending ? "Sending…" : "Send today's e-bills"}
          </Button>
          <Button data-testid="button-add-member" onClick={() => setOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expiring This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{stats.expiringThisWeek}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{stats.expired}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Payment Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{stats.paymentPending}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-members"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="pending">Pending Renewal</SelectItem>
            <SelectItem value="frozen">Frozen</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            {plans.filter((p: any) => p.isActive).map((plan: any) => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as "name" | "plan" | "status")}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort by Name</SelectItem>
            <SelectItem value="plan">Sort by Plan</SelectItem>
            <SelectItem value="status">Sort by Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="all">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All Members</TabsTrigger>
            <TabsTrigger value="biometric">Biometric Linked</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {sortedMembers.map((member: any) => {
          // Safely parse dates - handle null, empty strings, and invalid dates
          const parseDate = (dateStr: any) => {
            if (!dateStr) return undefined;
            try {
              const date = new Date(dateStr);
              return isNaN(date.getTime()) ? undefined : date;
            } catch {
              return undefined;
            }
          };
          
            return (
              <MemberCard
                key={member.id}
                id={member.id}
                name={member.name}
                photoUrl={member.photoUrl}
                planName={member.planName}
                expiryDate={parseDate(member.expiryDate)}
                status={member.status}
                paymentStatus={member.paymentStatus}
                lastCheckIn={parseDate(member.lastCheckIn)}
                biometricLinked={Boolean(member.biometricId ?? member.biometric_id)}
                onViewProfile={handleViewProfile}
                onSendReminder={handleSendReminder}
                onViewInfo={(id) => setInfoMemberId(id)}
              />
            );
          })}
          </div>
          {sortedMembers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No members found matching your criteria
            </div>
          )}
        </TabsContent>

        <TabsContent value="biometric">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {biometricLinkedMembers.map((member: any) => {
              const parseDate = (dateStr: any) => {
                if (!dateStr) return undefined;
                try {
                  const date = new Date(dateStr);
                  return isNaN(date.getTime()) ? undefined : date;
                } catch {
                  return undefined;
                }
              };
              return (
                <MemberCard
                  key={member.id}
                  id={member.id}
                  name={member.name}
                  photoUrl={member.photoUrl}
                  planName={member.planName}
                  expiryDate={parseDate(member.expiryDate)}
                  status={member.status}
                  paymentStatus={member.paymentStatus}
                  lastCheckIn={parseDate(member.lastCheckIn)}
                  biometricLinked={true}
                  onViewProfile={handleViewProfile}
                  onSendReminder={handleSendReminder}
                  onViewInfo={(id) => setInfoMemberId(id)}
                />
              );
            })}
          </div>
          {biometricLinkedMembers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No biometric-linked members yet. Link a member from their profile.
            </div>
          )}
        </TabsContent>
      </Tabs>


      <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          // Reset form when dialog closes
          form.reset({
            name: "",
            email: "",
            phone: "",
            planId: "",
            status: "active",
            paymentStatus: "paid",
            partialPaymentAmount: "",
            fullAmountRemaining: false,
          });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => createMember.mutate(v))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">+91</span>
                        <Input 
                          placeholder="Enter 10-digit phone number" 
                          {...field}
                          value={field.value?.replace(/^\+91\s?/, "") || ""}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                            field.onChange(value ? `+91${value}` : "");
                          }}
                          className="flex-1"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="planId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Membership Plan</FormLabel>
                    <Select 
                      value={field.value || undefined} 
                      onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select membership plan (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Membership Plan</SelectItem>
                        {plans.filter((p: any) => p.isActive).map((plan: any) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.name} - ₹{Number(plan.price).toLocaleString()} ({plan.duration} days)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">Choose a membership plan for this member</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Membership Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select membership status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active - Member can access gym</SelectItem>
                          <SelectItem value="expired">Expired - Membership has ended</SelectItem>
                          <SelectItem value="pending">Pending - Awaiting activation</SelectItem>
                          <SelectItem value="frozen">Frozen - Temporarily suspended</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">Current status of member's gym access</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Status</FormLabel>
                      <Select value={field.value} onValueChange={(value) => {
                        field.onChange(value);
                        // Reset payment fields when status changes
                        if (value !== "pending") {
                          form.setValue("partialPaymentAmount", "");
                          form.setValue("fullAmountRemaining", false);
                        }
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="paid">Paid - All dues cleared</SelectItem>
                          <SelectItem value="pending">Pending - Payment due</SelectItem>
                          <SelectItem value="overdue">Overdue - Payment delayed</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">Current payment status for fees</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {paymentStatus === "pending" && (
                <div className="space-y-4 p-4 border rounded-md bg-muted/50">
                  <FormField
                    control={form.control}
                    name="fullAmountRemaining"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              if (checked) {
                                form.setValue("partialPaymentAmount", "");
                              }
                            }}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Full amount remaining</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Check this if the full payment amount is still due
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                  {!fullAmountRemaining && (
                    <FormField
                      control={form.control}
                      name="partialPaymentAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount Paid (₹)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Enter amount paid"
                              {...field}
                              disabled={fullAmountRemaining}
                              className={fullAmountRemaining ? "opacity-50 cursor-not-allowed" : ""}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Enter the amount that has been paid. Remaining amount will be calculated automatically.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMember.isPending}>Save</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Profile Dialog */}
      <Dialog open={viewMemberId !== null} onOpenChange={(open) => !open && setViewMemberId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Member Profile</DialogTitle>
          </DialogHeader>
          {viewMemberId && (() => {
            const member = members.find((m: any) => m.id === viewMemberId);
            if (!member) return null;
            const parseDate = (dateStr: any) => {
              if (!dateStr) return null;
              try {
                const date = new Date(dateStr);
                return isNaN(date.getTime()) ? null : date;
              } catch {
                return null;
              }
            };
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={member.photoUrl} alt={member.name} />
                    <AvatarFallback>{member.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-bold">{member.name}</h3>
                    <p className="text-muted-foreground">{member.email}</p>
                    <p className="text-muted-foreground">{member.phone}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge>{member.status}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Status</p>
                    <Badge>{member.paymentStatus}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Plan</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{member.planName || "N/A"}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRenewMemberId(member.id);
                          setRenewPlanId(member.planId || "");
                        }}
                      >
                        Change Plan
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Login Code</p>
                    <p className="font-mono">{member.loginCode}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p>{parseDate(member.startDate) ? format(parseDate(member.startDate)!, "MMM dd, yyyy") : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expiry Date</p>
                    <p>{parseDate(member.expiryDate) ? format(parseDate(member.expiryDate)!, "MMM dd, yyyy") : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Check-In</p>
                    <p>{parseDate(member.lastCheckIn) ? format(parseDate(member.lastCheckIn)!, "MMM dd, yyyy HH:mm") : "Never"}</p>
                  </div>
                </div>
                <DialogFooter className="flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    onClick={async () => {
                      try {
                        const response = await fetch(`/api/members/${viewMemberId}/invoice`, { credentials: "include" });
                        if (response.ok) {
                          const blob = await response.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `Invoice-${member.name}-${Date.now()}.pdf`;
                          a.click();
                          URL.revokeObjectURL(url);
                          toast({
                            title: "Invoice downloaded",
                            description: "Invoice has been downloaded successfully.",
                          });
                        }
                      } catch (error) {
                        toast({
                          title: "Failed to download invoice",
                          description: "Could not download invoice. Please try again.",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Invoice
                  </Button>
                  <Button variant="outline" onClick={() => { setViewMemberId(null); handleEdit(viewMemberId!); }}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button onClick={() => { setLinkBiometricForId(viewMemberId!); setBiometricUserId(""); }}>
                    <Fingerprint className="h-4 w-4 mr-2" />
                    Link Biometric
                  </Button>
                  <Button variant="destructive" onClick={() => { deleteMember.mutate(viewMemberId!); setViewMemberId(null); }} disabled={deleteMember.isPending}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Link Biometric Dialog */}
      <Dialog open={linkBiometricForId !== null} onOpenChange={(open) => !open && setLinkBiometricForId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Biometric</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter the User ID from the fingerprint device (e.g., 41).</p>
            <Input
              placeholder="Device User ID"
              value={biometricUserId}
              onChange={(e) => setBiometricUserId(e.target.value)}
              data-testid="input-biometric-user-id"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkBiometricForId(null)}>Cancel</Button>
            <Button
              onClick={() => linkBiometricForId && linkBiometric.mutate({ memberId: linkBiometricForId, biometricId: biometricUserId.trim() })}
              disabled={linkBiometric.isPending || biometricUserId.trim() === ""}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={editMemberId !== null} onOpenChange={(open) => !open && setEditMemberId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((v) => editMemberId && updateMember.mutate({ id: editMemberId, values: v }))} className="space-y-4">
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField
                control={editForm.control}
                name="planId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Membership Plan</FormLabel>
                    <Select 
                      value={field.value || undefined} 
                      onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select membership plan (required)" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.filter((p: any) => p.isActive).map((plan: any) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.name} - ₹{Number(plan.price).toLocaleString()} ({plan.duration} days)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel><Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="frozen">Frozen</SelectItem>
                    </SelectContent>
                  </Select><FormMessage /></FormItem>
                )} />
                <FormField 
                  control={editForm.control} 
                  name="paymentStatus" 
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Status</FormLabel>
                      <Select 
                        value={field.value} 
                        onValueChange={(value) => {
                          field.onChange(value);
                          // Reset payment fields when status changes
                          if (value !== "pending") {
                            editForm.setValue("partialPaymentAmount", "");
                            editForm.setValue("fullAmountRemaining", false);
                          }
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
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
              {editPaymentStatus === "pending" && (
                <div className="space-y-4 p-4 border rounded-md bg-muted/50">
                  <FormField
                    control={editForm.control}
                    name="fullAmountRemaining"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              if (checked) {
                                editForm.setValue("partialPaymentAmount", "");
                              }
                            }}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Full amount remaining</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Check this if the full payment amount is still due
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                  {!editFullAmountRemaining && (
                    <FormField
                      control={editForm.control}
                      name="partialPaymentAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount Paid (₹)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Enter amount paid"
                              {...field}
                              disabled={editFullAmountRemaining}
                              className={editFullAmountRemaining ? "opacity-50 cursor-not-allowed" : ""}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Enter the amount that has been paid. Remaining amount will be calculated automatically.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditMemberId(null)}>Cancel</Button>
                <Button type="submit" disabled={updateMember.isPending}>Save</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Information Dialog */}
      <Dialog open={infoMemberId !== null} onOpenChange={(open) => !open && setInfoMemberId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Member Information</DialogTitle>
          </DialogHeader>
          {infoMemberId && (() => {
            const member = members.find((m: any) => m.id === infoMemberId);
            if (!member) return null;
            const parseDate = (dateStr: any) => {
              if (!dateStr) return null;
              try {
                const date = new Date(dateStr);
                return isNaN(date.getTime()) ? null : date;
              } catch {
                return null;
              }
            };
            const memberPayments = payments.filter((p: any) => p.memberId === infoMemberId);
            const latestPayment = memberPayments
              .filter((p: any) => p.status === "paid" && p.paidDate)
              .sort((a: any, b: any) => {
                const dateA = parseDate(a.paidDate);
                const dateB = parseDate(b.paidDate);
                if (!dateA || !dateB) return 0;
                return dateB.getTime() - dateA.getTime();
              })[0];
            const pendingPayments = memberPayments.filter((p: any) => p.status === "pending" || p.status === "overdue");
            const totalPending = pendingPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
            return (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={member.photoUrl} alt={member.name} />
                    <AvatarFallback>{member.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-bold">{member.name}</h3>
                    <p className="text-muted-foreground">{member.email}</p>
                    <p className="text-muted-foreground">{member.phone}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Join Date</p>
                    <p className="font-medium">{parseDate(member.startDate) ? format(parseDate(member.startDate)!, "MMM dd, yyyy") : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Current Package</p>
                    <p className="font-medium">{member.planName || "No Package"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Last Payment Date</p>
                    <p className="font-medium">{latestPayment && parseDate(latestPayment.paidDate) ? format(parseDate(latestPayment.paidDate)!, "MMM dd, yyyy") : "No payments yet"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Last Payment Amount</p>
                    <p className="font-medium">{latestPayment ? `₹${Number(latestPayment.amount || 0).toLocaleString()}` : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Remaining Fees</p>
                    <p className={`font-medium ${totalPending > 0 ? "text-destructive" : ""}`}>
                      {totalPending > 0 ? `₹${totalPending.toLocaleString()}` : "No pending fees"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Membership Expires</p>
                    <p className="font-medium">{parseDate(member.expiryDate) ? format(parseDate(member.expiryDate)!, "MMM dd, yyyy") : "N/A"}</p>
                  </div>
                </div>
                {pendingPayments.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Pending Payments</p>
                    <div className="space-y-2">
                      {pendingPayments.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <p className="font-medium">{p.planName || "Membership Fee"}</p>
                            <p className="text-xs text-muted-foreground">
                              Due: {parseDate(p.dueDate) ? format(parseDate(p.dueDate)!, "MMM dd, yyyy") : "N/A"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">₹{Number(p.amount || 0).toLocaleString()}</p>
                            <Badge variant={p.status === "overdue" ? "destructive" : "secondary"}>{p.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInfoMemberId(null)}>Close</Button>
                  <Button onClick={() => { 
                    setInfoMemberId(null); 
                    window.location.href = `/members/history?id=${infoMemberId}`;
                  }}>
                    View Full History
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Extend Membership Dialog */}
      <Dialog open={extendMemberId !== null} onOpenChange={(open) => !open && setExtendMemberId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Membership</DialogTitle>
          </DialogHeader>
          <Form {...extendForm}>
            <form onSubmit={extendForm.handleSubmit((v) => extendMemberId && extendMember.mutate({ id: extendMemberId, months: parseInt(v.months) }))} className="space-y-4">
              <FormField control={extendForm.control} name="months" render={({ field }) => (
                <FormItem>
                  <FormLabel>Extend by (months)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" placeholder="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setExtendMemberId(null)}>Cancel</Button>
                <Button type="submit" disabled={extendMember.isPending}>Extend</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Renew/Change Plan Dialog */}
      <Dialog open={renewMemberId !== null} onOpenChange={(open) => {
        if (!open) {
          setRenewMemberId(null);
          setRenewPlanId("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Membership Plan</DialogTitle>
          </DialogHeader>
          {renewMemberId && (() => {
            const member = members.find((m: any) => m.id === renewMemberId);
            if (!member) return null;
            
            return (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Member: <span className="font-medium">{member.name}</span></p>
                  <p className="text-sm text-muted-foreground">Current Plan: <span className="font-medium">{member.planName || "None"}</span></p>
                </div>
                <Select value={renewPlanId} onValueChange={setRenewPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select new plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Remove Plan</SelectItem>
                    {plans.filter((p: any) => p.isActive).map((plan: any) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - ₹{Number(plan.price).toLocaleString()} ({plan.duration} days)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setRenewMemberId(null); setRenewPlanId(""); }}>Cancel</Button>
                  <Button
                    onClick={async () => {
                      if (!renewMemberId) return;
                      const selectedPlan = renewPlanId === "none" ? null : plans.find((p: any) => p.id === renewPlanId);
                      const startDate = new Date();
                      const expiryDate = selectedPlan 
                        ? new Date(startDate.getTime() + selectedPlan.duration * 24 * 60 * 60 * 1000)
                        : null;
                      
                      await apiRequest("PATCH", `/api/members/${renewMemberId}`, {
                        planId: renewPlanId === "none" ? null : renewPlanId,
                        planName: selectedPlan?.name || null,
                        startDate: startDate.toISOString(),
                        expiryDate: expiryDate?.toISOString(),
                        status: selectedPlan ? "active" : member.status,
                      });
                      
                      await queryClient.invalidateQueries({ queryKey: ["/api/members"] });
                      setRenewMemberId(null);
                      setRenewPlanId("");
                      toast({
                        title: "Plan updated",
                        description: selectedPlan ? `Member plan changed to ${selectedPlan.name}` : "Plan removed from member",
                      });
                    }}
                  >
                    Update Plan
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
