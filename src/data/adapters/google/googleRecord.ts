import type { Asset } from '../../../types';

export type GoogleStoredWork = {
  schemaVersion: number;
  revision: number;
  row: Record<string, unknown>;
  mediaRecords: Array<Record<string, unknown>>;
  collaborationDraft?: unknown;
  cxlAsset?: Record<string, unknown>;
  [key: string]: unknown;
};

/** Keep the complete CXL record in Drive JSON; row remains the prototype's Sheet-index source. */
export function serializeGoogleWork(asset: Asset, existing?: GoogleStoredWork): GoogleStoredWork {
  const row = { ...(existing?.row || {}), id: asset.id, title: asset.title, category: asset.category,
    status: asset.status, visibility: asset.visibility, is_public: asset.isPublic,
    deleted_at: asset.deletedAt || null, folder_id: asset.folderId || null,
    tags: asset.tags, content: asset.content, content_blocks: asset.contentBlocks,
    presentation_metadata: asset.presentationMetadata, collaboration: asset.collaboration,
    public_collaboration: asset.publicCollaboration, linked_asset_ids: asset.linkedAssetIds,
    versions: asset.versions, preview_image: asset.previewImage, preview_images: asset.previewImages };
  return { ...(existing || {}), schemaVersion: existing?.schemaVersion || 2,
    revision: existing?.revision || 0, row, mediaRecords: existing?.mediaRecords || [],
    cxlAsset: JSON.parse(JSON.stringify(asset)) as Record<string, unknown> };
}

/** Prefer the full CXL snapshot; legacy prototype records retain their original conversion path. */
export function deserializeGoogleWork(record: GoogleStoredWork): Asset | null {
  return record.cxlAsset ? JSON.parse(JSON.stringify(record.cxlAsset)) as Asset : null;
}

const PRIVATE_FIELDS = new Set(['userId', 'authorEmail', 'email', 'contact', 'collaboration']);
export function projectGooglePublicWork(asset: Asset): Partial<Asset> {
  const publicCollaboration = asset.publicCollaboration || null;
  const output: Record<string, unknown> = {};
  Object.entries(asset).forEach(([key, value]) => {
    if (PRIVATE_FIELDS.has(key) || key === 'collaboration') return;
    if (key === 'publicCollaboration' && publicCollaboration) {
      output[key] = { ...publicCollaboration, participants: publicCollaboration.participants.map(person => {
        const { contact: _contact, ...safe } = person as typeof person & { contact?: string };
        return safe;
      }) };
    } else output[key] = value;
  });
  return output as Partial<Asset>;
}
