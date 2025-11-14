import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AttendanceHeatmapProps {
  data: Array<{ hour: number; day: string; count: number }>;
}

export function AttendanceHeatmap({ data }: AttendanceHeatmapProps) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hours = Array.from({ length: 14 }, (_, i) => i + 6);

  const getCountForCell = (day: string, hour: number) => {
    const cell = data.find((d) => d.day === day && d.hour === hour);
    return cell?.count || 0;
  };

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const getOpacity = (count: number) => {
    if (count === 0) return 0.1;
    return 0.2 + (count / maxCount) * 0.8;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Peak Hours Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="flex gap-1 mb-2">
              <div className="w-12" />
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="flex-1 min-w-[40px] text-center text-xs text-muted-foreground"
                >
                  {hour}:00
                </div>
              ))}
            </div>
            {days.map((day) => (
              <div key={day} className="flex gap-1 mb-1">
                <div className="w-12 text-xs text-muted-foreground flex items-center">
                  {day}
                </div>
                {hours.map((hour) => {
                  const count = getCountForCell(day, hour);
                  return (
                    <div
                      key={`${day}-${hour}`}
                      className="flex-1 min-w-[40px] h-8 rounded-sm"
                      style={{
                        backgroundColor: `hsl(var(--chart-1) / ${getOpacity(count)})`,
                      }}
                      title={`${day} ${hour}:00 - ${count} check-ins`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-1">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((opacity) => (
              <div
                key={opacity}
                className="w-4 h-4 rounded-sm"
                style={{
                  backgroundColor: `hsl(var(--chart-1) / ${opacity})`,
                }}
              />
            ))}
          </div>
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}
