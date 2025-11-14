import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock, Users, User } from "lucide-react";
import { format } from "date-fns";

interface ClassCardProps {
  id: string;
  name: string;
  type: string;
  trainerName: string;
  trainerPhoto?: string;
  startTime: Date;
  endTime: Date;
  capacity: number;
  enrolled: number;
  onViewDetails: (id: string) => void;
  onManageEnrollment: (id: string) => void;
}

export function ClassCard({
  id,
  name,
  type,
  trainerName,
  trainerPhoto,
  startTime,
  endTime,
  capacity,
  enrolled,
  onViewDetails,
  onManageEnrollment,
}: ClassCardProps) {
  const enrollmentPercent = (enrolled / capacity) * 100;
  const isFull = enrolled >= capacity;

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      yoga: "bg-chart-2 text-white",
      zumba: "bg-chart-4 text-white",
      crossfit: "bg-chart-1 text-white",
      pilates: "bg-chart-3 text-white",
    };
    return colors[type.toLowerCase()] || "bg-muted text-muted-foreground";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-lg">{name}</CardTitle>
            <Badge className={getTypeColor(type)}>{type}</Badge>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {format(startTime, "HH:mm")} - {format(endTime, "HH:mm")}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={trainerPhoto} alt={trainerName} />
            <AvatarFallback>
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="text-sm">
            <div className="font-medium">{trainerName}</div>
            <div className="text-muted-foreground">Trainer</div>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2 text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Users className="h-4 w-4" />
              Enrollment
            </div>
            <span className="font-medium tabular-nums">
              {enrolled}/{capacity}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                isFull ? "bg-destructive" : "bg-chart-1"
              }`}
              style={{ width: `${Math.min(enrollmentPercent, 100)}%` }}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewDetails(id)}
          data-testid={`button-view-class-${id}`}
        >
          View Details
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onManageEnrollment(id)}
          data-testid={`button-manage-enrollment-${id}`}
        >
          Manage
        </Button>
      </CardFooter>
    </Card>
  );
}
