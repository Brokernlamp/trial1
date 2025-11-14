import { MemberCard } from "../member-card";

export default function MemberCardExample() {
  return (
    <div className="p-4 max-w-md">
      <MemberCard
        id="1"
        name="John Doe"
        planName="Premium Plan"
        expiryDate={new Date(2025, 11, 15)}
        status="active"
        paymentStatus="paid"
        lastCheckIn={new Date(2025, 9, 30)}
        onViewProfile={(id) => console.log("View profile", id)}
        onSendReminder={(id) => console.log("Send reminder", id)}
        onFreeze={(id) => console.log("Freeze", id)}
        onExtend={(id) => console.log("Extend", id)}
      />
    </div>
  );
}
