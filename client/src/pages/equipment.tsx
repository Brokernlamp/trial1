import { useState } from "react";
import { EquipmentStatus } from "@/components/equipment-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Wrench, AlertTriangle, CheckCircle } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const equipmentFormSchema = z.object({
  name: z.string().min(1, "Equipment name is required"),
  category: z.string().min(1, "Category is required"),
  status: z.enum(["operational", "maintenance", "repair"]).default("operational"),
});

type EquipmentFormValues = z.infer<typeof equipmentFormSchema>;

export default function Equipment() {
  const [open, setOpen] = useState(false);
  const [scheduleMaintenanceId, setScheduleMaintenanceId] = useState<string | null>(null);
  
  const { data: equipment = [] } = useQuery({
    queryKey: ["/api/equipment"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const form = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: {
      name: "",
      category: "",
      status: "operational",
    },
  });

  const addEquipment = useMutation({
    mutationFn: async (values: EquipmentFormValues) => {
      await apiRequest("POST", "/api/equipment", values);
    },
    onSuccess: async () => {
      // Invalidate triggers automatic refetch
      await queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setOpen(false);
      form.reset();
    },
  });

  const scheduleMaintenance = useMutation({
    mutationFn: async (id: string) => {
      const nextMaintenance = new Date();
      nextMaintenance.setDate(nextMaintenance.getDate() + 7); // Schedule 7 days from now
      await apiRequest("PATCH", `/api/equipment/${id}`, {
        status: "maintenance",
        nextMaintenance: nextMaintenance.toISOString(),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setScheduleMaintenanceId(null);
    },
  });

  const stats = {
    total: equipment.length,
    operational: equipment.filter((e) => e.status === "operational").length,
    maintenance: equipment.filter((e) => e.status === "maintenance").length,
    repair: equipment.filter((e) => e.status === "repair").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Equipment Management</h1>
          <p className="text-muted-foreground">Track and maintain gym equipment</p>
        </div>
        <Button data-testid="button-add-equipment" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Equipment
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Equipment</CardTitle>
            <Wrench className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Operational</CardTitle>
            <CheckCircle className="h-5 w-5 text-chart-3" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums text-chart-3">{stats.operational}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Maintenance</CardTitle>
            <Wrench className="h-5 w-5 text-chart-4" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums text-chart-4">{stats.maintenance}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Needs Repair</CardTitle>
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums text-destructive">{stats.repair}</div>
          </CardContent>
        </Card>
      </div>

      <EquipmentStatus
        equipment={equipment}
        onScheduleMaintenance={(id) => setScheduleMaintenanceId(id)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Equipment</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => addEquipment.mutate(v))} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Treadmill #1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Cardio, Weights" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Status</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        {...field}
                      >
                        <option value="operational">Operational</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="repair">Repair</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addEquipment.isPending}>
                  Add Equipment
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleMaintenanceId !== null} onOpenChange={(open) => !open && setScheduleMaintenanceId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Maintenance</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will mark the equipment as "In Maintenance" and schedule maintenance for 7 days from now.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setScheduleMaintenanceId(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => scheduleMaintenanceId && scheduleMaintenance.mutate(scheduleMaintenanceId)}
              disabled={scheduleMaintenance.isPending}
            >
              Schedule Maintenance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            Equipment maintenance calendar coming soon
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
