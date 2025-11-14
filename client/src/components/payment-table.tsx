import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { format } from "date-fns";

// Helper function to safely parse and format dates
function parseDate(dateStr: any): Date | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function formatDate(date: any): string {
  const parsed = parseDate(date);
  return parsed ? format(parsed, "MMM dd, yyyy") : "—";
}

interface Payment {
  id: string;
  memberName: string;
  amount: number;
  dueDate: Date;
  status: "pending" | "paid" | "overdue";
  planName: string;
}

interface PaymentTableProps {
  payments: Payment[];
  onSendReminder: (id: string) => void;
}

export function PaymentTable({ payments, onSendReminder }: PaymentTableProps) {
  const statusColors = {
    paid: "bg-chart-3 text-white",
    pending: "bg-chart-4 text-white",
    overdue: "bg-destructive text-destructive-foreground",
  };

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                No pending payments
              </TableCell>
            </TableRow>
          ) : (
            payments.map((payment) => (
              <TableRow key={payment.id} className="hover-elevate">
                <TableCell className="font-medium">{payment.memberName}</TableCell>
                <TableCell className="text-muted-foreground">{payment.planName}</TableCell>
                <TableCell className="text-right font-mono">₹{payment.amount.toLocaleString()}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(payment.dueDate)}
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[payment.status]}>
                    {payment.status.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {payment.status !== "paid" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSendReminder(payment.id)}
                      data-testid={`button-send-reminder-${payment.id}`}
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Remind
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
