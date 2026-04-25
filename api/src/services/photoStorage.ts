import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { config } from "../config";
import { logger } from "../logger";

const s3 = new S3Client({ region: config.s3.region });

export interface PhotoUploadResult {
  s3Key: string;
  mimeType: string;
  sizeBytes: number;
  widthPx: number;
  heightPx: number;
  qualityPassed: boolean;
  qualityIssues: string[];
}

// Minimum acceptable megapixels for clinical AI processing.
const MIN_MEGAPIXELS = 0.5;

const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
]);

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function validatePhotoMimeType(mimeType: string): boolean {
  return ACCEPTED_MIME_TYPES.has(mimeType.toLowerCase());
}

export function validatePhotoSize(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_SIZE_BYTES;
}

export type QualityIssue = "low_resolution" | "blurry" | "too_dark" | "overexposed";

export interface PhotoQualityResult {
  passed: boolean;
  issues: QualityIssue[];
}

/**
 * Server-side photo quality check using sharp metadata and statistics.
 * This runs unconditionally — client flags are not consulted.
 *
 * Checks performed:
 *  - Resolution: reject < 0.5 MP (images too small for clinical AI)
 *  - Blur: standard deviation of the luma channel (sharp `stats`). Low std → flat/blurry.
 *  - Lighting: mean luma < 40 → too dark; mean luma > 230 → overexposed.
 *
 * These are intentionally conservative thresholds. A genuine clinical photo taken
 * with any modern smartphone easily passes all three checks.
 */
export async function checkPhotoQuality(buffer: Buffer): Promise<PhotoQualityResult> {
  const metadata = await sharp(buffer).metadata();
  const { width = 0, height = 0 } = metadata;

  const issues: QualityIssue[] = [];

  // Resolution check — width/height come from sharp metadata (reliable, not client-provided)
  const megapixels = (width * height) / 1_000_000;
  if (megapixels < MIN_MEGAPIXELS) {
    issues.push("low_resolution");
  }

  // Lighting and blur — computed from pixel statistics (luma channel only)
  try {
    const stats = await sharp(buffer)
      .greyscale()
      .stats();

    const channel = stats.channels[0];
    const mean = channel.mean;
    const stdev = channel.stdev;

    if (mean < 40) issues.push("too_dark");
    if (mean > 230) issues.push("overexposed");
    // Low stdev means the image is nearly uniform — indicative of blur or a lens cap
    if (stdev < 15) issues.push("blurry");
  } catch {
    // If pixel analysis fails (e.g. unsupported format before re-encode), skip blur/lighting.
    // Resolution check already ran; don't double-penalise.
  }

  return { passed: issues.length === 0, issues };
}

/**
 * Strips EXIF metadata, converts to JPEG (including HEIC), runs server-side
 * quality checks, and uploads to S3 with SSE-KMS.
 * Returns S3 key, image metadata, and quality check result.
 */
export async function uploadPhoto(
  buffer: Buffer,
  consultationId: string
): Promise<PhotoUploadResult> {
  // Quality check runs before re-encoding so that original pixel data is used.
  const quality = await checkPhotoQuality(buffer);

  // Re-encoding through sharp strips all EXIF metadata (including GPS, device info).
  // Handles JPEG, PNG, and HEIC input formats.
  const { data, info } = await sharp(buffer)
    .jpeg({ quality: 85 })
    .toBuffer({ resolveWithObject: true });

  const key = `${consultationId}/${randomUUID()}.jpg`;

  await s3.send(
    new PutObjectCommand({
      Bucket: config.s3.photosBucket,
      Key: key,
      Body: data,
      ContentType: "image/jpeg",
      ServerSideEncryption: "aws:kms",
      ...(config.s3.kmsKeyId ? { SSEKMSKeyId: config.s3.kmsKeyId } : {}),
    })
  );

  logger.info({ consultationId, s3Key: key, sizeBytes: info.size }, "photo.uploaded_to_s3");

  return {
    s3Key: key,
    mimeType: "image/jpeg",
    sizeBytes: info.size,
    widthPx: info.width,
    heightPx: info.height,
    qualityPassed: quality.passed,
    qualityIssues: quality.issues,
  };
}

/**
 * Generates a pre-signed GET URL for a photo, valid for 15 minutes.
 * All photo access must go through this — no public S3 URLs.
 */
export async function generatePresignedUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: config.s3.photosBucket,
    Key: s3Key,
  });
  return getSignedUrl(s3, command, { expiresIn: config.s3.presignedUrlExpiry });
}
