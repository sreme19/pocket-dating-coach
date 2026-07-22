import { getSupabase } from '$lib/server/supabase';

/**
 * Upload audit capture.
 *
 * Records one `upload_audit` row per file a user uploads to any capture
 * surface, so admins can review submissions and grade AI accuracy.
 *
 * Sensitivity is the safety boundary. Sensitive name-bearing documents
 * (bank statements / payslips / ITR = `wealth`, vehicle RC / ownership =
 * `assets`, card & bank statements = `spending`, CV PDFs = `linkedin`, and
 * the gov-ID `verify-step` `id` step) are recorded as METADATA + verdict
 * ONLY — their bytes are never written to storage. Everything else is stored
 * in full: either uploaded to the private `upload-audit` bucket, or (for
 * surfaces that already persist the file publicly) recorded as a reference.
 *
 * Every call is best-effort: the whole body is wrapped so a capture failure
 * can never throw into — or block — the underlying upload response.
 */

const AUDIT_BUCKET = 'upload-audit';
const RETENTION_DAYS = 90;

export type UploadSource =
  | 'proof-upload'
  | 'verify-step'
  | 'artifacts'
  | 'car-image'
  | 'profile-photo';

export interface CaptureItem {
  name?: string;
  mimeType?: string;
  sizeBytes?: number;
  /** Raw bytes to persist (used for non-sensitive uploads). */
  bytes?: Buffer | Uint8Array | ArrayBuffer;
  /** Base64 (WITHOUT any `data:` prefix) — alternative to `bytes`. */
  base64?: string;
  /** Already-persisted public URL; recorded as a reference, no re-upload. */
  existingUrl?: string;
}

export interface CaptureInput {
  userId: string | null;
  source: UploadSource;
  category?: string;
  matchId?: string | null;
  verdict?: { verified?: boolean | null; result?: unknown } | null;
  /** Web File objects (from formData). Bytes are read only when non-sensitive. */
  files?: File[];
  /** Pre-normalized items (base64 / existing-url surfaces). */
  items?: CaptureItem[];
  /** Force sensitivity; when omitted it is derived from source + category + mime. */
  sensitive?: boolean;
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/webp': 'webp', 'image/gif': 'gif',
  'application/pdf': 'pdf',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac',
  'audio/wav': 'wav', 'audio/webm': 'weba', 'audio/ogg': 'ogg',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
};

/** Does this upload carry a person's name / financial detail that we must not retain? */
export function isSensitiveUpload(
  source: UploadSource,
  category: string,
  mimeTypes: string[],
): boolean {
  const cat = (category || '').toLowerCase();
  if (source === 'verify-step' && cat === 'id') return true;
  if (cat === 'wealth' || cat === 'assets' || cat === 'spending') return true;
  // LinkedIn is sensitive only as a CV/résumé PDF (name-bearing document);
  // a plain profile URL or screenshot is not.
  if (cat === 'linkedin' && mimeTypes.some((m) => m === 'application/pdf')) return true;
  return false;
}

function toBuffer(item: CaptureItem): Buffer | null {
  if (item.bytes) return Buffer.from(item.bytes as any);
  if (item.base64) {
    // Tolerate an optional `data:<mime>;base64,` prefix.
    const b64 = item.base64.replace(/^data:[^;]*;base64,/, '');
    try { return Buffer.from(b64, 'base64'); } catch { return null; }
  }
  return null;
}

/**
 * Capture uploads for admin review. Never throws; safe to `await` inline.
 */
export async function captureUploads(input: CaptureInput): Promise<void> {
  try {
    const { userId, source, verdict } = input;
    const category = input.category ?? '';
    const matchId = input.matchId || null;

    // Normalize files + items into a single list of { item, file } entries.
    const fileEntries = (input.files ?? []).map((f) => ({ file: f, item: null as CaptureItem | null }));
    const itemEntries = (input.items ?? []).map((i) => ({ file: null as File | null, item: i }));
    const entries = [...fileEntries, ...itemEntries];
    if (entries.length === 0) return;

    const mimeTypes = entries.map((e) =>
      e.file ? e.file.type : (e.item?.mimeType ?? ''),
    );
    const sensitive = input.sensitive ?? isSensitiveUpload(source, category, mimeTypes);

    const db = getSupabase() as any;
    const ts = Date.now();
    const expiresAt = new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    for (let i = 0; i < entries.length; i++) {
      const { file, item } = entries[i];
      const mimeType = file ? file.type : (item?.mimeType ?? '');
      const fileName = file ? (file.name || '') : (item?.name ?? '');
      const existingUrl = item?.existingUrl ?? null;

      let sizeBytes = file ? file.size : (item?.sizeBytes ?? 0);
      let storagePath: string | null = null;
      let bytesStored = false;

      if (!sensitive) {
        if (existingUrl) {
          // Surface already persists this file publicly — just reference it.
          bytesStored = true;
        } else {
          // Upload the raw bytes to the private audit bucket.
          const buf = file
            ? Buffer.from(await file.arrayBuffer())
            : item
              ? toBuffer(item)
              : null;
          if (buf && buf.length > 0) {
            if (!sizeBytes) sizeBytes = buf.length;
            const ext = MIME_TO_EXT[mimeType] ?? 'bin';
            const path = `audit/${userId ?? 'unknown'}/${source}/${category || 'misc'}/${ts}_${i}.${ext}`;
            const { error: upErr } = await db.storage
              .from(AUDIT_BUCKET)
              .upload(path, buf, { contentType: mimeType || 'application/octet-stream', upsert: true });
            if (!upErr) {
              storagePath = path;
              bytesStored = true;
            } else {
              console.warn('[upload-audit] bucket upload failed (non-fatal):', upErr?.message ?? upErr);
            }
          }
        }
      }

      const { error: insErr } = await db.from('upload_audit').insert({
        user_id: userId,
        source,
        category,
        is_sensitive: sensitive,
        bytes_stored: bytesStored,
        storage_path: storagePath,
        existing_url: sensitive ? null : existingUrl,
        file_name: fileName,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        verified: verdict?.verified ?? null,
        ai_result: verdict?.result ?? null,
        match_id: matchId,
        expires_at: expiresAt,
      });
      if (insErr) console.warn('[upload-audit] row insert failed (non-fatal):', insErr?.message ?? insErr);
    }
  } catch (e) {
    console.warn('[upload-audit] capture failed (non-fatal):', e);
  }
}
