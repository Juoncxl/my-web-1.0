import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CREATOR_MEDIA_MAX_ITEMS,
  addMediaItem,
  cloneMediaDraft,
  createMediaDraftFromLegacy,
  createMediaItem,
  getCoverMedia,
  isSupportedCreatorGlobalMediaFile,
  mediaDraftToPreviewImages,
  removeMediaItem,
  replaceMediaItem,
  reorderMediaItem,
  setMediaItemDimensions,
  setCoverMedia,
  type CreatorMediaDraft
} from './creatorMediaModel';

const source = readFileSync(new URL('./CreatorMediaCollection.tsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('./CreatorWorkWorkspace.tsx', import.meta.url), 'utf8');
const canvasSource = readFileSync(new URL('./CreatorContentCanvas.tsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const mediaStyles = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

function draftWith(...items: ReadonlyArray<readonly [string, string, 'image' | 'gif']>): CreatorMediaDraft {
  return { items: items.map(([id, src, kind]) => ({ id, src, kind })), coverId: null };
}

describe('Creator Composer unified media draft', () => {
  it('starts with zero global media and the calm empty-state copy', () => {
    expect(createMediaDraftFromLegacy({})).toEqual({ items: [], coverId: null });
    expect(source).toContain('ยังไม่มีสื่อในผลงาน');
    expect(source).toContain('เพิ่มรูปเพื่อใช้เป็นภาพปกหรือแกลเลอรีของผลงาน');
  });

  it('accepts static images for new global media while preserving legacy GIF records', () => {
    const image = createMediaItem('data:image/png;base64,image', 'image/png', 'one');
    const gif = createMediaItem('data:image/gif;base64,gif', 'image/gif', 'two');
    const next = addMediaItem(addMediaItem({ items: [], coverId: null }, image), gif);
    expect(next.items.map(item => item.kind)).toEqual(['image', 'gif']);
    expect(isSupportedCreatorGlobalMediaFile({ type: 'image/png', size: 100 })).toBe(true);
    expect(isSupportedCreatorGlobalMediaFile({ type: 'image/gif', size: 100 })).toBe(false);
    expect(source).toContain('สื่อ ${countLabel}');
    expect(source).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(source).not.toContain('เพิ่มรูป / GIF');
    expect(workspaceSource).toContain('accept="image/png,image/jpeg,image/webp,image/gif"');
  });

  it('uses the existing six-item global media limit and rejects additional items', () => {
    let draft = draftWith(...Array.from({ length: CREATOR_MEDIA_MAX_ITEMS }, (_, index) => [`${index}`, `data:image/png;base64,${index}`, 'image'] as const));
    draft = addMediaItem(draft, createMediaItem('data:image/png;base64,extra', 'image/png', 'extra'));
    expect(draft.items).toHaveLength(CREATOR_MEDIA_MAX_ITEMS);
    expect(source).toContain('CREATOR_MEDIA_MAX_ITEMS');
    expect(workspaceSource).toContain('CREATOR_MEDIA_MAX_ITEMS');
  });

  it('selects exactly one item as cover and allows changing it', () => {
    const draft = draftWith(['one', 'one', 'image'], ['two', 'two', 'image']);
    const first = setCoverMedia(draft, 'one');
    const second = setCoverMedia(first, 'two');
    expect(first.coverId).toBe('one');
    expect(second.coverId).toBe('two');
    expect(getCoverMedia(second)?.src).toBe('two');
    expect(source).toContain('ตั้งเป็นภาพปก');
    expect(source).toContain('>ภาพปก</span>');
    expect(source).toContain('csp-media-action-menu');
    expect(source).toContain('ตั้งเป็นภาพปก');
  });

  it('does not let SVG clicks on the overflow menu start pointer dragging', () => {
    expect(source).toContain('target instanceof Element');
    expect(source).not.toContain('target instanceof HTMLElement');
    expect(source).toContain("target.closest('button, summary, input')");
  });

  it('keeps one controlled action menu open and closes it on outside click or Escape', () => {
    expect(source).toContain('const [openMenuId, setOpenMenuId] = useState<string | null>(null)');
    expect(source).toContain("previous === item.id ? null : item.id");
    expect(source).toContain("document.addEventListener('pointerdown', closeOnOutsidePointer)");
    expect(source).toContain("document.removeEventListener('pointerdown', closeOnOutsidePointer)");
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain('aria-expanded={openMenuId === item.id}');
    expect(source).toContain('role="menu"');
  });

  it('removes non-cover media without affecting the cover', () => {
    const draft = setCoverMedia(draftWith(['one', 'one', 'image'], ['two', 'two', 'image']), 'one');
    const next = removeMediaItem(draft, 'two');
    expect(next.items.map(item => item.id)).toEqual(['one']);
    expect(next.coverId).toBe('one');
  });

  it('removing the current cover clears cover selection instead of choosing another item', () => {
    const draft = setCoverMedia(draftWith(['one', 'one', 'image'], ['two', 'two', 'image']), 'one');
    const next = removeMediaItem(draft, 'one');
    expect(next.coverId).toBeNull();
    expect(getCoverMedia(next)).toBeNull();
  });

  it('replaces an item in place and keeps cover state when the item is the cover', () => {
    const draft = setCoverMedia(draftWith(['one', 'one', 'image'], ['two', 'two', 'image']), 'one');
    const next = replaceMediaItem(draft, 'one', createMediaItem('new', 'image/png', 'replacement-id'));
    expect(next.items.map(item => item.src)).toEqual(['new', 'two']);
    expect(next.items[0].kind).toBe('image');
    expect(next.items[0].id).toBe('one');
    expect(next.coverId).toBe('one');
    expect(source).toContain('แทนที่');
  });

  it('reorders through pointer drag without visible arrow controls', () => {
    const draft = draftWith(['one', 'one', 'image'], ['two', 'two', 'image'], ['three', 'three', 'image']);
    expect(reorderMediaItem(draft, 'three', 'one').items.map(item => item.id)).toEqual(['three', 'one', 'two']);
    expect(source).toContain('onPointerDown');
    expect(source).toContain('onPointerMove');
    expect(source).toContain('onPointerUp');
    expect(source).toContain('const renderedItems = draggingItemId && dragTargetId');
    expect(source).toContain('reorderMediaItem(draft, draggingItemId, dragTargetId).items');
    expect(source).not.toContain('ChevronLeft');
    expect(source).not.toContain('ChevronRight');
    expect(source).not.toContain('รายการที่');
  });

  it('normalizes a legacy cover/gallery without losing the legacy cover', () => {
    const draft = createMediaDraftFromLegacy({
      previewImage: 'cover',
      previewImages: ['gallery-one', 'cover', 'gallery-two']
    });
    expect(draft.items.map(item => item.src)).toEqual(['gallery-one', 'cover', 'gallery-two']);
    expect(getCoverMedia(draft)?.src).toBe('cover');
    expect(appSource).toContain('serializeCreatorWorkDraft');
    expect(readFileSync(new URL('./creatorWorkSerializer.ts', import.meta.url), 'utf8')).toContain("previewImage: draft.coverImage || ''");
  });

  it('keeps media order and cover selection immutable across updates', () => {
    const draft = setCoverMedia(draftWith(['one', 'one', 'image'], ['two', 'two', 'image']), 'two');
    const moved = reorderMediaItem(draft, 'two', 'one');
    expect(draft.items.map(item => item.id)).toEqual(['one', 'two']);
    expect(moved.items.map(item => item.id)).toEqual(['two', 'one']);
    expect(moved.coverId).toBe('two');
    expect(cloneMediaDraft(draft)).not.toBe(draft);
  });

  it('records natural image dimensions without changing the original source', () => {
    const draft = draftWith(['portrait', 'portrait-source', 'image'], ['landscape', 'landscape-source', 'image']);
    const next = setMediaItemDimensions(setMediaItemDimensions(draft, 'portrait', 800, 1200), 'landscape', 1600, 900);
    expect(next.items.map(item => [item.src, item.naturalWidth, item.naturalHeight])).toEqual([
      ['portrait-source', 800, 1200],
      ['landscape-source', 1600, 900]
    ]);
    expect(source).toContain('naturalWidth');
    expect(source).toContain('naturalHeight');
  });

  it('uses responsive masonry columns and renders the full source without destructive thumbnail cropping', () => {
    expect(mediaStyles).toContain('columns: 4 11rem');
    expect(mediaStyles).toContain('columns: 3 10rem');
    expect(mediaStyles).toContain('columns: 2 0');
    expect(mediaStyles).toContain('height: auto; max-height: 26rem; object-fit: contain');
    expect(mediaStyles).toContain('aspect-ratio: auto');
  });

  it('keeps Image Prompt example images separate from global media', () => {
    expect(canvasSource).toContain('รูปตัวอย่าง');
    expect(canvasSource).not.toContain('CreatorMediaCollection');
    expect(workspaceSource).toContain('mediaDraft');
  });

  it('keeps unified media draft outside the Media tab branch for tab switching', () => {
    expect(workspaceSource).toContain('useState<CreatorMediaDraft>');
    expect(workspaceSource).toContain('setMediaDraft(draft.mediaDraft)');
    expect(workspaceSource).toContain("{section === 'media' && <CreatorMediaCollection");
  });

  it('does not alter the accepted D.3 Content Canvas contract', () => {
    expect(workspaceSource).toContain('<CreatorContentCanvas');
    expect(workspaceSource).toContain('contentCanvas');
    expect(canvasSource).toContain('SandboxedCodePreview');
    expect(canvasSource).toContain('โทเคนโดยประมาณ');
  });
});
