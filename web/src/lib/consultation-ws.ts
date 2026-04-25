export interface TranscriptEvent {
  speaker: "ai" | "patient";
  text: string;
  timestamp_ms: number;
}

export interface ConsultationSocketCallbacks {
  onOpen?: () => void;
  onTranscript?: (turn: TranscriptEvent) => void;
  onAudio?: (base64Data: string) => void;
  onInterrupted?: () => void;
  onEmergency?: (message: string) => void;
  onEnded?: (consultationId: string) => void;
  onError?: () => void;
}

export class ConsultationSocket {
  private ws: WebSocket;

  constructor(
    consultationId: string,
    wsToken: string,
    callbacks: ConsultationSocketCallbacks = {}
  ) {
    // NEXT_PUBLIC_WS_URL must point to a WSS-capable host (e.g. CloudFront domain).
    // Vercel rewrites are HTTP-only and cannot proxy WebSocket upgrade requests.
    const wsBase = (() => {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
      if (wsUrl) {
        return wsUrl.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://").replace(/\/$/, "");
      }
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${proto}//${window.location.host}`;
    })();
    const url = `${wsBase}/api/v1/consultations/${consultationId}/stream?token=${encodeURIComponent(wsToken)}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => callbacks.onOpen?.();

    this.ws.onmessage = (event) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }

      switch (msg.type) {
        case "transcript":
          callbacks.onTranscript?.({
            speaker: msg.speaker as "ai" | "patient",
            text: msg.text as string,
            timestamp_ms: msg.timestamp_ms as number,
          });
          break;
        case "audio":
          callbacks.onAudio?.(msg.data as string);
          break;
        case "interrupted":
          callbacks.onInterrupted?.();
          break;
        case "emergency":
          callbacks.onEmergency?.(msg.message as string);
          break;
        case "ended":
          callbacks.onEnded?.(msg.consultationId as string);
          break;
      }
    };

    this.ws.onerror = () => callbacks.onError?.();
  }

  sendAudio(base64Data: string): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "audio", data: base64Data }));
    }
  }

  endSession(): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "end" }));
    }
  }

  disconnect(): void {
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close();
    }
  }
}
