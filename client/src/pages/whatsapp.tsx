import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MessageSquare, Send, Eye, CheckCircle2, XCircle, QrCode, Power, PowerOff } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function WhatsApp() {
  const { toast } = useToast();
  const [template, setTemplate] = useState(
    "Hi {name}, your {plan} expires in {daysLeft} days!"
  );
  const [sendTarget, setSendTarget] = useState<"pending" | "all">("pending");
  const [sendResults, setSendResults] = useState<{
    sent: number;
    failed: number;
    failedMembers: Array<{ memberId: string; phone: string; status: string }>;
  } | null>(null);

  // Get WhatsApp connection status
  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ["/api/whatsapp/status"],
    queryFn: getQueryFn({ on401: "throw" }),
    refetchInterval: 60000, // Poll every 60 seconds to avoid frequent QR refresh
  });

  const isConnected = status?.connected === true;
  const [previousConnected, setPreviousConnected] = useState<boolean | null>(null);

  // Track connection status changes for toast notifications
  useEffect(() => {
    if (previousConnected === null) {
      setPreviousConnected(isConnected);
      return;
    }

    if (!previousConnected && isConnected) {
      // Just connected
      toast({
        title: "WhatsApp Connected! ✅",
        description: "Successfully connected to WhatsApp. You can now send messages.",
      });
      setPreviousConnected(true);
    } else if (previousConnected && !isConnected) {
      // Just disconnected
      toast({
        title: "WhatsApp Disconnected",
        description: "WhatsApp connection has been lost.",
        variant: "destructive",
      });
      setPreviousConnected(false);
    } else {
      setPreviousConnected(isConnected);
    }
  }, [isConnected, previousConnected, toast]);

  // Connect/Generate QR mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/whatsapp/connect", {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Generating QR Code...",
        description: "Please wait for the QR code to appear.",
      });
      // Refetch status after a short delay
      setTimeout(() => refetchStatus(), 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Connection failed",
        description: error?.message || "Failed to generate QR code",
        variant: "destructive",
      });
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/whatsapp/disconnect", {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "WhatsApp Disconnected",
        description: "WhatsApp has been disconnected successfully.",
      });
      refetchStatus();
    },
    onError: (error: any) => {
      toast({
        title: "Disconnect failed",
        description: error?.message || "Failed to disconnect WhatsApp",
        variant: "destructive",
      });
    },
  });

  // Preview template mutation
  const previewMutation = useMutation({
    mutationFn: async (template: string) => {
      const res = await apiRequest("POST", "/api/whatsapp/test-template", {
        template,
      });
      return res.json();
    },
    onError: (error: any) => {
      toast({
        title: "Preview failed",
        description: error?.message || "Failed to preview template",
        variant: "destructive",
      });
    },
  });

  // Send bulk messages mutation
  const sendBulkMutation = useMutation({
    mutationFn: async ({
      template,
      target,
    }: {
      template: string;
      target: "pending" | "all";
    }) => {
      const body: { template: string; allMembers?: boolean } = {
        template,
        allMembers: target === "all",
      };
      
      const res = await apiRequest("POST", "/api/whatsapp/send-bulk", body);
      return res.json();
    },
    onSuccess: (data) => {
      const results = data.results || [];
      const sent = results.filter((r: any) => r.status === "sent").length;
      const failed = results.filter((r: any) => r.status !== "sent").length;
      const failedMembers = results.filter((r: any) => r.status !== "sent");

      setSendResults({
        sent,
        failed,
        failedMembers,
      });

      toast({
        title: "Messages sent",
        description: `${sent} sent, ${failed} failed`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Send failed",
        description: error?.message || "Failed to send messages",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">WhatsApp Messaging</h1>
        <p className="text-muted-foreground">
          Send bulk messages to members via WhatsApp
        </p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {isConnected ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-lg font-medium">Connected ✅</span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="text-lg font-medium">Disconnected ❌</span>
              </>
            )}
            <div className="flex gap-2 ml-auto">
              {!isConnected && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => connectMutation.mutate()}
                  disabled={connectMutation.isPending}
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  {connectMutation.isPending ? "Generating..." : "Generate QR Code"}
                </Button>
              )}
              {isConnected && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                >
                  <PowerOff className="h-4 w-4 mr-2" />
                  {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchStatus()}
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* QR Code Display */}
          {!isConnected && status?.qr && (
            <div className="border rounded-lg p-6 bg-muted/50">
              <div className="flex flex-col items-center space-y-4">
                <div className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  <h3 className="font-semibold">Scan QR Code to Connect</h3>
                </div>
                <div className="p-4 bg-white rounded-lg border-2 border-primary/20">
                  <QRCodeSVG
                    value={status.qr}
                    size={256}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <div className="text-center space-y-2 max-w-md">
                  <p className="text-sm font-medium">Instructions:</p>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Open WhatsApp on your phone</li>
                    <li>Tap Menu (☰) or Settings</li>
                    <li>Tap Linked Devices</li>
                    <li>Tap Link a Device</li>
                    <li>Scan this QR code</li>
                  </ol>
                  <p className="text-xs text-muted-foreground mt-4">
                    QR will not auto-refresh for 1 minute. If it expires, click Refresh.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isConnected && !status?.qr && (
            <div className="text-center py-8 space-y-4">
              <div className="text-muted-foreground">
                <p className="text-lg font-medium">No QR Code Available</p>
                <p className="text-sm mt-2">Click "Generate QR Code" button to start connecting.</p>
              </div>
              <Button
                variant="default"
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
              >
                <QrCode className="h-4 w-4 mr-2" />
                {connectMutation.isPending ? "Generating..." : "Generate QR Code"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template Editor */}
      <Card>
        <CardHeader>
          <CardTitle>Message Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="template">Template</Label>
            <Textarea
              id="template"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={5}
              placeholder="Enter your message template..."
              className="mt-2"
            />
            <p className="text-sm text-muted-foreground mt-2">
              Available placeholders: <code>{`{name}`}</code>,{" "}
              <code>{`{plan}`}</code>, <code>{`{daysLeft}`}</code>
            </p>
          </div>
          <Button
            onClick={() => previewMutation.mutate(template)}
            disabled={previewMutation.isPending}
            variant="outline"
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>

          {/* Preview Results */}
          {previewMutation.data && (
            <div className="space-y-2 mt-4">
              <Label>Preview (3 sample members)</Label>
              <div className="grid gap-3">
                {previewMutation.data.samples?.map(
                  (
                    sample: { name: string; phone: string; preview: string },
                    index: number
                  ) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="space-y-1">
                          <div className="font-medium">{sample.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {sample.phone}
                          </div>
                          <div className="mt-2 p-2 bg-muted rounded text-sm">
                            {sample.preview}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Messages */}
      <Card>
        <CardHeader>
          <CardTitle>Send Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="target">Target</Label>
            <Select
              value={sendTarget}
              onValueChange={(value) =>
                setSendTarget(value as "pending" | "all")
              }
            >
              <SelectTrigger id="target" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">All Pending Payments</SelectItem>
                <SelectItem value="all">All Members</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-2">
              {sendTarget === "pending"
                ? "Sends to members with pending or overdue payment status"
                : "Sends to all members regardless of payment status"}
            </p>
          </div>

          <Button
            onClick={() => sendBulkMutation.mutate({ template, target: sendTarget })}
            disabled={!isConnected || sendBulkMutation.isPending || !template.trim()}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {sendBulkMutation.isPending ? "Sending..." : "Send Messages"}
          </Button>

          {!isConnected && (
            <p className="text-sm text-red-500">
              WhatsApp is not connected. Please connect first.
            </p>
          )}

          {/* Send Results */}
          {sendResults && (
            <div className="space-y-3 mt-4">
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>{sendResults.sent} sent</span>
                </div>
                <div className="flex items-center gap-1">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span>{sendResults.failed} failed</span>
                </div>
              </div>

              {sendResults.failedMembers.length > 0 && (
                <div>
                  <Label>Failed Members</Label>
                  <div className="space-y-2 mt-2">
                    {sendResults.failedMembers.map((failed, index) => (
                      <Card key={index}>
                        <CardContent className="p-3">
                          <div className="text-sm">
                            <div className="font-medium">
                              Member ID: {failed.memberId}
                            </div>
                            <div className="text-muted-foreground">
                              Phone: {failed.phone}
                            </div>
                            <div className="text-red-500 mt-1">
                              Status: {failed.status}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

