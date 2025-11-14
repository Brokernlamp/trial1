import { AttendanceHeatmap } from "../attendance-heatmap";

export default function AttendanceHeatmapExample() {
  const mockData = [];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  
  for (const day of days) {
    for (let hour = 6; hour < 20; hour++) {
      const count = Math.floor(Math.random() * 50);
      mockData.push({ hour, day, count });
    }
  }

  return (
    <div className="p-4">
      <AttendanceHeatmap data={mockData} />
    </div>
  );
}
