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
}

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

/**
 * Strips EXIF metadata, converts to JPEG (including HEIC), and uploads to S3
 * with SSE-KMS. Returns S3 key and image metadata.
 */
export async function uploadPhoto(
  buffer: Buffer,
  consultationId: string
): Promise<PhotoUploadResult> {
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
