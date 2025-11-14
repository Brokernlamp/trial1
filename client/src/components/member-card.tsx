import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Info, Eye } from "lucide-react";
import { format } from "date-fns";

interface MemberCardProps {
  id: string;
  name: string;
  photoUrl?: string;
  planName?: string;
  expiryDate?: Date;
  status: "active" | "expired" | "pending" | "frozen";
  paymentStatus: "paid" | "pending" | "overdue";
  lastCheckIn?: Date;
  biometricLinked?: boolean;
  onViewProfile: (id: string) => void;
  onSendReminder: (id: string) => void;
  onViewInfo: (id: string) => void;
}

export function MemberCard({
  id,
  name,
  photoUrl,
  planName,
  expiryDate,
  status,
  paymentStatus,
  lastCheckIn,
  biometricLinked,
  onViewProfile,
  onSendReminder,
  onViewInfo,
}: MemberCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const statusColors = {
    active: "bg-chart-3 text-white",
    expired: "bg-destructive text-destructive-foreground",
    pending: "bg-chart-4 text-white",
    frozen: "bg-muted text-muted-foreground",
  };

  const paymentColors = {
    paid: "bg-chart-3 text-white",
    pending: "bg-chart-4 text-white",
    overdue: "bg-destructive text-destructive-foreground",
  };

  return (
    <Card className="hover-elevate">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={photoUrl} alt={name} />
            <AvatarFallback className="text-xs">{getInitials(name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1.5 min-w-0">
            <div>
              <h3 className="font-semibold text-sm truncate" data-testid={`text-member-name-${id}`}>{name}</h3>
              {planName && <p className="text-xs text-muted-foreground truncate">{planName}</p>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className={`${statusColors[status]} text-xs px-1.5 py-0`}>
                {status.toUpperCase()}
              </Badge>
              <Badge variant="secondary" className={`${paymentColors[paymentStatus]} text-xs px-1.5 py-0`}>
                {paymentStatus.toUpperCase()}
              </Badge>
              {biometricLinked !== undefined && (
                <Badge variant={biometricLinked ? "secondary" : "outline"} className="text-xs px-1.5 py-0">
                  {biometricLinked ? "Bio" : "No Bio"}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {expiryDate && !isNaN(expiryDate.getTime()) && (
                <div className="truncate">Exp: {format(expiryDate, "MMM dd")}</div>
              )}
              {lastCheckIn && !isNaN(lastCheckIn.getTime()) && (
                <div className="truncate">Last: {format(lastCheckIn, "MMM dd")}</div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-1.5 p-3 pt-0">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onViewProfile(id)}
          data-testid={`button-view-profile-${id}`}
          className="text-xs px-2 py-1 h-7"
        >
          <Eye className="h-3 w-3 mr-1" />
          View
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSendReminder(id)}
          data-testid={`button-send-reminder-${id}`}
          className="text-xs px-2 py-1 h-7"
        >
          <MessageSquare className="h-3 w-3 mr-1" />
          WhatsApp
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onViewInfo(id)}
          data-testid={`button-view-info-${id}`}
          className="text-xs px-2 py-1 h-7"
        >
          <Info className="h-3 w-3 mr-1" />
          Info
        </Button>
      </CardFooter>
    </Card>
  );
}
