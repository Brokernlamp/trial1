import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Clock, DollarSign, Users, Save, Key, RefreshCw, Fingerprint, CheckCircle2, XCircle, Database, Download, Upload, ArrowLeftRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";

export default function Settings() {
  const { toast } = useToast();
  const [gymInfo, setGymInfo] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    gstNumber: "",
  });

  const [operatingHours, setOperatingHours] = useState({
    weekdayOpen: "06:00",
    weekdayClose: "22:00",
    weekendOpen: "07:00",
    weekendClose: "21:00",
  });

  const [gpsSettings, setGpsSettings] = useState({
    enabled: true,
    latitude: "",
    longitude: "",
    radius: "100",
  });


  const [paymentSettings, setPaymentSettings] = useState({
    razorpayKey: "",
    stripeKey: "",
    taxRate: "18",
  });

  const [biometricSettings, setBiometricSettings] = useState({
    ip: "",
    port: "4370",
    commKey: "",
    unlockSeconds: "3",
    relayType: "NO",
  });

  const [testUserId, setTestUserId] = useState("");
  const [lastScannedId, setLastScannedId] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [lastProcessedTimestamp, setLastProcessedTimestamp] = useState<string | null>(null);

  const [databaseSyncSettings, setDatabaseSyncSettings] = useState({
    tursoDatabaseUrl: "",
    tursoAuthToken: "",
  });

  const { data: biometricSettingsData, isLoading: biometricLoading } = useQuery({
    queryKey: ["/api/biometric/settings"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Monitor scan logs in real-time for test detection
  const { data: scanLogsData = { logs: [] } } = useQuery({
    queryKey: ["/api/biometric/scan-logs"],
    queryFn: getQueryFn({ on401: "throw" }),
    refetchInterval: 3000, // Check every 3 seconds (reduced from 1s for performance)
    enabled: !!biometricSettings.ip, // Monitor if device is configured
  });

  // Update last scanned ID when new scans arrive
  useEffect(() => {
    if (scanLogsData?.logs && scanLogsData.logs.length > 0) {
      const latestLog = scanLogsData.logs[0]; // Most recent log (they're reversed)
      if (latestLog && latestLog.biometricId) {
        const logTimestamp = latestLog.timestamp;
        // Only update if this is a new scan (different timestamp)
        if (lastProcessedTimestamp !== logTimestamp) {
          setLastScannedId(latestLog.biometricId);
          setLastScanTime(new Date(logTimestamp));
          setLastProcessedTimestamp(logTimestamp);
        }
      }
    }
  }, [scanLogsData, lastProcessedTimestamp]);

  useEffect(() => {
    if (biometricSettingsData && !biometricLoading) {
      setBiometricSettings({
        ip: biometricSettingsData.ip || "",
        port: biometricSettingsData.port || "4370",
        commKey: biometricSettingsData.commKey || "",
        unlockSeconds: biometricSettingsData.unlockSeconds || "3",
        relayType: biometricSettingsData.relayType || "NO",
      });
    }
  }, [biometricSettingsData, biometricLoading]);

  // Load settings
  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Update local state when settings load
  useEffect(() => {
    if (settings && !isLoading && Object.keys(settings).length > 0) {
      setGymInfo({
        name: settings.gymName || "",
        address: settings.gymAddress || "",
        phone: settings.gymPhone || "",
        email: settings.gymEmail || "",
        gstNumber: settings.gymGstNumber || "",
      });
      setOperatingHours({
        weekdayOpen: settings.weekdayOpen || "06:00",
        weekdayClose: settings.weekdayClose || "22:00",
        weekendOpen: settings.weekendOpen || "07:00",
        weekendClose: settings.weekendClose || "21:00",
      });
      setGpsSettings({
        enabled: settings.gpsEnabled ?? true,
        latitude: settings.gpsLatitude || "",
        longitude: settings.gpsLongitude || "",
        radius: settings.gpsRadius || "100",
      });
      setPaymentSettings({
        razorpayKey: settings.razorpayKey || "",
        stripeKey: settings.stripeKey || "",
        taxRate: settings.taxRate || "18",
      });
      setDatabaseSyncSettings({
        tursoDatabaseUrl: settings.tursoDatabaseUrl || "",
        tursoAuthToken: settings.tursoAuthToken || "",
      });
    }
  }, [settings, isLoading]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/settings", {
        gymName: gymInfo.name,
        gymAddress: gymInfo.address,
        gymPhone: gymInfo.phone,
        gymEmail: gymInfo.email,
        gymGstNumber: gymInfo.gstNumber,
        weekdayOpen: operatingHours.weekdayOpen,
        weekdayClose: operatingHours.weekdayClose,
        weekendOpen: operatingHours.weekendOpen,
        weekendClose: operatingHours.weekendClose,
        gpsEnabled: gpsSettings.enabled,
        gpsLatitude: gpsSettings.latitude,
        gpsLongitude: gpsSettings.longitude,
        gpsRadius: gpsSettings.radius,
        razorpayKey: paymentSettings.razorpayKey,
        stripeKey: paymentSettings.stripeKey,
        taxRate: paymentSettings.taxRate,
        tursoDatabaseUrl: databaseSyncSettings.tursoDatabaseUrl,
        tursoAuthToken: databaseSyncSettings.tursoAuthToken,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings saved",
        description: "Your settings have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveBiometricSettings = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/biometric/settings", biometricSettings);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/biometric/settings"] });
      toast({
        title: "Biometric settings saved",
        description: "Biometric device settings have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save biometric settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const syncPull = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sync/pull", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sync successful",
        description: `Pulled ${Object.values(data.counts || {}).reduce((a: number, b: number) => a + b, 0)} records from online database.`,
      });
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error?.message || "Failed to sync from online database. Check your credentials.",
        variant: "destructive",
      });
    },
  });

  const syncPush = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sync/push", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sync successful",
        description: `Pushed ${Object.values(data.counts || {}).reduce((a: number, b: number) => a + b, 0)} records to online database.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error?.message || "Failed to sync to online database. Check your credentials.",
        variant: "destructive",
      });
    },
  });

  const syncFull = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sync/full", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sync successful",
        description: `Bidirectional sync completed. Merged ${Object.values(data.counts || {}).reduce((a: number, b: number) => a + b, 0)} records.`,
      });
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error?.message || "Failed to perform bidirectional sync. Check your credentials.",
        variant: "destructive",
      });
    },
  });

  const testBiometricConnection = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/biometric/test-connection", {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.connected) {
        toast({
          title: "Connection successful",
          description: `Successfully connected to device at ${biometricSettings.ip}:${biometricSettings.port}`,
        });
      } else {
        toast({
          title: "Connection failed",
          description: data.error || "Could not connect to biometric device",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Connection failed",
        description: error?.message || "Could not connect to biometric device",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your gym configuration and preferences</p>
        </div>
        <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending} data-testid="button-save-settings" className="min-w-[140px]">
          {saveSettings.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            <CardTitle>Gym Information</CardTitle>
          </div>
          <CardDescription>Basic information about your gym facility</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gym-name">Gym Name</Label>
              <Input
                id="gym-name"
                value={gymInfo.name}
                onChange={(e) => setGymInfo({ ...gymInfo, name: e.target.value })}
                data-testid="input-gym-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={gymInfo.phone}
                onChange={(e) => setGymInfo({ ...gymInfo, phone: e.target.value })}
                data-testid="input-phone"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={gymInfo.address}
              onChange={(e) => setGymInfo({ ...gymInfo, address: e.target.value })}
              data-testid="input-address"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={gymInfo.email}
                onChange={(e) => setGymInfo({ ...gymInfo, email: e.target.value })}
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gst">GST Number</Label>
              <Input
                id="gst"
                value={gymInfo.gstNumber}
                onChange={(e) => setGymInfo({ ...gymInfo, gstNumber: e.target.value })}
                data-testid="input-gst"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <CardTitle>Operating Hours</CardTitle>
          </div>
          <CardDescription>Set your gym's operating hours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-3">Weekdays (Mon - Fri)</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="weekday-open">Opening Time</Label>
                <Input
                  id="weekday-open"
                  type="time"
                  value={operatingHours.weekdayOpen}
                  onChange={(e) =>
                    setOperatingHours({ ...operatingHours, weekdayOpen: e.target.value })
                  }
                  data-testid="input-weekday-open"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weekday-close">Closing Time</Label>
                <Input
                  id="weekday-close"
                  type="time"
                  value={operatingHours.weekdayClose}
                  onChange={(e) =>
                    setOperatingHours({ ...operatingHours, weekdayClose: e.target.value })
                  }
                  data-testid="input-weekday-close"
                />
              </div>
            </div>
          </div>
          <Separator />
          <div>
            <h4 className="font-medium mb-3">Weekend (Sat - Sun)</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="weekend-open">Opening Time</Label>
                <Input
                  id="weekend-open"
                  type="time"
                  value={operatingHours.weekendOpen}
                  onChange={(e) =>
                    setOperatingHours({ ...operatingHours, weekendOpen: e.target.value })
                  }
                  data-testid="input-weekend-open"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weekend-close">Closing Time</Label>
                <Input
                  id="weekend-close"
                  type="time"
                  value={operatingHours.weekendClose}
                  onChange={(e) =>
                    setOperatingHours({ ...operatingHours, weekendClose: e.target.value })
                  }
                  data-testid="input-weekend-close"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            <CardTitle>GPS Attendance Settings</CardTitle>
          </div>
          <CardDescription>Configure location-based attendance verification</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable GPS Verification</Label>
              <p className="text-sm text-muted-foreground">
                Require members to be within gym location to mark attendance
              </p>
            </div>
            <Switch
              checked={gpsSettings.enabled}
              onCheckedChange={(checked) =>
                setGpsSettings({ ...gpsSettings, enabled: checked })
              }
              data-testid="switch-gps-enabled"
            />
          </div>
          {gpsSettings.enabled && (
            <>
              <Separator />
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Gym Latitude</Label>
                  <Input
                    id="latitude"
                    placeholder="19.0760"
                    value={gpsSettings.latitude}
                    onChange={(e) =>
                      setGpsSettings({ ...gpsSettings, latitude: e.target.value })
                    }
                    data-testid="input-latitude"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">Gym Longitude</Label>
                  <Input
                    id="longitude"
                    placeholder="72.8777"
                    value={gpsSettings.longitude}
                    onChange={(e) =>
                      setGpsSettings({ ...gpsSettings, longitude: e.target.value })
                    }
                    data-testid="input-longitude"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="radius">Allowed Radius (meters)</Label>
                  <Input
                    id="radius"
                    type="number"
                    placeholder="100"
                    value={gpsSettings.radius}
                    onChange={(e) =>
                      setGpsSettings({ ...gpsSettings, radius: e.target.value })
                    }
                    data-testid="input-radius"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Members must be within {gpsSettings.radius}m of the gym location to mark attendance
              </p>
            </>
          )}
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            <CardTitle>Payment Gateway</CardTitle>
          </div>
          <CardDescription>Configure payment processing settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="razorpay-key">Razorpay API Key</Label>
            <Input
              id="razorpay-key"
              type="password"
              value={paymentSettings.razorpayKey}
              onChange={(e) =>
                setPaymentSettings({ ...paymentSettings, razorpayKey: e.target.value })
              }
              data-testid="input-razorpay-key"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stripe-key">Stripe API Key</Label>
            <Input
              id="stripe-key"
              type="password"
              value={paymentSettings.stripeKey}
              onChange={(e) =>
                setPaymentSettings({ ...paymentSettings, stripeKey: e.target.value })
              }
              data-testid="input-stripe-key"
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="tax-rate">Tax Rate (%)</Label>
            <Input
              id="tax-rate"
              type="number"
              placeholder="18"
              value={paymentSettings.taxRate}
              onChange={(e) =>
                setPaymentSettings({ ...paymentSettings, taxRate: e.target.value })
              }
              data-testid="input-tax-rate"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>User Roles & Permissions</CardTitle>
          </div>
          <CardDescription>Manage access levels for staff members</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { role: "Admin", description: "Full access to all features", count: 2 },
              { role: "Receptionist", description: "Member check-in and payment processing", count: 3 },
              { role: "Trainer", description: "Class management and member tracking", count: 5 },
            ].map((role) => (
              <div
                key={role.role}
                className="flex items-center justify-between p-4 border rounded-md"
              >
                <div>
                  <div className="font-medium">{role.role}</div>
                  <div className="text-sm text-muted-foreground">{role.description}</div>
                </div>
                <div className="text-sm text-muted-foreground">{role.count} users</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            <CardTitle>Biometric Device Settings</CardTitle>
          </div>
          <CardDescription>Configure your eSSL K30 Pro biometric fingerprint attendance machine</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="biometric-ip">Device IP Address</Label>
              <Input
                id="biometric-ip"
                placeholder="192.168.1.100"
                value={biometricSettings.ip}
                onChange={(e) =>
                  setBiometricSettings({ ...biometricSettings, ip: e.target.value })
                }
                data-testid="input-biometric-ip"
              />
              <p className="text-xs text-muted-foreground">
                IP address of the biometric device (find in device Menu → Comm/Network → TCP/IP)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="biometric-port">Port</Label>
              <Input
                id="biometric-port"
                placeholder="4370"
                value={biometricSettings.port}
                onChange={(e) =>
                  setBiometricSettings({ ...biometricSettings, port: e.target.value })
                }
                data-testid="input-biometric-port"
              />
              <p className="text-xs text-muted-foreground">Default: 4370</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="biometric-comm-key">Comm Key / Device Password</Label>
            <Input
              id="biometric-comm-key"
              type="password"
              placeholder="0 (default) or your device password"
              value={biometricSettings.commKey}
              onChange={(e) =>
                setBiometricSettings({ ...biometricSettings, commKey: e.target.value })
              }
              data-testid="input-biometric-comm-key"
            />
            <p className="text-xs text-muted-foreground">
              Communication key/password (find in device Menu → Comm → Comm Key). Leave empty if not set.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="biometric-unlock-seconds">Door Unlock Duration (seconds)</Label>
              <Input
                id="biometric-unlock-seconds"
                type="number"
                placeholder="3"
                value={biometricSettings.unlockSeconds}
                onChange={(e) =>
                  setBiometricSettings({ ...biometricSettings, unlockSeconds: e.target.value })
                }
                data-testid="input-biometric-unlock-seconds"
              />
              <p className="text-xs text-muted-foreground">How long the door should stay unlocked (default: 3 seconds)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="biometric-relay-type">Relay Type</Label>
              <Select
                value={biometricSettings.relayType}
                onValueChange={(value) =>
                  setBiometricSettings({ ...biometricSettings, relayType: value })
                }
              >
                <SelectTrigger id="biometric-relay-type" data-testid="select-biometric-relay-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NO">Normally Open (NO)</SelectItem>
                  <SelectItem value="NC">Normally Closed (NC)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Door relay wiring type (NO = Normally Open, NC = Normally Closed)</p>
            </div>
          </div>
          <Separator />
          <div className="flex gap-2">
            <Button
              onClick={() => saveBiometricSettings.mutate()}
              disabled={saveBiometricSettings.isPending}
              variant="default"
            >
              {saveBiometricSettings.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Biometric Settings
                </>
              )}
            </Button>
            <Button
              onClick={() => testBiometricConnection.mutate()}
              disabled={testBiometricConnection.isPending || !biometricSettings.ip}
              variant="outline"
            >
              {testBiometricConnection.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>
          </div>
          <Separator />
          <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <p className="text-sm font-medium">Test Scan Detection</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter a User ID below, then scan that User ID on the device. The system will detect and show if it matches.
            </p>
            <div className="space-y-2">
              <Label htmlFor="test-user-id">Test User ID</Label>
              <Input
                id="test-user-id"
                placeholder="e.g., 41"
                value={testUserId}
                onChange={(e) => setTestUserId(e.target.value)}
                className="max-w-xs"
              />
            </div>
            {testUserId && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  {lastScannedId ? (
                    <>
                      {lastScannedId === testUserId || lastScannedId == testUserId ? (
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="font-medium">✅ TEST OK - Match Detected!</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                          <XCircle className="h-4 w-4" />
                          <span className="font-medium">
                            ⚠️ Scanned ID: {lastScannedId} (Expected: {testUserId})
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Waiting for scan...</span>
                  )}
                </div>
                {lastScannedId && lastScanTime && (
                  <div className="text-xs text-muted-foreground">
                    Last scan: {lastScanTime.toLocaleTimeString()} - User ID: {lastScannedId}
                  </div>
                )}
                {!lastScannedId && (
                  <div className="text-xs text-muted-foreground italic">
                    💡 Scan the fingerprint/card for User ID "{testUserId}" on the device now...
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="p-4 bg-muted rounded-md">
            <p className="text-sm font-medium mb-2">Access Control Rules:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Member status must be "active"</li>
              <li>Current date must be within membership start and expiry dates</li>
              <li>Payment status must not be "pending" or "overdue"</li>
              <li>If all conditions are met, door will unlock automatically</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <CardTitle>Database Sync (Online/Offline)</CardTitle>
          </div>
          <CardDescription>
            Configure sync between desktop app and web app. Both use the same Turso database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="turso-database-url">Turso Database URL</Label>
            <Input
              id="turso-database-url"
              placeholder="libsql://your-database.aws-ap-south-1.turso.io"
              value={databaseSyncSettings.tursoDatabaseUrl}
              onChange={(e) =>
                setDatabaseSyncSettings({ ...databaseSyncSettings, tursoDatabaseUrl: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Your Turso database URL (from Turso dashboard). Example: libsql://gym-management.aws-ap-south-1.turso.io
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="turso-auth-token">Turso Auth Token</Label>
            <Input
              id="turso-auth-token"
              type="password"
              placeholder="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9..."
              value={databaseSyncSettings.tursoAuthToken}
              onChange={(e) =>
                setDatabaseSyncSettings({ ...databaseSyncSettings, tursoAuthToken: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Your Turso authentication token (from Turso dashboard). Keep this secure!
            </p>
          </div>
          <Separator />
          <div className="space-y-3">
            <p className="text-sm font-medium">Sync Operations</p>
            <div className="grid gap-2 md:grid-cols-3">
              <Button
                onClick={() => syncPull.mutate()}
                disabled={syncPull.isPending || !databaseSyncSettings.tursoDatabaseUrl || !databaseSyncSettings.tursoAuthToken}
                variant="outline"
                className="w-full"
              >
                {syncPull.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Pull from Online
                  </>
                )}
              </Button>
              <Button
                onClick={() => syncPush.mutate()}
                disabled={syncPush.isPending || !databaseSyncSettings.tursoDatabaseUrl || !databaseSyncSettings.tursoAuthToken}
                variant="outline"
                className="w-full"
              >
                {syncPush.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Push to Online
                  </>
                )}
              </Button>
              <Button
                onClick={() => syncFull.mutate()}
                disabled={syncFull.isPending || !databaseSyncSettings.tursoDatabaseUrl || !databaseSyncSettings.tursoAuthToken}
                variant="default"
                className="w-full"
              >
                {syncFull.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="h-4 w-4 mr-2" />
                    Full Sync
                  </>
                )}
              </Button>
            </div>
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm font-medium mb-2">How Sync Works:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><strong>Pull from Online:</strong> Downloads data from web app (Turso) to desktop app</li>
                <li><strong>Push to Online:</strong> Uploads data from desktop app to web app (Turso)</li>
                <li><strong>Full Sync:</strong> Merges both databases (Turso takes precedence on conflicts)</li>
                <li>Desktop app works offline. Sync when you need to share data with web app.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
