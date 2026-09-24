export type CaptureOptions = {
  mode: 'single' | 'batch'; targets: string[];
  viewport: { preset: 'desktop' | 'mobile' | 'ipad' | 'ipad-pro' | 'macbook' | 'pc' | 'custom'; width: number; height: number; fullPage: boolean; scale: number };
  appearance: { darkMode: boolean }; output: { format: 'jpeg' | 'png' | 'webp' | 'pdf' }; timing: { delay: number };
};
export type CaptureResult = {
  success: true; id: string; mode: 'single' | 'batch'; type: 'image' | 'pdf' | 'archive';
  filename: string; mimeType: string; bytes: number; previewUrl?: string; downloadUrl: string;
  expiresAt: string; targets: string[]; viewport: CaptureOptions['viewport']; format: string;
  items?: { filename: string; previewUrl: string; mimeType: string }[];
  archiveCount?: number; partial?: boolean;
};
export type ProviderOutput = { bytes: Uint8Array; filename: string; mimeType: string };
export interface CaptureProvider { capture(options: CaptureOptions, signal: AbortSignal): Promise<ProviderOutput> }
export interface FileStore {
  put(id: string, bytes: Uint8Array, meta: FileMeta): Promise<void>;
  get(id: string): Promise<{ body: BodyInit; meta: FileMeta } | null>;
  cleanup(): Promise<void>;
}
export type FileMeta = { filename: string; mimeType: string; expires: number; bytes: number };
export type Config = { provider: string; timeout: number; ttl: number; batchLimit: number; maxOutput: number; rateLimit: number; maxConcurrent: number; endpoint: string; engineUrl?: string; engineToken?: string };
