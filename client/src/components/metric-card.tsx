import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
}

export function MetricCard({ title, value, icon: Icon, trend, subtitle }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold tabular-nums">{value}</div>
        {trend && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            {trend.isPositive ? (
              <TrendingUp className="h-3 w-3 text-chart-3" />
            ) : (
              <TrendingDown className="h-3 w-3 text-destructive" />
            )}
            <span className={trend.isPositive ? "text-chart-3" : "text-destructive"}>
              {trend.value > 0 ? "+" : ""}{trend.value}%
            </span>
            <span>from last month</span>
          </div>
        )}
        {subtitle && (
          <p className="mt-2 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
