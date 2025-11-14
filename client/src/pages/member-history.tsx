import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function MemberHistory() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const memberId = params.get("id");

  const { data: members = [] } = useQuery({
    queryKey: ["/api/members"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["/api/members", memberId, "history"],
    queryFn: async () => {
      if (!memberId) return [];
      const response = await fetch(`/api/members/${memberId}/history`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch history");
      return response.json();
    },
    enabled: !!memberId,
  });

  const member = members.find((m: any) => m.id === memberId);

  const parseDate = (dateStr: any) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  };

  const getPlanStatusBadge = (status: string) => {
    const statusLower = (status || "").toLowerCase();
    if (statusLower === "active") {
      return <Badge className="bg-chart-3 text-white">Active</Badge>;
    } else if (statusLower === "expired") {
      return <Badge variant="destructive">Expired</Badge>;
    } else if (statusLower === "pending") {
      return <Badge className="bg-chart-4 text-white">Pending</Badge>;
    }
    return <Badge variant="secondary">{status || "N/A"}</Badge>;
  };

  if (!memberId) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => setLocation("/members")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Members
        </Button>
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">No member ID provided</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => setLocation("/members")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Members
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Member History</h1>
            {member && (
              <div className="flex items-center gap-3 mt-2">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.photoUrl} alt={member.name} />
                  <AvatarFallback>
                    {member.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment & Plan History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No history found for this member</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Sr No.</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Membership Plan</TableHead>
                    <TableHead>Plan Status</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item: any) => {
                    const date = parseDate(item.date);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.srNo}</TableCell>
                        <TableCell>
                          {date ? format(date, "MMM dd, yyyy") : "N/A"}
                        </TableCell>
                        <TableCell>{item.membershipPlan}</TableCell>
                        <TableCell>{getPlanStatusBadge(item.planStatus)}</TableCell>
                        <TableCell className="uppercase">{item.paymentMethod}</TableCell>
                        <TableCell>₹{Number(item.amount || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={item.paid === "YES" ? "default" : "secondary"}>
                            {item.paid}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

