import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, WifiOff, RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

type Props = { children: React.ReactNode };

export default function WhatsAppGate({ children }: Props) {
  const [hadNetworkError, setHadNetworkError] = useState(false);

  const { data: status, refetch, isFetching, error } = useQuery({
    queryKey: ["/api/whatsapp/status"],
    queryFn: getQueryFn({ on401: "throw" }),
    refetchInterval: 60000,
  });

  const isConnected = status?.connected === true;
  const qrValue = status?.qr as string | undefined;

  useEffect(() => {
    setHadNetworkError(Boolean(error));
  }, [error]);

  // Auto-init QR generation if disconnected and no QR yet
  useEffect(() => {
    const shouldInit = !isConnected && !qrValue && !isFetching && !hadNetworkError;
    if (!shouldInit) return;
    apiRequest("POST", "/api/whatsapp/connect", {}).catch(() => {
      // ignore; gate will keep polling
    });
  }, [isConnected, qrValue, isFetching, hadNetworkError]);

  const content = useMemo(() => {
    if (isConnected) return children;

    if (hadNetworkError) {
      return (
        <div className="h-screen w-screen flex items-center justify-center p-6">
          <Card className="max-w-lg w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WifiOff className="h-5 w-5" />
                Internet Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Please connect this device to the internet. The app will become available once online.
              </p>
              <Button variant="default" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="h-screen w-screen flex items-center justify-center p-6">
        <Card className="max-w-xl w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Connect WhatsApp to Continue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {qrValue ? (
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-white rounded-lg border">
                  <QRCodeSVG value={qrValue} size={256} level="H" includeMargin={true} />
                </div>
                <div className="text-sm text-muted-foreground text-center">
                  Open WhatsApp → Linked Devices → Link a Device → Scan this QR.
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Generating QR code… QR won’t auto-refresh for 1 minute. If it expires, click Refresh.
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={() => apiRequest("POST", "/api/whatsapp/connect", {}).then(() => refetch())} disabled={isFetching}>
                <QrCode className="h-4 w-4 mr-2" />
                {isFetching ? "Waiting…" : "Generate QR"}
              </Button>
              <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }, [children, hadNetworkError, isConnected, isFetching, qrValue, refetch]);

  return <>{content}</>;
}


