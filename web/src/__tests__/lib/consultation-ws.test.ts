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
  // jsdom sets window.location to http://localhost/ by default
});

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

describe("ConsultationSocket", () => {
  it("connects using ws:// when page is served over http", () => {
    new ConsultationSocket("consult-id-123", "test-token");
    const { url } = MockWebSocket.instances[0];
    // jsdom runs on window.location.host which includes the port
    expect(url).toMatch(/^ws:\/\/localhost(:\d+)?\/api\/v1\/consultations\/consult-id-123\/stream\?token=test-token$/);
  });

  it("includes wsToken as query param", () => {
    new ConsultationSocket("abc", "my-secret-token");
    expect(MockWebSocket.instances[0].url).toContain("token=my-secret-token");
  });

  it("URL-encodes the token", () => {
    new ConsultationSocket("abc", "token with spaces");
    // encodeURIComponent encodes spaces as %20
    expect(MockWebSocket.instances[0].url).toContain("token=token%20with%20spaces");
  });

  it("calls onOpen callback when connection established", () => {
    const onOpen = vi.fn();
    new ConsultationSocket("c1", "tok", { onOpen });
    MockWebSocket.instances[0].simulateOpen();
    expect(onOpen).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Sending audio
// ---------------------------------------------------------------------------

describe("sendAudio", () => {
  it("sends a JSON message with type 'audio' and base64 data", () => {
    const sock = new ConsultationSocket("c1", "tok");
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
    const sock = new ConsultationSocket("c1", "tok");
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
    new ConsultationSocket("c1", "tok", { onTranscript });
    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage({ type: "transcript", speaker: "patient", text: "I feel sick", timestamp_ms: 1234 });
    expect(onTranscript).toHaveBeenCalledWith({ speaker: "patient", text: "I feel sick", timestamp_ms: 1234 });
  });
});

describe("onAudio callback", () => {
  it("is called with base64 data on audio messages", () => {
    const onAudio = vi.fn();
    new ConsultationSocket("c1", "tok", { onAudio });
    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage({ type: "audio", data: "audiodata==" });
    expect(onAudio).toHaveBeenCalledWith("audiodata==");
  });
});

describe("onEmergency callback", () => {
  it("is called with the message text on emergency messages", () => {
    const onEmergency = vi.fn();
    new ConsultationSocket("c1", "tok", { onEmergency });
    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage({ type: "emergency", message: "Call 000 immediately" });
    expect(onEmergency).toHaveBeenCalledWith("Call 000 immediately");
  });
});

describe("onEnded callback", () => {
  it("is called when server sends ended message", () => {
    const onEnded = vi.fn();
    new ConsultationSocket("c1", "tok", { onEnded });
    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    ws.simulateMessage({ type: "ended", consultationId: "c1" });
    expect(onEnded).toHaveBeenCalledWith("c1");
  });
});

describe("onError callback", () => {
  it("is called on WebSocket error", () => {
    const onError = vi.fn();
    new ConsultationSocket("c1", "tok", { onError });
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
    const sock = new ConsultationSocket("c1", "tok");
    const ws = MockWebSocket.instances[0];
    ws.simulateOpen();
    sock.disconnect();
    expect(ws.readyState).toBe(3); // CLOSED
  });
});
