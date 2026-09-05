import { describe, expect, it } from 'vitest';
import { createBlankContentCanvasDraft, createContentCanvasDraftFromLegacy, type CreatorContentCanvasDraft } from './creatorContentModel';
import { createCreatorReviewAsset, getCreatorReviewMissingNotices, type CreatorReviewDraftInput } from './creatorReviewModel';

function reviewInput(overrides: Partial<CreatorReviewDraftInput> = {}): CreatorReviewDraftInput {
  const contentCanvas: CreatorContentCanvasDraft = {
    ...createBlankContentCanvasDraft(),
    character: 'CHARACTER BODY',
    story: 'STORY BODY',
    imagePrompt: { prompt: 'IMAGE PROMPT', toolModel: 'MODEL NAME', exampleImages: ['example-image'] },
    uiCode: '<div>SAFE UI</div>',
    botPrompt: { customFields: [{ id: 'custom-one', title: 'คำสั่ง OOC', value: 'OOC BODY' }] }
  };
  return {
    title: 'Draft title', category: 'prompts', contentTypes: ['character', 'lore', 'image_prompt', 'ui_code', 'bot_prompt'], workMode: 'standard', description: 'Draft description', visibility: 'private', status: 'in_progress', folderId: null,
    icon: { type: 'emoji', value: '🌙' }, media: [{ src: 'gallery-one' }, { src: 'cover-image' }, { src: 'gallery-two' }], coverImage: 'cover-image', tags: ['tag-one'], contentCanvas, ...overrides
  };
}

describe('Creator Review draft-to-presentation adapter', () => {
  it('hydrates modern content blocks into their original editors instead of one legacy field', () => {
    const draft = createContentCanvasDraftFromLegacy({
      category: 'prompts',
      content: '',
      contentBlocks: [
        { id: 'creator-character', type: 'Text', title: 'ข้อมูลตัวละคร', body: 'CHARACTER' },
        { id: 'creator-story', type: 'Text', title: 'เนื้อเรื่องและโลกทัศน์', body: 'STORY' },
        { id: 'creator-image-prompt', type: 'Prompt', title: 'คำสั่งเจนรูป', body: 'PROMPT' },
        { id: 'creator-image-tool-model', type: 'Note', title: 'เครื่องมือ / โมเดลที่ใช้', body: 'MODEL' },
        { id: 'creator-bot-ooc', type: 'Text', title: 'OOC', body: 'OOC' },
        { id: 'creator-ui-code', type: 'UI Code', title: 'โค้ดหน้า UI', body: '<div />' }
      ],
      uiCodeSnippet: '<div />'
    });
    expect(draft.character).toBe('CHARACTER');
    expect(draft.story).toBe('STORY');
    expect(draft.imagePrompt.prompt).toBe('PROMPT');
    expect(draft.imagePrompt.toolModel).toBe('MODEL');
    expect(draft.botPrompt.customFields).toEqual([expect.objectContaining({ title: 'OOC', value: 'OOC' })]);
    expect(draft.uiCode).toBe('<div />');
  });

  it('splits legacy serialized headings while preserving unknown sections as custom fields', () => {
    const draft = createContentCanvasDraftFromLegacy({
      category: 'prompts',
      content: '## ข้อมูลตัวละคร\nCHARACTER\n\n## เนื้อเรื่องและโลกทัศน์\nSTORY\n\n## ช่องพิเศษ\nEXTRA'
    });
    expect(draft.character).toBe('CHARACTER');
    expect(draft.story).toBe('STORY');
    expect(draft.botPrompt.customFields).toEqual([expect.objectContaining({ title: 'ช่องพิเศษ', value: 'EXTRA' })]);
  });

  it('creates a presentation-shaped Asset from current draft values without mutating draft data', () => {
    const input = reviewInput();
    const asset = createCreatorReviewAsset(input, { id: 'user-1', displayName: 'Creator', avatarUrl: 'avatar', createdAt: '2026-01-01' });
    expect(asset.title).toBe('Draft title');
    expect(asset.shortDescription).toBe('Draft description');
    expect(asset.icon).toEqual({ type: 'emoji', value: '🌙' });
    expect(asset.previewImage).toBe('cover-image');
    expect(asset.previewImages).toEqual(['cover-image', 'gallery-one', 'gallery-two']);
    expect(asset.contentTypes).toEqual(['character', 'lore', 'image_prompt', 'ui_code', 'bot_prompt']);
    expect(asset.contentTypeLabels).toEqual([
      '👤 โปรไฟล์ / ประวัติตัวละคร',
      '📖 เนื้อเรื่อง / โลกทัศน์',
      '🎨 พรอมต์เจนรูป',
      '💻 โค้ดหน้า UI',
      '🧩 พรอมต์ / OOC / เทมเพลตบอท'
    ]);
    expect(input.media.map(item => item.src)).toEqual(['gallery-one', 'cover-image', 'gallery-two']);
  });

  it('renders only selected content types and omits deselected sections', () => {
    const asset = createCreatorReviewAsset({ ...reviewInput(), contentTypes: ['character', 'image_prompt'] });
    expect(asset.contentBlocks.map(block => block.id)).toEqual([
      'creator-character', 'creator-image-prompt', 'creator-image-tool-model', 'creator-image-example-0'
    ]);
    expect(asset.contentBlocks.some(block => block.id === 'creator-story')).toBe(false);
    expect(asset.contentBlocks.some(block => block.id === 'creator-ui-code')).toBe(false);
    expect(asset.contentBlocks.some(block => block.id === 'creator-bot-custom-one')).toBe(false);
  });

  it('presents Character, Story, Image Prompt, UI Code, and custom bot fields as readable blocks', () => {
    const asset = createCreatorReviewAsset(reviewInput());
    expect(asset.contentBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'creator-character', body: 'CHARACTER BODY' }),
      expect.objectContaining({ id: 'creator-story', body: 'STORY BODY' }),
      expect.objectContaining({ id: 'creator-image-prompt', type: 'Prompt', body: 'IMAGE PROMPT' }),
      expect.objectContaining({ id: 'creator-image-tool-model', type: 'Note', body: 'MODEL NAME' }),
      expect.objectContaining({ id: 'creator-image-example-0', type: 'Image', body: 'example-image' }),
      expect.objectContaining({ id: 'creator-ui-code', type: 'UI Code', body: '<div>SAFE UI</div>' }),
      expect.objectContaining({ id: 'creator-bot-custom-one', title: 'คำสั่ง OOC', body: 'OOC BODY' })
    ]));
  });

  it('keeps selected cover separate from source media and reports only lightweight missing notices', () => {
    const asset = createCreatorReviewAsset({ ...reviewInput(), coverImage: '' });
    expect(asset.previewImages).toEqual(['gallery-one', 'cover-image', 'gallery-two']);
    expect(getCreatorReviewMissingNotices({ title: '', coverImage: '' })).toEqual(['ยังไม่ได้ตั้งชื่อผลงาน', 'ยังไม่ได้เลือกภาพปก']);
    expect(getCreatorReviewMissingNotices({ title: 'Ready', coverImage: 'cover-image' })).toEqual([]);
  });
});
