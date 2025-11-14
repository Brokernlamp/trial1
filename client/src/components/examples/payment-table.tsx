import { PaymentTable } from "../payment-table";

export default function PaymentTableExample() {
  const mockPayments = [
    {
      id: "1",
      memberName: "John Doe",
      amount: 5000,
      dueDate: new Date(2025, 10, 5),
      status: "pending" as const,
      planName: "Premium Plan",
    },
    {
      id: "2",
      memberName: "Jane Smith",
      amount: 3000,
      dueDate: new Date(2025, 9, 28),
      status: "overdue" as const,
      planName: "Basic Plan",
    },
  ];

  return (
    <div className="p-4">
      <PaymentTable
        payments={mockPayments}
        onSendReminder={(id) => console.log("Send reminder", id)}
      />
    </div>
  );
}
