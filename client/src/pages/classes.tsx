import { ClassCard } from "@/components/class-card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function Classes() {
  // Classes feature not implemented in backend
  const upcomingClasses: any[] = [];
  const popularClasses: any[] = [];
  const { toast } = useToast();

  const handleCreateClass = () => {
    toast({
      title: "Feature not implemented",
      description: "Classes feature is not yet implemented in the backend. This functionality will be available in a future update.",
      variant: "default",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Classes & Schedule</h1>
          <p className="text-muted-foreground">Manage group classes and schedules</p>
        </div>
        <Button data-testid="button-create-class" onClick={handleCreateClass}>
          <Plus className="h-4 w-4 mr-2" />
          Create Class
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{upcomingClasses.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Enrollment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">
              {upcomingClasses.reduce((sum, c) => sum + c.enrolled, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Capacity Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">
              {Math.round(
                (upcomingClasses.reduce((sum, c) => sum + c.enrolled, 0) /
                  upcomingClasses.reduce((sum, c) => sum + c.capacity, 0)) *
                  100
              )}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Most Popular Classes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Classes feature not implemented in backend
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-semibold mb-4">Upcoming Classes</h2>
        {upcomingClasses.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcomingClasses.map((classItem) => (
              <ClassCard
                key={classItem.id}
                {...classItem}
              onViewDetails={(id) => {
                // Feature not implemented
              }}
              onManageEnrollment={(id) => {
                // Feature not implemented
              }}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border rounded-md text-muted-foreground">
            No classes scheduled. Classes feature not implemented in backend.
          </div>
        )}
      </div>
    </div>
  );
}
