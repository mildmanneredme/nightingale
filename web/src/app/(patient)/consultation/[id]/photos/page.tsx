"use client";
import { useCallback, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { uploadConsultationPhoto, PhotoQualityCheck, ApiError } from "@/lib/api";

interface PhotoEntry {
  file: File;
  previewUrl: string;
  quality: PhotoQualityCheck;
  uploaded: boolean;
  uploading: boolean;
  error?: string;
}

type QualityIssue = "blurry" | "too_dark" | "overexposed" | "low_resolution";

const MIN_PIXELS = 1_000_000; // 1 MP

const QUALITY_MESSAGES: Record<QualityIssue, string> = {
  low_resolution: "Photo resolution is too low — move closer or use a higher-quality camera.",
  blurry: "Photo appears blurry — hold your device steady and tap to focus before capturing.",
  too_dark: "Photo is too dark — move to a brighter area or turn on a light.",
  overexposed: "Photo is overexposed — avoid direct light sources behind the subject.",
};

async function assessQuality(file: File): Promise<PhotoQualityCheck> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const issues: QualityIssue[] = [];
      const { naturalWidth: w, naturalHeight: h } = img;

      if (w * h < MIN_PIXELS) issues.push("low_resolution");

      // Render to canvas for pixel-level analysis
      const canvas = document.createElement("canvas");
      // Downscale for performance — we only need a sample
      const scale = Math.min(1, 200 / Math.max(w, h));
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve({ passed: issues.length === 0, issues, overridden: false });
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Brightness: average luminance across sampled pixels
      let totalLuminance = 0;
      const pixelCount = canvas.width * canvas.height;
      for (let i = 0; i < data.length; i += 4) {
        // Rec. 601 luminance
        totalLuminance += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      const avgLuminance = totalLuminance / pixelCount;
      if (avgLuminance < 35) issues.push("too_dark");
      if (avgLuminance > 230) issues.push("overexposed");

      // Blur: Laplacian variance on greyscale
      const grey = new Float32Array(pixelCount);
      for (let i = 0; i < pixelCount; i++) {
        grey[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
      }
      const cols = canvas.width;
      const rows = canvas.height;
      let lapSum = 0;
      let lapSumSq = 0;
      let lapCount = 0;
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          const idx = r * cols + c;
          const lap =
            -grey[idx - cols - 1] - grey[idx - cols] - grey[idx - cols + 1] -
            grey[idx - 1] + 8 * grey[idx] - grey[idx + 1] -
            grey[idx + cols - 1] - grey[idx + cols] - grey[idx + cols + 1];
          lapSum += lap;
          lapSumSq += lap * lap;
          lapCount++;
        }
      }
      const mean = lapSum / lapCount;
      const variance = lapSumSq / lapCount - mean * mean;
      // Low variance → blurry. Threshold tuned empirically for clinical photos.
      if (variance < 100) issues.push("blurry");

      resolve({ passed: issues.length === 0, issues, overridden: false });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ passed: false, issues: ["low_resolution"], overridden: false });
    };
    img.src = url;
  });
}

