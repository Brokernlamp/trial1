import { QueryClient } from "@tanstack/react-query";

type EventMessage = { type: string; payload: unknown };

export function useRealtimeInvalidation(queryClient: QueryClient) {
  if (typeof window === "undefined") return;
  // Disable SSE on serverless platforms (Netlify) unless explicitly enabled
  if (import.meta.env.VITE_ENABLE_SSE !== "true") return;

  // Avoid multiple EventSources if hot reloading
  const w = window as any;
  if (w.__eventSource) return;

  const source = new EventSource("/api/events");
  w.__eventSource = source;

  source.onmessage = (evt) => {
    try {
      const data = JSON.parse(evt.data) as EventMessage;
      switch (true) {
        case data.type.startsWith("member."):
          queryClient.invalidateQueries({ queryKey: ["/api/members"] });
          break;
        case data.type.startsWith("payment."):
          queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
          break;
        case data.type.startsWith("equipment."):
          queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
          break;
        case data.type.startsWith("attendance."):
          queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
          break;
      }
    } catch {
      // ignore malformed frames
    }
  };

  source.onerror = () => {
    // auto-reconnect by closing and letting next call recreate
    try { source.close(); } catch {}
    w.__eventSource = undefined;
  };
}


