import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, CheckCircle, AlertCircle, LogIn, Dumbbell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function UserAttendance() {
  const { toast } = useToast();
  const [loginCode, setLoginCode] = useState("");
  const [storedLoginCode, setStoredLoginCode] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMarkedToday, setHasMarkedToday] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState("");

  const [memberInfo, setMemberInfo] = useState({
    name: "",
    planName: "",
    expiryDate: new Date(),
    lastCheckIn: null as Date | null,
  });

  useEffect(() => {
    if (isLoggedIn) {
      getCurrentLocation();
    }
  }, [isLoggedIn]);

  const getCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationError("");
        },
        (error) => {
          setLocationError("Unable to get your location. Please enable GPS.");
          console.error("Location error:", error);
        }
      );
    } else {
      setLocationError("Geolocation is not supported by your device.");
    }
  };

  const handleLogin = async () => {
    if (!loginCode.trim()) {
      toast({
        title: "Login Code Required",
        description: "Please enter your login code",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/members/login/${loginCode.trim()}`);
      if (!response.ok) {
        throw new Error("Member not found");
      }
      const member = await response.json();
      setMemberInfo({
        name: member.name,
        planName: member.planName || "",
        expiryDate: member.expiryDate ? new Date(member.expiryDate) : new Date(),
        lastCheckIn: member.lastCheckIn ? new Date(member.lastCheckIn) : null,
      });
      setIsLoggedIn(true);
      setStoredLoginCode(loginCode.trim());
      toast({
        title: "Login Successful",
        description: `Welcome back, ${member.name}!`,
      });
    } catch (err) {
      toast({
        title: "Login Failed",
        description: "Invalid login code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoginCode("");
    setStoredLoginCode("");
    setMemberInfo({ name: "", planName: "", expiryDate: new Date(), lastCheckIn: null });
    setHasMarkedToday(false);
    setLocation(null);
  };


  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const handleMarkAttendance = async () => {
    if (!location) {
      toast({
        title: "Location Required",
        description: "Please enable GPS to mark attendance",
        variant: "destructive",
      });
      return;
    }

    // Get gym coordinates from settings
    setIsLoading(true);
    try {
      const settingsRes = await fetch("/api/settings");
      const settings = settingsRes.ok ? await settingsRes.json() : {};
      const gymLat = parseFloat(settings.gpsLatitude || "19.076");
      const gymLng = parseFloat(settings.gpsLongitude || "72.8777");
      const allowedRadius = parseInt(settings.gpsRadius || "100");

      if (settings.gpsEnabled && location) {
        const distance = calculateDistance(location.lat, location.lng, gymLat, gymLng);
        if (distance > allowedRadius) {
          toast({
            title: "Out of Range",
            description: `You must be within ${allowedRadius}m of the gym. You are ${Math.round(distance)}m away.`,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }

      // Find member ID from login code (use stored code)
      const codeToUse = storedLoginCode || loginCode.trim();
      const memberRes = await fetch(`/api/members/login/${codeToUse}`);
      if (!memberRes.ok) throw new Error("Member not found");
      const member = await memberRes.json();

      // Mark attendance via API
      const attendanceRes = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: member.id,
          markedVia: "gps",
          latitude: location?.lat || null,
          longitude: location?.lng || null,
        }),
      });

      if (!attendanceRes.ok) throw new Error("Failed to mark attendance");

      setHasMarkedToday(true);
      setMemberInfo({
        ...memberInfo,
        lastCheckIn: new Date(),
      });
      toast({
        title: "Attendance Marked!",
        description: "Your attendance has been recorded successfully.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to mark attendance. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
                <Dumbbell className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl">Member Attendance</CardTitle>
            <CardDescription>Enter your unique login code to mark attendance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-code">Login Code</Label>
              <Input
                id="login-code"
                placeholder="Enter your 6-digit code"
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                data-testid="input-login-code"
                className="text-center text-lg font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Your login code is provided by the gym reception
              </p>
            </div>
            <Button
              className="w-full"
              onClick={handleLogin}
              disabled={isLoading}
              data-testid="button-login"
            >
              <LogIn className="h-4 w-4 mr-2" />
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-background">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Welcome, {memberInfo.name}!</CardTitle>
                <CardDescription>{memberInfo.planName}</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsLoggedIn(false);
                  setLoginCode("");
                }}
                data-testid="button-logout"
              >
                Logout
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Membership Valid Until</p>
                <p className="font-medium">{format(memberInfo.expiryDate, "MMMM dd, yyyy")}</p>
              </div>
              {memberInfo.lastCheckIn && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Last Check-in</p>
                  <p className="font-medium">{format(memberInfo.lastCheckIn, "MMM dd, yyyy HH:mm")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mark Today's Attendance</CardTitle>
            <CardDescription>
              {format(new Date(), "EEEE, MMMM dd, yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {locationError ? (
              <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive rounded-md">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Location Error</p>
                  <p className="text-sm text-muted-foreground">{locationError}</p>
                </div>
              </div>
            ) : location ? (
              <div className="flex items-center gap-2 p-4 bg-chart-3/10 border border-chart-3 rounded-md">
                <MapPin className="h-5 w-5 text-chart-3" />
                <div>
                  <p className="font-medium text-chart-3">Location Detected</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-4 bg-muted border rounded-md">
                <Clock className="h-5 w-5 text-muted-foreground animate-spin" />
                <p className="text-sm text-muted-foreground">Getting your location...</p>
              </div>
            )}

            {hasMarkedToday ? (
              <div className="flex items-center justify-center gap-2 p-6 bg-chart-3/10 border border-chart-3 rounded-md">
                <CheckCircle className="h-6 w-6 text-chart-3" />
                <div>
                  <p className="font-semibold text-chart-3">Attendance Marked!</p>
                  <p className="text-sm text-muted-foreground">You've already checked in today</p>
                </div>
              </div>
            ) : (
              <Button
                className="w-full h-16 text-lg"
                onClick={handleMarkAttendance}
                disabled={isLoading || !location || hasMarkedToday}
                data-testid="button-mark-attendance"
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                {isLoading ? "Marking Attendance..." : "Mark Attendance"}
              </Button>
            )}

            <div className="space-y-2 pt-4">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> You can mark attendance only once per day. Make sure you are within the gym premises.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { date: new Date(2025, 9, 29), time: "18:30" },
                { date: new Date(2025, 9, 27), time: "07:15" },
                { date: new Date(2025, 9, 25), time: "18:45" },
              ].map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-chart-3" />
                    <span className="text-sm">{format(activity.date, "EEEE, MMM dd")}</span>
                  </div>
                  <Badge variant="secondary">{activity.time}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
