import { RevenueChart } from "../revenue-chart";

export default function RevenueChartExample() {
  const mockData = [
    { month: "May", revenue: 45000 },
    { month: "Jun", revenue: 52000 },
    { month: "Jul", revenue: 48000 },
    { month: "Aug", revenue: 61000 },
    { month: "Sep", revenue: 55000 },
    { month: "Oct", revenue: 67000 },
  ];

  return (
    <div className="p-4">
      <RevenueChart data={mockData} />
    </div>
  );
}
