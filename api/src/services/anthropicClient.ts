// Anthropic client abstraction supporting both direct API and AWS Bedrock.
//
// Production: USE_BEDROCK=true — uses IAM role credentials in ECS ap-southeast-2.
//   This keeps inference inside AU and eliminates the APP 8 cross-border trigger.
// Development: ANTHROPIC_API_KEY set — uses direct Anthropic API.
//
// Prompt caching is applied to the system prompt (static across calls for the
// same consultation type), reducing cost and latency on repeated invocations.

import Anthropic from "@anthropic-ai/sdk";
import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import { config } from "../config";
import { logger } from "../logger";

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

let _directClient: Anthropic | null = null;
let _bedrockClient: AnthropicBedrock | null = null;

function getDirectClient(): Anthropic {
  if (!_directClient) {
    if (!config.anthropic.apiKey) {
      throw new Error("ANTHROPIC_API_KEY must be set when USE_BEDROCK is false");
    }
    _directClient = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return _directClient;
}

function getBedrockClient(): AnthropicBedrock {
  if (!_bedrockClient) {
    _bedrockClient = new AnthropicBedrock({
      awsRegion: config.anthropic.bedrockRegion,
    });
  }
  return _bedrockClient;
}

/**
 * Calls Claude with the given system prompt and messages.
 *
 * The system prompt is sent with `cache_control: { type: "ephemeral" }` to
 * enable prompt caching. This is the largest cacheable block — the clinical
 * guidelines and output schema don't change between calls for the same
 * presenting condition type.
 */
export async function callClaude(
  systemPrompt: string,
  messages: ClaudeMessage[]
): Promise<ClaudeResponse> {
  const modelId = config.anthropic.useBedrock
    ? config.anthropic.bedrockModelId
    : config.anthropic.directModelId;

  const requestParams = {
    model: modelId,
    max_tokens: config.anthropic.maxTokens,
    system: [
      {
        type: "text" as const,
        text: systemPrompt,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  };

  let response: Anthropic.Message;

  if (config.anthropic.useBedrock) {
    response = await getBedrockClient().messages.create(requestParams);
  } else {
    response = await getDirectClient().messages.create(requestParams);
  }

  const content =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  const usage = response.usage as Anthropic.Usage & {
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };

  logger.debug(
    {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
    },
    "anthropicClient: token usage"
  );

  return {
    content,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
  };
}
