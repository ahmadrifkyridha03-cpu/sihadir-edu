/**
 * SiHadir-Edu: Media Storage Service Abstraction
 * Supports:
 * 1. 'local' -> Base64 data URL (dev/testing fallback, 100% offline & zero external key requirement)
 * 2. 'supabase' -> Supabase Storage Bucket ('documentation-photos')
 * 3. 'cloudinary' -> Cloudinary REST API / Upload Preset
 */

export interface StorageUploadOptions {
  journalId: string;
  filename: string;
  contentType: 'image/webp' | 'image/jpeg';
  folder?: string;
  activityTag?: string;
}

export interface StorageUploadResult {
  url: string;
  thumbnailUrl: string;
  fileKey: string;
  provider: 'local' | 'supabase' | 'cloudinary';
  sizeKb: number;
  format: 'webp' | 'jpeg';
}

export interface StorageProvider {
  name: 'local' | 'supabase' | 'cloudinary';
  upload(
    fileData: Blob | Buffer | string,
    options: StorageUploadOptions
  ): Promise<StorageUploadResult>;
  delete?(fileKey: string): Promise<boolean>;
}

// ------------------------------------------------------------------------------
// 1. Local Storage Provider (Base64 / Dev Fallback)
// ------------------------------------------------------------------------------
export class LocalStorageProvider implements StorageProvider {
  name: 'local' = 'local';

  async upload(
    fileData: Blob | Buffer | string,
    options: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    let dataUrl: string;

    if (typeof fileData === 'string') {
      dataUrl = fileData.startsWith('data:')
        ? fileData
        : `data:${options.contentType};base64,${fileData}`;
    } else if (typeof Blob !== 'undefined' && fileData instanceof Blob) {
      const buffer = Buffer.from(await fileData.arrayBuffer());
      dataUrl = `data:${options.contentType};base64,${buffer.toString('base64')}`;
    } else if (Buffer.isBuffer(fileData)) {
      dataUrl = `data:${options.contentType};base64,${fileData.toString('base64')}`;
    } else {
      dataUrl = `data:${options.contentType};base64,${String(fileData)}`;
    }

    const approxSizeKb = Math.round((dataUrl.length * 0.75) / 1024);
    const key = `local_${options.journalId}_${Date.now()}`;

    return {
      url: dataUrl,
      thumbnailUrl: dataUrl,
      fileKey: key,
      provider: 'local',
      sizeKb: approxSizeKb,
      format: options.contentType === 'image/webp' ? 'webp' : 'jpeg',
    };
  }

  async delete(_fileKey: string): Promise<boolean> {
    return true;
  }
}

// ------------------------------------------------------------------------------
// 2. Supabase Storage Provider (Bucket: documentation-photos)
// ------------------------------------------------------------------------------
export class SupabaseStorageProvider implements StorageProvider {
  name: 'supabase' = 'supabase';
  private bucketName = 'documentation-photos';
  private supabaseUrl: string;
  private serviceKey: string;

  constructor() {
    this.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    this.serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  }

