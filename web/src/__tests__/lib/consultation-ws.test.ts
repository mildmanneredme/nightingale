import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConsultationSocket } from "@/lib/consultation-ws";

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  readyState = 0; // CONNECTING
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: (() => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.();
  }

  // Test helpers to simulate server messages
  simulateOpen() {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  simulateMessage(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }

  simulateError() {
    this.onerror?.(new Event("error"));
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
});

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

describe("ConsultationSocket", () => {
  it("connects to the correct WebSocket URL", () => {
    new ConsultationSocket("http://localhost:8080", "consult-id-123");
    expect(MockWebSocket.instances[0].url).toBe(
      "ws://localhost:8080/api/v1/consultations/consult-id-123/stream"
    );
  });

  it("converts https to wss for the WebSocket URL", () => {
    new ConsultationSocket("https://api.nightingale.com.au", "abc");
    expect(MockWebSocket.instances[0].url).toMatch(/^wss:\/\//);
  });

  it("calls onOpen callback when connection established", () => {
    const onOpen = vi.fn();
    const sock = new ConsultationSocket("http://localhost:8080", "c1", { onOpen });
    MockWebSocket.instances[0].simulateOpen();
    expect(onOpen).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Sending audio
// ---------------------------------------------------------------------------

describe("sendAudio", () => {
  it("sends a JSON message with type 'audio' and base64 data", () => {
    const sock = new ConsultationSocket("http://localhost:8080", "c1");
    MockWebSocket.instances[0].simulateOpen();
    sock.sendAudio("base64audiochunk==");
    const sent = JSON.parse(MockWebSocket.instances[0].sentMessages[0]);
    expect(sent).toEqual({ type: "audio", data: "base64audiochunk==" });
  });
});

// ---------------------------------------------------------------------------
// Ending session
// ---------------------------------------------------------------------------

describe("endSession", () => {
  it("sends { type: 'end' } message", () => {
    const sock = new ConsultationSocket("http://localhost:8080", "c1");
    MockWebSocket.instances[0].simulateOpen();
    sock.endSession();
    const sent = JSON.parse(MockWebSocket.instances[0].sentMessages[0]);
    expect(sent).toEqual({ type: "end" });
  });
});

// ---------------------------------------------------------------------------
// Receiving server messages
// ---------------------------------------------------------------------------

describe("onTranscript callback", () => {
  it("is called with speaker, text, and timestamp_ms on transcript messages", () => {
    const onTranscript = vi.fn();
    const sock = new ConsultationSocket("http://localhost:8080", "c1", { onTranscript });
    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage({ type: "transcript", speaker: "patient", text: "I feel sick", timestamp_ms: 1234 });
    expect(onTranscript).toHaveBeenCalledWith({ speaker: "patient", text: "I feel sick", timestamp_ms: 1234 });
  });
});

describe("onAudio callback", () => {
  it("is called with base64 data on audio messages", () => {
    const onAudio = vi.fn();
    const sock = new ConsultationSocket("http://localhost:8080", "c1", { onAudio });
    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage({ type: "audio", data: "audiodata==" });
    expect(onAudio).toHaveBeenCalledWith("audiodata==");
  });
});

describe("onEmergency callback", () => {
  it("is called with the message text on emergency messages", () => {
    const onEmergency = vi.fn();
    const sock = new ConsultationSocket("http://localhost:8080", "c1", { onEmergency });
    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage({ type: "emergency", message: "Call 000 immediately" });
    expect(onEmergency).toHaveBeenCalledWith("Call 000 immediately");
  });
});

describe("onEnded callback", () => {
  it("is called when server sends ended message", () => {
    const onEnded = vi.fn();
    const sock = new ConsultationSocket("http://localhost:8080", "c1", { onEnded });
    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage({ type: "ended", consultationId: "c1" });
    expect(onEnded).toHaveBeenCalledWith("c1");
  });
});

describe("onError callback", () => {
  it("is called on WebSocket error", () => {
    const onError = vi.fn();
    const sock = new ConsultationSocket("http://localhost:8080", "c1", { onError });
    const ws = MockWebSocket.instances[0];
    ws.simulateError();
    expect(onError).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// disconnect
// ---------------------------------------------------------------------------

describe("disconnect", () => {
  it("closes the WebSocket", () => {
    const sock = new ConsultationSocket("http://localhost:8080", "c1");
    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    sock.disconnect();
    expect(ws.readyState).toBe(3); // CLOSED
  });
});
