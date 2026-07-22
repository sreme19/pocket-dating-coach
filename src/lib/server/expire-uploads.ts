import { getSupabase } from '$lib/server/supabase';

const AUDIT_BUCKET = 'upload-audit';
const BATCH = 500;

export interface ExpireUploadsReport {
  rowsDeleted: number;
  objectsDeleted: number;
}

/**
 * Retention sweep for captured uploads. Deletes `upload_audit` rows past their
 * `expires_at` (90-day window) and removes any bytes they hold in the private
 * `upload-audit` bucket. Idempotent — safe to re-run.
 */
export async function runExpireUploads(): Promise<ExpireUploadsReport> {
  const db = getSupabase() as any;
  const nowIso = new Date().toISOString();

  let rowsDeleted = 0;
  let objectsDeleted = 0;

  // Process in batches so a large backlog doesn't blow memory / statement limits.
  for (;;) {
    const { data: rows, error } = await db
      .from('upload_audit')
      .select('id, storage_path')
      .lt('expires_at', nowIso)
      .limit(BATCH);
    if (error) throw new Error(error.message ?? String(error));
    if (!rows || rows.length === 0) break;

    const paths = rows.map((r: any) => r.storage_path).filter((p: any): p is string => !!p);
    if (paths.length > 0) {
      const { error: rmErr } = await db.storage.from(AUDIT_BUCKET).remove(paths);
      if (rmErr) console.warn('[expire-uploads] bucket remove failed (continuing):', rmErr?.message ?? rmErr);
      else objectsDeleted += paths.length;
    }

    const ids = rows.map((r: any) => r.id);
    const { error: delErr } = await db.from('upload_audit').delete().in('id', ids);
    if (delErr) throw new Error(delErr.message ?? String(delErr));
    rowsDeleted += ids.length;

    if (rows.length < BATCH) break;
  }

  return { rowsDeleted, objectsDeleted };
}
