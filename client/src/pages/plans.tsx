import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Edit, Trash2, CheckCircle, XCircle, Package, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const planFormSchema = z.object({
  name: z.string().min(1, "Plan name is required"),
  duration: z.string().min(1, "Duration is required").refine((val) => !isNaN(Number(val)), "Duration must be a number"),
  price: z.string().min(1, "Price is required").refine((val) => !isNaN(Number(val)), "Price must be a number"),
  features: z.string().optional(),
  isActive: z.boolean().default(true),
});

type PlanFormValues = z.infer<typeof planFormSchema>;

export default function Plans() {
  const [open, setOpen] = useState(false);
  const [editPlanId, setEditPlanId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: plans = [] } = useQuery({
    queryKey: ["/api/plans"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      name: "",
      duration: "30",
      price: "0",
      features: "",
      isActive: true,
    },
  });

  const editForm = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
  });

  const createPlan = useMutation({
    mutationFn: async (values: PlanFormValues) => {
      const featuresArray = values.features
        ? values.features.split("\n").filter((f) => f.trim()).map((f) => f.trim())
        : [];
      await apiRequest("POST", "/api/plans", {
        name: values.name,
        duration: parseInt(values.duration),
        price: values.price,
        features: featuresArray,
        isActive: values.isActive,
      });
    },
    onSuccess: async () => {
      // Invalidate triggers automatic refetch
      await queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      setOpen(false);
      form.reset();
      toast({
        title: "Plan created",
        description: "Membership plan has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create plan",
        variant: "destructive",
      });
    },
  });

  const updatePlan = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: PlanFormValues }) => {
      const featuresArray = values.features
        ? values.features.split("\n").filter((f) => f.trim()).map((f) => f.trim())
        : [];
      await apiRequest("PATCH", `/api/plans/${id}`, {
        name: values.name,
        duration: parseInt(values.duration),
        price: values.price,
        features: featuresArray,
        isActive: values.isActive,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      setEditPlanId(null);
      editForm.reset();
      toast({
        title: "Plan updated",
        description: "Membership plan has been updated successfully.",
      });
    },
  });

  const deletePlan = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/plans/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      toast({
        title: "Plan deleted",
        description: "Membership plan has been removed.",
      });
    },
  });

  const handleEdit = (plan: any) => {
    editForm.reset({
      name: plan.name,
      duration: String(plan.duration),
      price: String(plan.price),
      features: Array.isArray(plan.features) ? plan.features.join("\n") : plan.features || "",
      isActive: plan.isActive,
    });
    setEditPlanId(plan.id);
  };

  const activePlans = plans.filter((p: any) => p.isActive);
  const inactivePlans = plans.filter((p: any) => !p.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Membership Plans</h1>
          <p className="text-muted-foreground">Create and manage membership plans for your gym</p>
        </div>
        <Button data-testid="button-create-plan" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Plan
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{plans.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums text-chart-3">{activePlans.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inactive Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums text-muted-foreground">{inactivePlans.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan: any) => (
          <Card key={plan.id} className="hover-elevate">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-chart-1" />
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                </div>
                {plan.isActive ? (
                  <Badge className="bg-chart-3 text-white">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="text-lg font-semibold">{plan.duration} days</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Price</p>
                <p className="text-2xl font-bold">₹{Number(plan.price).toLocaleString()}</p>
              </div>
              {Array.isArray(plan.features) && plan.features.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Features</p>
                  <ul className="space-y-1">
                    {plan.features.map((feature: string, idx: number) => (
                      <li key={idx} className="text-sm flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-chart-3" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(plan)}
                  className="flex-1"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm(`Delete plan "${plan.name}"?`)) {
                      deletePlan.mutate(plan.id);
                    }
                  }}
                  disabled={deletePlan.isPending}
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-12 border rounded-md text-muted-foreground">
          No membership plans created yet. Create your first plan to get started.
        </div>
      )}

      {/* Create Plan Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Membership Plan</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => createPlan.mutate(v))} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Premium Annual" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (days)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="30" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="5000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="features"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Features (one per line)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Access to all equipment&#10;Personal trainer session&#10;Nutrition consultation"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Plan is Active</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Active plans can be assigned to new members
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={createPlan.isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createPlan.isPending}>
                  {createPlan.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Plan
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Plan Dialog */}
      <Dialog open={editPlanId !== null} onOpenChange={(open) => !open && setEditPlanId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Membership Plan</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((v) => editPlanId && updatePlan.mutate({ id: editPlanId, values: v }))} className="space-y-4">
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Plan Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="duration" render={({ field }) => (
                  <FormItem><FormLabel>Duration (days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={editForm.control} name="price" render={({ field }) => (
                  <FormItem><FormLabel>Price (₹)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="features" render={({ field }) => (
                <FormItem><FormLabel>Features (one per line)</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="isActive" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5"><FormLabel>Plan is Active</FormLabel><p className="text-xs text-muted-foreground">Active plans can be assigned to new members</p></div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditPlanId(null)}>Cancel</Button>
                <Button type="submit" disabled={updatePlan.isPending}>Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

