import { WsClientMessage, WsServerMessage } from "@/types/ws-messages";

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
    callbacks: ConsultationSocketCallbacks = {},
    jwtToken?: string
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
    // Browser WebSocket cannot send custom headers, so the Cognito JWT is passed
    // via ?auth= for server-side validation. The ws_token remains the primary
    // single-use credential; ?auth= adds defence-in-depth session binding.
    const authParam = jwtToken ? `&auth=${encodeURIComponent(jwtToken)}` : "";
    const url = `${wsBase}/api/v1/consultations/${consultationId}/stream?token=${encodeURIComponent(wsToken)}${authParam}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => callbacks.onOpen?.();

    this.ws.onmessage = (event) => {
      let msg: WsServerMessage;
      try {
        msg = JSON.parse(event.data as string) as WsServerMessage;
      } catch {
        return;
      }

      switch (msg.type) {
        case "transcript":
          callbacks.onTranscript?.({
            speaker: msg.speaker,
            text: msg.text,
            timestamp_ms: msg.timestamp_ms,
          });
          break;
        case "audio":
          callbacks.onAudio?.(msg.data);
          break;
        case "interrupted":
          callbacks.onInterrupted?.();
          break;
        case "emergency":
          callbacks.onEmergency?.(msg.message);
          break;
        case "ended":
          callbacks.onEnded?.(msg.consultationId);
          break;
        case "red_flag":
          break;
        case "error":
          callbacks.onError?.();
          break;
        default: {
          const _exhaustive: never = msg;
          throw new Error(`Unhandled server message type: ${JSON.stringify(_exhaustive)}`);
        }
      }
    };

    this.ws.onerror = () => callbacks.onError?.();
  }

  sendAudio(base64Data: string): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      const msg: WsClientMessage = { type: "audio", data: base64Data };
      this.ws.send(JSON.stringify(msg));
    }
  }

  endSession(): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      const msg: WsClientMessage = { type: "end" };
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect(): void {
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close();
    }
  }
}
