export interface TranscriptEvent {
  speaker: "ai" | "patient";
  text: string;
  timestamp_ms: number;
}

export interface ConsultationSocketCallbacks {
  onOpen?: () => void;
  onTranscript?: (turn: TranscriptEvent) => void;
  onAudio?: (base64Data: string) => void;
  onEmergency?: (message: string) => void;
  onEnded?: (consultationId: string) => void;
  onError?: () => void;
}

export class ConsultationSocket {
  private ws: WebSocket;

  constructor(
    apiBaseUrl: string,
    consultationId: string,
    callbacks: ConsultationSocketCallbacks = {}
  ) {
    const wsUrl = apiBaseUrl
      .replace(/^https:\/\//, "wss://")
      .replace(/^http:\/\//, "ws://");

    this.ws = new WebSocket(
      `${wsUrl}/api/v1/consultations/${consultationId}/stream`
    );

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
    this.ws.send(JSON.stringify({ type: "audio", data: base64Data }));
  }

  endSession(): void {
    this.ws.send(JSON.stringify({ type: "end" }));
  }

  disconnect(): void {
    this.ws.close();
  }
}