export default function PhotoUploadPage() {
  const { id: consultationId } = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [skipping, setSkipping] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const MAX = 5;
  const canAddMore = photos.length < MAX;
  const allUploaded = photos.length > 0 && photos.every((p) => p.uploaded);
  const anyFailed = photos.some((p) => p.quality.issues.length > 0 && !p.quality.overridden);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (!files.length) return;
      e.target.value = "";

      const remaining = MAX - photos.length;
      const toProcess = files.slice(0, remaining);

      const newEntries: PhotoEntry[] = await Promise.all(
        toProcess.map(async (file) => {
          const quality = await assessQuality(file);
          return {
            file,
            previewUrl: URL.createObjectURL(file),
            quality,
            uploaded: false,
            uploading: false,
          };
        })
      );

      setPhotos((prev) => [...prev, ...newEntries]);
    },
    [photos.length]
  );

  function handleOverride(index: number) {
    setPhotos((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, quality: { ...p.quality, overridden: true } } : p
      )
    );
  }

  function handleRemove(index: number) {
    setPhotos((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].previewUrl);
      copy.splice(index, 1);
      return copy;
    });
  }

  async function handleUploadAll() {
    setSubmitting(true);

    let anyError = false;
    for (let i = 0; i < photos.length; i++) {
      if (photos[i].uploaded) continue;

      setPhotos((prev) =>
        prev.map((p, idx) => (idx === i ? { ...p, uploading: true, error: undefined } : p))
      );

      try {
        await uploadConsultationPhoto(consultationId, photos[i].file, photos[i].quality);
        setPhotos((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, uploading: false, uploaded: true } : p
          )
        );
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Upload failed";
        setPhotos((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, uploading: false, error: msg } : p
          )
        );
        anyError = true;
      }
    }

    setSubmitting(false);
    if (!anyError) {
      router.push(`/consultation/${consultationId}/result`);
    }
  }

  async function handleSkip() {
    setSkipping(true);
    router.push(`/consultation/${consultationId}/result`);
  }

  return (
    <div className="py-stack-lg max-w-2xl">
      <h1 className="font-display text-headline-md text-on-surface mb-2">
        Add photos
      </h1>
      <p className="text-body-md text-on-surface-variant mb-6">
        Photos help the reviewing doctor assess your condition more accurately.
        You can upload up to {MAX} photos (JPEG, PNG, or HEIC, max 10 MB each).
      </p>

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-3">
          {photos.map((entry, i) => (
            <div key={i} className="relative rounded-xl overflow-hidden border border-outline-variant">
              {/* Preview */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entry.previewUrl}
                alt={`Photo ${i + 1}`}
                className="w-full aspect-square object-cover"
              />

              {/* Upload state overlay */}
              {entry.uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-body-sm font-medium">Uploading…</span>
                </div>
              )}
              {entry.uploaded && (
                <div className="absolute top-2 right-2 bg-primary text-on-primary rounded-full w-6 h-6 flex items-center justify-center text-body-sm font-bold">
                  ✓
                </div>
              )}

              {/* Remove button (only before upload) */}
              {!entry.uploaded && !entry.uploading && (
                <button
                  onClick={() => handleRemove(i)}
                  aria-label="Remove photo"
                  className="absolute top-2 right-2 bg-error text-on-error rounded-full w-6 h-6 flex items-center justify-center text-body-sm font-bold"
                >
                  ×
                </button>
              )}

              {/* Quality warning */}
              {entry.quality.issues.length > 0 && !entry.quality.overridden && !entry.uploaded && (
                <div className="absolute bottom-0 left-0 right-0 bg-error-container text-on-error-container text-body-sm p-2">
                  {QUALITY_MESSAGES[entry.quality.issues[0] as QualityIssue]}
                  <button
                    onClick={() => handleOverride(i)}
                    className="block mt-1 underline text-body-sm font-medium"
                  >
                    Upload anyway
                  </button>
                </div>
              )}

              {/* Per-photo upload error */}
              {entry.error && (
                <div className="absolute bottom-0 left-0 right-0 bg-error-container text-on-error-container text-body-sm p-2">
                  {entry.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add photo button */}
      {canAddMore && (
        <div className="mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/heic,image/heif"
            multiple
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-outline-variant rounded-xl py-8 text-on-surface-variant text-body-md hover:border-primary hover:text-primary transition-colors"
          >
            {photos.length === 0 ? "Tap to add a photo" : `Add another photo (${photos.length}/${MAX})`}
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-3">
        {photos.length > 0 && (
          <button
            onClick={handleUploadAll}
            disabled={submitting || anyFailed || allUploaded}
            className="w-full bg-primary text-on-primary rounded-lg py-4 font-semibold text-body-md hover:opacity-90 disabled:opacity-50"
          >
            {submitting
              ? "Uploading…"
              : allUploaded
              ? "Continue"
              : `Upload ${photos.filter((p) => !p.uploaded).length} photo${photos.filter((p) => !p.uploaded).length !== 1 ? "s" : ""}`}
          </button>
        )}

        {allUploaded && (
          <button
            onClick={() => router.push(`/consultation/${consultationId}/result`)}
            className="w-full bg-primary text-on-primary rounded-lg py-4 font-semibold text-body-md hover:opacity-90"
          >
            Continue
          </button>
        )}

        <button
          onClick={handleSkip}
          disabled={skipping || submitting}
          className="w-full border border-outline text-on-surface rounded-lg py-3 text-body-md hover:bg-surface-container disabled:opacity-50"
        >
          {skipping ? "Continuing…" : "Skip — no photos to add"}
        </button>
      </div>
    </div>
  );
}
