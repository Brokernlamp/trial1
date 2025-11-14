import { MetricCard } from "../metric-card";
import { Users } from "lucide-react";

export default function MetricCardExample() {
  return (
    <div className="p-4">
      <MetricCard
        title="Active Members"
        value={342}
        icon={Users}
        trend={{ value: 12.5, isPositive: true }}
      />
    </div>
  );
}
