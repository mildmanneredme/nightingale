// SEC-002: HTML injection escaping in email templates
//
// Pure unit tests — no DB required. Verifies that user-supplied doctor content
// (customMessage, reviewNote) is HTML-escaped before interpolation in patient emails.

import he from "he";

jest.mock("@sendgrid/mail", () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([
    { statusCode: 202, headers: { "x-message-id": "escape-test-001" } },
    {},
  ]),
}));

jest.mock("../db", () => ({
  pool: { query: jest.fn() },
}));

// Provide a non-empty API key so dispatchEmail doesn't skip the send
jest.mock("../config", () => ({
  config: {
    sendgrid: {
      apiKey: "SG.fake-test-key",
      fromEmail: "no-reply@nightingale.com.au",
      fromName: "Nightingale Health",
    },
    app: { baseUrl: "https://nightingale.com.au" },
  },
}));

const mockSend = jest.requireMock("@sendgrid/mail").send as jest.Mock;
const mockPoolQuery = jest.requireMock("../db").pool.query as jest.Mock;

const SCRIPT_INJECTION = '<script>alert("xss")</script>';
const LINK_INJECTION = '<a href="https://evil.example">Click here</a>';

// Default follow-up mock: insertNotification INSERT returns a row, audit INSERTs return empty
function setupQueryMock(dataRows: object[]) {
  mockPoolQuery
    .mockResolvedValueOnce({ rows: dataRows })            // data fetch
    .mockResolvedValueOnce({ rows: [{ id: "notif-001" }] }) // insertNotification
    .mockResolvedValue({ rows: [] });                      // audit log INSERT(s)
}

describe("SEC-002: HTML injection escaping — he library", () => {
  it("escapes script tags", () => {
    const escaped = he.escape(SCRIPT_INJECTION);
    expect(escaped).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    expect(escaped).not.toContain("<script>");
  });

  it("escapes anchor injection", () => {
    const escaped = he.escape(LINK_INJECTION);
    expect(escaped).not.toContain("<a ");
    expect(escaped).toContain("&lt;a ");
  });

  it("escapes ampersands and quotes", () => {
    const input = 'Say "Hello" & <goodbye>';
    const escaped = he.escape(input);
    expect(escaped).toBe("Say &quot;Hello&quot; &amp; &lt;goodbye&gt;");
  });
});

describe("SEC-002: sendRejectionEmail HTML-escapes rejection_message", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders escaped HTML when rejection_message contains script tags", async () => {
    setupQueryMock([
      {
        patient_email: "patient@example.com",
        patient_name: "Jane Patient",
        rejection_message: SCRIPT_INJECTION,
        patient_id: "patient-uuid-001",
      },
    ]);

    const { sendRejectionEmail } = await import("../services/emailService");
    const { pool: mockPool } = await import("../db");
    await sendRejectionEmail("consult-uuid-001", mockPool as any);

    expect(mockSend).toHaveBeenCalled();
    const callArg = mockSend.mock.calls[0][0];
    expect(callArg.html).not.toContain("<script>");
    expect(callArg.html).not.toContain("</script>");
    expect(callArg.html).toContain("&lt;script&gt;");
  });

  it("renders escaped HTML when rejection_message contains anchor injection", async () => {
    setupQueryMock([
      {
        patient_email: "patient@example.com",
        patient_name: "Jane Patient",
        rejection_message: LINK_INJECTION,
        patient_id: "patient-uuid-001",
      },
    ]);

    const { sendRejectionEmail } = await import("../services/emailService");
    const { pool: mockPool } = await import("../db");
    await sendRejectionEmail("consult-uuid-001", mockPool as any);

    const callArg = mockSend.mock.calls[0][0];
    // The injected href must be escaped — not rendered as a clickable link
    expect(callArg.html).not.toContain('<a href="https://evil.example">');
    expect(callArg.html).toContain("&lt;a ");
    expect(callArg.html).toContain("https://evil.example");
  });
});

describe("SEC-002: sendRenewalApprovedEmail HTML-escapes reviewNote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("escapes HTML in renewal approval reviewNote", async () => {
    setupQueryMock([
      {
        patient_email: "patient@example.com",
        patient_name: "Jane Patient",
        medication_name: "Metformin",
        dosage: "500mg",
        review_note: LINK_INJECTION,
        valid_until: new Date("2026-05-22"),
        doctor_last_name: "Smith",
        patient_id: "patient-uuid-001",
      },
    ]);

    const { sendRenewalApprovedEmail } = await import("../services/emailService");
    const { pool: mockPool } = await import("../db");
    await sendRenewalApprovedEmail("renewal-uuid-001", mockPool as any);

    const callArg = mockSend.mock.calls[0][0];
    expect(callArg.html).not.toContain('<a href="https://evil.example">');
    expect(callArg.html).toContain("&lt;a ");
    expect(callArg.html).toContain("https://evil.example");
  });
});

describe("SEC-002: sendRenewalDeclinedEmail HTML-escapes reviewNote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("escapes HTML in renewal decline reviewNote", async () => {
    setupQueryMock([
      {
        patient_email: "patient@example.com",
        patient_name: "Jane Patient",
        medication_name: "Metformin",
        review_note: SCRIPT_INJECTION,
        doctor_last_name: "Smith",
        patient_id: "patient-uuid-001",
      },
    ]);

    const { sendRenewalDeclinedEmail } = await import("../services/emailService");
    const { pool: mockPool } = await import("../db");
    await sendRenewalDeclinedEmail("renewal-uuid-001", mockPool as any);

    const callArg = mockSend.mock.calls[0][0];
    expect(callArg.html).not.toContain("<script>");
    expect(callArg.html).toContain("&lt;script&gt;");
  });
});
