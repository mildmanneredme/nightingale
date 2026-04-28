// PRD-032: Semantic RAG Pipeline — embedding generation
//
// Wraps AWS Bedrock Titan Embed Text V2 (amazon.titan-embed-text-v2:0).
// All calls go to ap-southeast-2 to satisfy AU data residency (APP 8).
// Returns 1024-dimension normalised float vectors.

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { logger } from "../logger";

const EMBEDDING_MODEL = "amazon.titan-embed-text-v2:0";
const EMBEDDING_DIMENSIONS = 1024;
// Titan Embed Text V2 max input length; truncate silently rather than error.
const MAX_INPUT_CHARS = 32_000;

let bedrockClient: BedrockRuntimeClient | null = null;

function getClient(): BedrockRuntimeClient {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({ region: "ap-southeast-2" });
  }
  return bedrockClient;
}

interface TitanEmbedResponse {
  embedding: number[];
  inputTextTokenCount: number;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const truncated = text.slice(0, MAX_INPUT_CHARS);

  const body = JSON.stringify({
    inputText: truncated,
    dimensions: EMBEDDING_DIMENSIONS,
    normalize: true,
  });

  const command = new InvokeModelCommand({
    modelId: EMBEDDING_MODEL,
    contentType: "application/json",
    accept: "application/json",
    body: Buffer.from(body),
  });

  const response = await getClient().send(command);
  const parsed: TitanEmbedResponse = JSON.parse(
    Buffer.from(response.body).toString("utf-8")
  );

  logger.debug(
    { tokenCount: parsed.inputTextTokenCount, model: EMBEDDING_MODEL },
    "embeddingService: generated embedding"
  );

  return parsed.embedding;
}

// Formats a number[] embedding as a pgvector literal: '[0.1,0.2,...]'
export function formatVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
