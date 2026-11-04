/**
 * SiHadir-Edu: Client-Side WebP Photo Compression Engine
 * Enforces strict PRD constraints:
 * - Max width / bounding box: 1280px (preserves aspect ratio)
 * - Format: image/webp with graceful fallback to image/jpeg
 * - File size limit: strictly <= 180 KB (184,320 bytes)
 * - Iterative stepped quality & dimension degradation
 * - Correct EXIF orientation handling
 */

export interface CompressionOptions {
  /** Maximum width in pixels (default: 1280) */
  maxWidth?: number;
  /** Maximum height in pixels (default: 1280) */
  maxHeight?: number;
  /** Maximum allowed output size in bytes (default: 180 * 1024 = 184,320) */
  maxSizeBytes?: number;
  /** Initial compression quality between 0.1 and 1.0 (default: 0.82) */
  initialQuality?: number;
  /** Minimum quality floor before downscaling dimensions (default: 0.40) */
  minQuality?: number;
  /** Stepped quality decrement per iteration (default: 0.08) */
  qualityStep?: number;
  /** Force format override if desired */
  forceFormat?: 'image/webp' | 'image/jpeg';
}

export interface CompressionResult {
  /** Compressed File instance ready for form submission or upload */
  file: File;
  /** Raw compressed binary Blob */
  blob: Blob;
  /** Base64 Data URL for instant client-side preview */
  base64: string;
  /** Original file size in Kilobytes */
  originalSizeKb: number;
  /** Compressed file size in Kilobytes */
  compressedSizeKb: number;
  /** Percentage savings (e.g. 96 for 96% smaller) */
  savingsPercent: number;
  /** Final output image width in pixels */
  width: number;
  /** Final output image height in pixels */
  height: number;
  /** Applied MIME format */
  format: 'webp' | 'jpeg';
  /** Number of compression iterations executed */
  iterations: number;
}

export const DEFAULT_MAX_SIZE_BYTES = 180 * 1024; // 180 KB = 184,320 bytes
export const DEFAULT_MAX_DIMENSION = 1280; // 1280px
export const DEFAULT_INITIAL_QUALITY = 0.82;
export const DEFAULT_MIN_QUALITY = 0.4;
export const DEFAULT_QUALITY_STEP = 0.08;

/**
 * Checks if the current browser environment supports HTML5 Canvas WebP export.
 */
export function isWebPSupported(): boolean {
  if (typeof document === 'undefined') return true; // SSR safe assumption
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const uri = canvas.toDataURL('image/webp');
    return uri.startsWith('data:image/webp');
  } catch {
    return false;
  }
}

/**
 * Loads an image file into an ImageBitmap or HTMLImageElement with EXIF orientation respected.
 */
