import { readFileSync } from "fs";
import { join } from "path";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// promptLoader tests (F-085, F-086, F-087)
// ---------------------------------------------------------------------------

const PROMPTS_DIR = join(__dirname, "../prompts");

describe("getPrompt", () => {
  let getPrompt: (name: string) => string;

  beforeAll(() => {
    jest.resetModules();
    ({ getPrompt } = require("../prompts/loader"));
  });

  it("returns the content of a known prompt file", () => {
    const content = getPrompt("ahpra-constraints");
    expect(typeof content).toBe("string");
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain("AHPRA");
  });

  it("returns content matching the file on disk", () => {
    const fromLoader = getPrompt("output-schema");
    const fromDisk = readFileSync(join(PROMPTS_DIR, "output-schema.md"), "utf8");
    expect(fromLoader).toBe(fromDisk);
  });

  it("returns content for cannot-assess-criteria", () => {
    const content = getPrompt("cannot-assess-criteria");
    expect(content).toContain("cannot_assess");
  });

  it("returns content for cannot-assess-template", () => {
    const content = getPrompt("cannot-assess-template");
    expect(content).toContain("in-person examination");
  });

  it("throws for an unknown prompt name", () => {
    expect(() => getPrompt("does-not-exist")).toThrow("Prompt not found: does-not-exist");
  });
});

describe("engine trigger hash logging (F-086)", () => {
  it("promptHash is 8 lowercase hex characters", () => {
    const { getPrompt } = require("../prompts/loader");
    const loggerModule = require("../logger");
    const systemPrompt = [
      getPrompt("system-preamble"),
      getPrompt("ahpra-constraints"),
      getPrompt("cannot-assess-criteria"),
      getPrompt("output-schema"),
    ].join("\n\n");

    const promptHash = createHash("sha256").update(systemPrompt).digest("hex").slice(0, 8);

    const logSpy = jest.spyOn(loggerModule.logger, "info");
    loggerModule.logger.info({ promptHash, promptName: "system" }, "engine trigger");

    expect(promptHash).toMatch(/^[0-9a-f]{8}$/);
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ promptHash: expect.stringMatching(/^[0-9a-f]{8}$/) }),
      "engine trigger"
    );

    logSpy.mockRestore();
  });
});

describe("startup failure on missing prompt file", () => {
  it("calls process.exit(1) when a required prompt file is missing", () => {
    const { validateAndLoadPrompts, EXPECTED_PROMPTS } = require("../prompts/loader");

    // Create a temp dir with all prompts except the first one
    const dir = mkdtempSync(join(tmpdir(), "nightingale-prompts-test-"));
    const [missing, ...rest] = EXPECTED_PROMPTS as string[];
    for (const name of rest) {
      writeFileSync(join(dir, `${name}.md`), `content for ${name}`);
    }

    const exitSpy = jest.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit(1)");
    }) as (code?: string | number | null) => never);

    expect(() => validateAndLoadPrompts(dir)).toThrow("process.exit(1)");
    expect(exitSpy).toHaveBeenCalledWith(1);

    // Confirm the missing file was indeed not written
    expect(missing).toBeTruthy();

    exitSpy.mockRestore();
  });
});