  async upload(
    fileData: Blob | Buffer | string,
    options: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    if (!this.supabaseUrl || !this.serviceKey) {
      console.warn('[Storage] Supabase credentials not found, falling back to LocalStorageProvider');
      return new LocalStorageProvider().upload(fileData, options);
    }

    const timestamp = Date.now();
    const cleanFilename = options.filename.replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = options.contentType === 'image/webp' ? 'webp' : 'jpeg';
    const path = `journals/${options.journalId}/${timestamp}_${cleanFilename}.${ext}`;

    let bodyData: BodyInit;
    let sizeBytes = 0;

    if (typeof Blob !== 'undefined' && fileData instanceof Blob) {
      bodyData = fileData;
      sizeBytes = fileData.size;
    } else if (typeof fileData === 'string' && fileData.startsWith('data:')) {
      const base64Data = fileData.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      bodyData = new Uint8Array(buffer);
      sizeBytes = buffer.length;
    } else if (Buffer.isBuffer(fileData)) {
      bodyData = new Uint8Array(fileData);
      sizeBytes = fileData.length;
    } else {
      const buffer = Buffer.from(String(fileData), 'base64');
      bodyData = new Uint8Array(buffer);
      sizeBytes = buffer.length;
    }

    const uploadEndpoint = `${this.supabaseUrl}/storage/v1/object/${this.bucketName}/${path}`;

    const response = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
        'Content-Type': options.contentType,
        'x-upsert': 'true',
      },
      body: bodyData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Supabase Storage Upload Error]:', errText);
      throw new Error(`Gagal mengunggah foto ke Supabase Storage: ${response.statusText}`);
    }

    const publicUrl = `${this.supabaseUrl}/storage/v1/object/public/${this.bucketName}/${path}`;

    return {
      url: publicUrl,
      thumbnailUrl: publicUrl,
      fileKey: path,
      provider: 'supabase',
      sizeKb: Math.round(sizeBytes / 1024),
      format: ext,
    };
  }

  async delete(fileKey: string): Promise<boolean> {
    if (!this.supabaseUrl || !this.serviceKey) return false;
    try {
      const response = await fetch(`${this.supabaseUrl}/storage/v1/object/${this.bucketName}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prefixes: [fileKey] }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ------------------------------------------------------------------------------
// 3. Cloudinary Storage Provider (REST API)
// ------------------------------------------------------------------------------
export class CloudinaryStorageProvider implements StorageProvider {
  name: 'cloudinary' = 'cloudinary';
  private cloudName: string;

  constructor() {
    this.cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
  }

  async upload(
    fileData: Blob | Buffer | string,
    options: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    if (!this.cloudName) {
      console.warn('[Storage] Cloudinary credentials not configured, falling back to LocalStorageProvider');
      return new LocalStorageProvider().upload(fileData, options);
    }

    const formData = new FormData();
    const timestamp = Math.round(Date.now() / 1000);
    const folder = `sihadir/journals/${options.journalId}`;

    if (typeof fileData === 'string') {
      formData.append('file', fileData);
    } else if (typeof Blob !== 'undefined' && fileData instanceof Blob) {
      formData.append('file', fileData, options.filename);
    } else {
      const base64 = `data:${options.contentType};base64,${fileData.toString('base64')}`;
      formData.append('file', base64);
    }

    formData.append('folder', folder);
    formData.append('timestamp', timestamp.toString());

    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_PRESET || 'sihadir_documentation';
    formData.append('upload_preset', uploadPreset);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Cloudinary Upload Error]:', err);
      throw new Error(`Cloudinary upload failed: ${res.statusText}`);
    }

    const data = await res.json();
    const secureUrl: string = data.secure_url;
    const thumbUrl = secureUrl.replace('/upload/', '/upload/c_thumb,w_300,h_300,g_auto,q_auto,f_auto/');

    return {
      url: secureUrl,
      thumbnailUrl: thumbUrl,
      fileKey: data.public_id,
      provider: 'cloudinary',
      sizeKb: Math.round((data.bytes || 0) / 1024),
      format: options.contentType === 'image/webp' ? 'webp' : 'jpeg',
    };
  }
}

// ------------------------------------------------------------------------------
// Factory Function
// ------------------------------------------------------------------------------
export function getStorageProvider(): StorageProvider {
  const forcedProvider = process.env.STORAGE_PROVIDER?.toLowerCase();

  if (forcedProvider === 'local') return new LocalStorageProvider();
  if (forcedProvider === 'supabase') return new SupabaseStorageProvider();
  if (forcedProvider === 'cloudinary') return new CloudinaryStorageProvider();

  // Auto detection
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ) {
    return new SupabaseStorageProvider();
  }
  if (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
    return new CloudinaryStorageProvider();
  }

  return new LocalStorageProvider();
}

/**
 * Convenience helper to upload a compressed documentation photo.
 */
export async function uploadDocumentationMedia(
  fileData: Blob | Buffer | string,
  options: StorageUploadOptions
): Promise<StorageUploadResult> {
  const provider = getStorageProvider();
  return provider.upload(fileData, options);
}
