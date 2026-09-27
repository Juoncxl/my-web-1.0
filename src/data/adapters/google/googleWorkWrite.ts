import type { Asset } from '../../../types';
import type { WorkUpdateOptions } from '../../cxlDataService';

/** Mirrors the explicit Owner GAS write contract. Read/runtime fields never cross it. */
export const GOOGLE_WORK_UPDATE_FIELDS = [
  'authorName', 'authorAvatar', 'title', 'icon', 'category', 'shortDescription',
  'contentTypeLabels', 'contentTypes', 'presentationMetadata', 'publicCollaboration',
  'collaborationAssetId', 'contentBlocks', 'content', 'uiCodeSnippet', 'previewImage',
  'previewImages', 'folderId', 'isPublic', 'visibility', 'status', 'tags',
  'linkedAssetIds', 'deletedAt', 'likesCount', 'forkCount', 'forkedFromId',
  'forkedFromAuthor', 'versions', 'media', 'collaboration'
] as const satisfies readonly (keyof Asset)[];

const writableFields = new Set<string>(GOOGLE_WORK_UPDATE_FIELDS);
const serverOwnedFields = new Set(['id', 'userId', 'revision', 'publicCreatorId', 'qaStorageKey', 'createdAt', 'updatedAt']);

export function toGoogleWorkUpdateRequest(
  id: string,
  updates: Partial<Asset>,
  options?: WorkUpdateOptions
): [string, Partial<Asset>, WorkUpdateOptions | undefined] {
  const writable: Partial<Asset> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (writableFields.has(key)) {
      (writable as Record<string, unknown>)[key] = value;
    } else if (!serverOwnedFields.has(key)) {
      throw new Error(`Google Work update contains unsupported field: ${key}`);
    }
  }

  // Some legacy/full-Asset callers provide revision on the record. Promote it
  // to the concurrency option while keeping it out of the Work payload.
  const expectedRevision = options?.expectedRevision ?? updates.revision;
  const normalizedOptions = options || expectedRevision !== undefined
    ? { ...options, ...(expectedRevision !== undefined ? { expectedRevision } : {}) }
    : undefined;
  return [id, writable, normalizedOptions];
}
