import type { Asset } from '../types';
import type { FetchAssetsOptions } from '../lib/supabaseService';
import { supabaseDataAdapter } from './adapters/supabase/supabaseDataAdapter';
import { googleDataAdapter } from './adapters/google/googleDataAdapter';

const meta = (import.meta as ImportMeta & { env?: { DEV?: boolean; MODE?: string } }).env;
export type ShadowDifference = { id?: string; field: string; supabase: unknown; google: unknown };
export type WorksShadowResult = { supabaseCount: number; googleCount: number; equal: boolean; differences: ShadowDifference[] };

function stableMediaReferences(asset: Asset): unknown {
  const refs: string[] = [];
  const add = (value?: string, explicitId?: string) => {
    if (explicitId) refs.push(`media:${explicitId}`);
    else if (value?.startsWith('media:')) refs.push(value);
    else if (value) {
      const match = (asset.media || []).find(item => item.signedUrl === value || item.storagePath === value);
      refs.push(match ? `media:${match.id}` : value);
    }
  };
  add(asset.icon?.value, asset.icon?.mediaId);
  add(asset.previewImage);
  (asset.previewImages || []).forEach(value => add(value));
  (asset.contentBlocks || []).filter(block => block.type === 'Image').forEach(block => add(block.body, block.mediaId));
  (asset.media || []).slice().sort((a, b) => a.purpose.localeCompare(b.purpose) || a.sortOrder - b.sortOrder).forEach(item => refs.push(`media:${item.id}:${item.purpose}:${item.contextId || ''}:${item.sortOrder}:${item.isCover}`));
  return refs;
}

function compareAssetFields(left: Asset, right: Asset, differences: ShadowDifference[]) {
  const fields: Array<[string, unknown, unknown]> = [
    ['title', left.title, right.title], ['category', left.category, right.category], ['status', left.status, right.status],
    ['visibility', left.visibility, right.visibility], ['isPublic', left.isPublic, right.isPublic],
    ['authorName', left.authorName, right.authorName], ['authorAvatar', left.authorAvatar, right.authorAvatar], ['shortDescription', left.shortDescription, right.shortDescription],
    ['icon.type', left.icon?.type, right.icon?.type],
    ['folderId', left.folderId || null, right.folderId || null],
    ['tags', left.tags || [], right.tags || []], ['contentTypeLabels', left.contentTypeLabels || [], right.contentTypeLabels || []],
    ['contentTypes', left.contentTypes || [], right.contentTypes || []],
    ['publicCollaboration', left.publicCollaboration || null, right.publicCollaboration || null],
    ['collaboration', left.collaboration || null, right.collaboration || null],
    ['mediaReferences', stableMediaReferences(left), stableMediaReferences(right)],
    ['content', left.content, right.content], ['contentBlocks', left.contentBlocks, right.contentBlocks], ['uiCodeSnippet', left.uiCodeSnippet, right.uiCodeSnippet],
    ['presentationMetadata', left.presentationMetadata, right.presentationMetadata],
    ['linkedAssetIds', left.linkedAssetIds || [], right.linkedAssetIds || []], ['versions', left.versions || [], right.versions || []],
    ['createdAt', left.createdAt, right.createdAt], ['updatedAt', left.updatedAt, right.updatedAt], ['deletedAt', left.deletedAt || null, right.deletedAt || null],
    ['collaborationAssetId', left.collaborationAssetId || null, right.collaborationAssetId || null],
    ['likesCount', left.likesCount || 0, right.likesCount || 0], ['forkCount', left.forkCount || 0, right.forkCount || 0],
    ['forkedFromId', left.forkedFromId || null, right.forkedFromId || null], ['forkedFromAuthor', left.forkedFromAuthor || null, right.forkedFromAuthor || null]
  ];
  fields.forEach(([field, supabase, google]) => {
    if (JSON.stringify(supabase) !== JSON.stringify(google)) differences.push({ id: left.id, field, supabase, google });
  });
  const known = new Set(['id','userId','authorName','authorAvatar','title','icon','category','shortDescription','contentTypeLabels','contentTypes','presentationMetadata','publicCollaboration','collaborationAssetId','collaboration','contentBlocks','content','uiCodeSnippet','previewImage','previewImages','media','folderId','isPublic','visibility','status','tags','createdAt','updatedAt','deletedAt','likesCount','forkCount','forkedFromId','forkedFromAuthor','linkedAssetIds','versions']);
  const unknownFields = (asset: Asset) => Object.fromEntries(Object.entries(asset as unknown as Record<string, unknown>).filter(([key]) => !known.has(key)));
  if (JSON.stringify(unknownFields(left)) !== JSON.stringify(unknownFields(right))) differences.push({ id: left.id, field: 'unknownFields', supabase: unknownFields(left), google: unknownFields(right) });
}

/** Read-only, opt-in comparison. It cannot be called in a production build. */
export async function compareWorksRead(options: FetchAssetsOptions = {}): Promise<WorksShadowResult> {
  if (!meta?.DEV && meta?.MODE !== 'test') throw new Error('Works shadow comparison is available only in development and tests');
  const [supabaseResult, googleResult] = await Promise.all([
    supabaseDataAdapter.works.fetch(options), googleDataAdapter.works.fetch(options)
  ]);
  const differences: ShadowDifference[] = [];
  if (supabaseResult.error) differences.push({ field: 'supabase.error', supabase: supabaseResult.error, google: googleResult.error });
  if (googleResult.error) differences.push({ field: 'google.error', supabase: supabaseResult.error, google: googleResult.error });
  const supabaseWorks = supabaseResult.data || [];
  const googleWorks = googleResult.data || [];
  if (supabaseWorks.length !== googleWorks.length) differences.push({ field: 'count', supabase: supabaseWorks.length, google: googleWorks.length });
  const supabaseIds = supabaseWorks.map(work => work.id);
  const googleIds = googleWorks.map(work => work.id);
  if (JSON.stringify(supabaseIds) !== JSON.stringify(googleIds)) differences.push({ field: 'orderedIds', supabase: supabaseIds, google: googleIds });
  const byId = new Map<string, Asset>(googleWorks.map(work => [work.id, work] as [string, Asset]));
  supabaseWorks.forEach(work => {
    const other = byId.get(work.id);
    if (!other) differences.push({ id: work.id, field: 'missingGoogleWork', supabase: true, google: false });
    else compareAssetFields(work, other, differences);
  });
  return { supabaseCount: supabaseWorks.length, googleCount: googleWorks.length, equal: differences.length === 0, differences };
}
