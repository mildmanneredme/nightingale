export type WsClientMessage =
  | { type: "audio"; data: string }
  | { type: "end"; reason?: string };

export type WsServerMessage =
  | { type: "audio"; data: string }
  | { type: "interrupted" }
  | { type: "transcript"; speaker: "ai" | "patient"; text: string; timestamp_ms: number }
  | { type: "red_flag"; phrase: string }
  | { type: "emergency"; message: string }
  | { type: "ended"; consultationId: string }
  | { type: "error"; message: string };