async function loadImageElement(
  file: File
): Promise<{ source: ImageBitmap | HTMLImageElement; width: number; height: number; cleanup: () => void }> {
  // Option A: Use createImageBitmap with imageOrientation: 'from-image' if supported
  if (typeof window !== 'undefined' && typeof window.createImageBitmap === 'function') {
    try {
      const bitmap = await window.createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fallback to HTMLImageElement if createImageBitmap fails on specific format
    }
  }

  // Option B: Standard HTMLImageElement with object URL
  return new Promise((resolve, reject) => {
    if (typeof URL === 'undefined' || typeof Image === 'undefined') {
      return reject(new Error('Browser image loading APIs unavailable in non-browser environment'));
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(objectUrl),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Gagal membaca file gambar: ${file.name}`));
    };
    img.src = objectUrl;
  });
}

/**
 * Calculates scaled dimensions preserving original aspect ratio.
 */
export function calculateAspectRatioFit(
  srcWidth: number,
  srcHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (srcWidth <= 0 || srcHeight <= 0) {
    return { width: Math.max(1, maxWidth), height: Math.max(1, maxHeight) };
  }
  if (srcWidth <= maxWidth && srcHeight <= maxHeight) {
    return { width: srcWidth, height: srcHeight };
  }
  const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
  return {
    width: Math.max(1, Math.round(srcWidth * ratio)),
    height: Math.max(1, Math.round(srcHeight * ratio)),
  };
}

/**
 * Converts a Blob to a base64 Data URL string.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader !== 'undefined') {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Gagal mengonversi blob ke base64 string'));
        }
      };
      reader.onerror = () => reject(reader.error || new Error('FileReader error'));
      reader.readAsDataURL(blob);
    } else {
      // Node.js fallback
      blob
        .arrayBuffer()
        .then((buf) => {
          const b64 = Buffer.from(buf).toString('base64');
          resolve(`data:${blob.type};base64,${b64}`);
        })
        .catch(reject);
    }
  });
}

/**
 * Exports a canvas or OffscreenCanvas to a Blob of specified MIME type and quality.
 */
async function exportCanvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  mimeType: 'image/webp' | 'image/jpeg',
  quality: number
): Promise<Blob> {
  if ('convertToBlob' in canvas && typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type: mimeType, quality });
  }

  if ('toBlob' in canvas && typeof canvas.toBlob === 'function') {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob menghasilkan null'));
        },
        mimeType,
        quality
      );
    });
  }

  throw new Error('Canvas API tidak mendukung export Blob pada environment ini');
}

/**
 * Main compression engine entrypoint.
 * Compresses an image file to <= 180 KB in WebP format (or JPEG fallback)
 * with resolution capped at 1280px and preserved aspect ratio.
 */
export async function compressImage(
  file: File,
  options?: CompressionOptions
): Promise<CompressionResult> {
  const maxSizeBytes = options?.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
  const initialMaxWidth = options?.maxWidth ?? DEFAULT_MAX_DIMENSION;
  const initialMaxHeight = options?.maxHeight ?? DEFAULT_MAX_DIMENSION;
  const initialQuality = options?.initialQuality ?? DEFAULT_INITIAL_QUALITY;
  const minQuality = options?.minQuality ?? DEFAULT_MIN_QUALITY;
  const qualityStep = options?.qualityStep ?? DEFAULT_QUALITY_STEP;

  // Determine export MIME type
  const webpSupported = isWebPSupported();
  const targetMime: 'image/webp' | 'image/jpeg' =
    options?.forceFormat ?? (webpSupported ? 'image/webp' : 'image/jpeg');
  const formatKey: 'webp' | 'jpeg' = targetMime === 'image/webp' ? 'webp' : 'jpeg';

  // Load image with orientation normalized
  const { source, width: origWidth, height: origHeight, cleanup } = await loadImageElement(file);

  try {
    let currentMaxWidth = initialMaxWidth;
    let currentMaxHeight = initialMaxHeight;
    let bestBlob: Blob | null = null;
    let finalWidth = 0;
    let finalHeight = 0;
    let totalIterations = 0;

    // Outer loop: dimensional downscale (if extreme entropy prevents reaching <=180KB)
    for (let dimStep = 0; dimStep < 3; dimStep++) {
      const { width: targetW, height: targetH } = calculateAspectRatioFit(
        origWidth,
        origHeight,
        currentMaxWidth,
        currentMaxHeight
      );

      finalWidth = targetW;
      finalHeight = targetH;

      // Create Canvas (prefer OffscreenCanvas where available)
      let canvas: HTMLCanvasElement | OffscreenCanvas;
      let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

      if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(targetW, targetH);
        ctx = canvas.getContext('2d');
      } else if (typeof document !== 'undefined') {
        canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        ctx = canvas.getContext('2d');
      } else {
        throw new Error('Canvas rendering is not supported in this runtime environment');
      }

      if (!ctx) {
        throw new Error('Gagal menginisialisasi 2D Canvas rendering context');
      }

      // Configure high-quality smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw source image onto scaled canvas
      ctx.drawImage(source as CanvasImageSource, 0, 0, targetW, targetH);

      // Inner loop: Stepped quality degradation
      let currentQuality = dimStep === 0 ? initialQuality : 0.7;

      while (currentQuality >= minQuality - 0.01) {
        totalIterations++;
        const candidateBlob = await exportCanvasToBlob(canvas, targetMime, currentQuality);

        bestBlob = candidateBlob;

        // Strict limit check: <= 180 KB
        if (candidateBlob.size <= maxSizeBytes) {
          break;
        }

        currentQuality -= qualityStep;
      }

      // If candidate satisfies the limit, stop
      if (bestBlob && bestBlob.size <= maxSizeBytes) {
        break;
      }

      // Otherwise, scale dimensions down by 15% and retry
      currentMaxWidth = Math.round(currentMaxWidth * 0.85);
      currentMaxHeight = Math.round(currentMaxHeight * 0.85);
    }

    if (!bestBlob) {
      throw new Error('Proses kompresi gagal menghasilkan output blob');
    }

    // Convert to Base64 for instant client preview
    const base64 = await blobToBase64(bestBlob);

    // Build replacement File instance
    const cleanBaseName = file.name.replace(/\.[^/.]+$/, '');
    const newFileName = `${cleanBaseName}.${formatKey}`;
    const compressedFile = new File([bestBlob], newFileName, {
      type: targetMime,
      lastModified: Date.now(),
    });

    const originalSizeKb = Math.round(file.size / 1024);
    const compressedSizeKb = Math.round(bestBlob.size / 1024);
    const savingsPercent =
      file.size > 0
        ? Math.max(0, Math.round(((file.size - bestBlob.size) / file.size) * 100))
        : 0;

    return {
      file: compressedFile,
      blob: bestBlob,
      base64,
      originalSizeKb,
      compressedSizeKb,
      savingsPercent,
      width: finalWidth,
      height: finalHeight,
      format: formatKey,
      iterations: totalIterations,
    };
  } finally {
    cleanup();
  }
}

/**
 * Format bytes into human readable string (e.g. "142 KB" or "3.4 MB").
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
