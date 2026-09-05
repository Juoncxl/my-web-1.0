import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  addBotCustomField,
  approximateTokenCount,
  countThaiCharacters,
  createBlankContentCanvasDraft,
  cloneContentCanvasDraft,
  getContentEditorValue,
  getSelectedContentTypes,
  removeBotCustomField,
  updateBotCustomFieldTitle,
  updateContentEditorValue,
  updateImagePromptExamples,
  updateImagePromptToolModel,
  type CreatorContentCanvasDraft
} from './creatorContentModel';

const canvasSource = readFileSync(new URL('./CreatorContentCanvas.tsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('./CreatorWorkWorkspace.tsx', import.meta.url), 'utf8');

function blank(): CreatorContentCanvasDraft {
  return createBlankContentCanvasDraft();
}

describe('CreatorContentCanvas dynamic draft model', () => {
  it('returns an empty Content Canvas selection when no content types are selected', () => {
    expect(getSelectedContentTypes([])).toEqual([]);
    expect(canvasSource).toContain('ยังไม่ได้เลือกประเภทเนื้อหา');
    expect(canvasSource).toContain('ไปเลือกประเภทเนื้อหา');
  });

  it('renders exactly one section for one selected type', () => {
    expect(getSelectedContentTypes(['character'])).toEqual(['character']);
  });

  it('renders multiple selected sections in the canonical order', () => {
    expect(getSelectedContentTypes(['bot_prompt', 'image_prompt', 'character'])).toEqual(['character', 'image_prompt', 'bot_prompt']);
  });

  it('does not create duplicate sections from duplicate source values', () => {
    expect(getSelectedContentTypes(['story' as never, 'character', 'character', 'character'])).toEqual(['character']);
  });

  it('hides a deselected section without changing the remaining selection', () => {
    const selected = ['character', 'lore'] as const;
    expect(getSelectedContentTypes(selected.filter(type => type !== 'lore'))).toEqual(['character']);
  });

  it('preserves a hidden section draft so it returns when reselected', () => {
    const written = updateContentEditorValue(blank(), 'story', 'ประวัติโลกที่เขียนไว้');
    expect(getSelectedContentTypes(['character'])).toEqual(['character']);
    expect(getContentEditorValue(written, 'story')).toEqual({ title: 'เนื้อเรื่อง / โลกทัศน์', value: 'ประวัติโลกที่เขียนไว้' });
  });

  it('updates the Character long-form editor in the draft', () => {
    const updated = updateContentEditorValue(blank(), 'character', 'บุคลิกและความสัมพันธ์');
    expect(updated.character).toBe('บุคลิกและความสัมพันธ์');
  });

  it('updates the Story long-form editor in the draft', () => {
    const updated = updateContentEditorValue(blank(), 'story', 'พล็อตและกฎของโลก');
    expect(updated.story).toBe('พล็อตและกฎของโลก');
  });

  it('uses one flexible Image Prompt tool/model field without the chatbot platform picker', () => {
    const original = blank();
    const withToolModel = updateImagePromptToolModel(original, 'TensorArt — Z-Image Turbo');
    const withImages = updateImagePromptExamples(withToolModel, ['data:image/png;base64,one']);
    expect(original.imagePrompt.toolModel).toBe('');
    expect(withImages.imagePrompt).toEqual({ toolModel: 'TensorArt — Z-Image Turbo', prompt: '', exampleImages: ['data:image/png;base64,one'] });
    expect(canvasSource).toContain('เครื่องมือ / โมเดลที่ใช้');
    expect(canvasSource).toContain('TensorArt — Z-Image Turbo, ChatGPT, Gemini');
    expect(canvasSource).not.toContain('แอปที่ใช้');
    expect(canvasSource).not.toContain('platformOptions');
    expect(canvasSource).not.toContain('appPlatforms');
  });

  it('starts the Bot Prompt section with one blank custom field and no fixed fields', () => {
    const initial = blank();
    expect(initial.botPrompt.customFields).toHaveLength(1);
    expect(initial.botPrompt.customFields[0]).toMatchObject({ title: '', value: '' });
    expect(canvasSource).toContain('placeholder="ช่องข้อมูลใหม่"');
    expect(canvasSource).toContain('label="เนื้อหา"');
    expect(canvasSource).not.toContain('editorId="bot-front"');
    expect(canvasSource).not.toContain('editorId="bot-back"');
    expect(canvasSource).not.toContain('editorId="bot-ooc"');
    expect(canvasSource).not.toContain('editorId="bot-extra"');
  });

  it('renames, edits, adds, and removes flexible Bot fields', () => {
    let updated = blank();
    const firstId = updated.botPrompt.customFields[0].id;
    updated = updateBotCustomFieldTitle(updated, firstId, 'กติกาเพิ่มเติม');
    updated = updateContentEditorValue(updated, `bot-custom:${firstId}`, 'ข้อมูลใหม่');
    updated = addBotCustomField(updated, { id: 'custom-2', title: '', value: '' });
    expect(getContentEditorValue(updated, `bot-custom:${firstId}`)).toEqual({ title: 'กติกาเพิ่มเติม', value: 'ข้อมูลใหม่' });
    expect(updated.botPrompt.customFields).toHaveLength(2);
    expect(removeBotCustomField(updated, 'custom-2').botPrompt.customFields).toHaveLength(1);
  });

  it('migrates populated D.3.0 fixed fields to custom fields without discarding in-session writing', () => {
    const legacyDraft = {
      ...blank(),
      botPrompt: { frontOfHouse: 'ข้อความเดิม', backOfHouse: 'คำสั่งเดิม', ooc: '', extra: '', customFields: [] }
    };
    const migrated = cloneContentCanvasDraft(legacyDraft);
    expect(migrated.botPrompt.customFields).toEqual([
      { id: 'legacy-frontOfHouse', title: 'ข้อมูล / ข้อความหน้าบ้าน', value: 'ข้อความเดิม' },
      { id: 'legacy-backOfHouse', title: 'พรอมต์ / คำสั่งหลังบ้าน', value: 'คำสั่งเดิม' }
    ]);
  });

  it('keeps the custom field value available to Focus Editor and its counter', () => {
    let updated = blank();
    const fieldId = updated.botPrompt.customFields[0].id;
    updated = updateBotCustomFieldTitle(updated, fieldId, 'กติกาเพิ่มเติม');
    updated = updateContentEditorValue(updated, `bot-custom:${fieldId}`, 'ข้อความสำหรับ Focus Editor');
    expect(getContentEditorValue(updated, `bot-custom:${fieldId}`)?.value).toBe('ข้อความสำหรับ Focus Editor');
    expect(canvasSource).toContain('formatContentCounter');
  });

  it('uses the same value inside and outside Focus Editor', () => {
    const updated = updateContentEditorValue(blank(), 'character', 'ข้อความที่กำลังเขียน');
    const focused = getContentEditorValue(updated, 'character');
    expect(focused?.value).toBe('ข้อความที่กำลังเขียน');
    expect(updateContentEditorValue(updated, 'character', 'ข้อความหลังปิดโฟกัส').character).toBe('ข้อความหลังปิดโฟกัส');
    expect(canvasSource).toContain('data-focus-editor');
  });

  it('updates the Thai character counter for mixed text and emoji', () => {
    const short = countThaiCharacters('สวัสดี');
    const long = countThaiCharacters('สวัสดี 🌙 world');
    expect(short).toBeGreaterThan(0);
    expect(long).toBeGreaterThan(short);
    expect(canvasSource).toContain('formatContentCounter');
  });

  it('updates the clearly approximate token counter deterministically', () => {
    expect(approximateTokenCount('')).toBe(0);
    expect(approximateTokenCount('123456789')).toBe(3);
    expect(canvasSource).toContain('โทเคนโดยประมาณ');
  });

  it('keeps UI Code on the existing sandboxed preview component', () => {
    expect(canvasSource).toContain('SandboxedCodePreview');
    expect(canvasSource).toContain('ดูพรีวิวเต็ม');
    expect(canvasSource).toContain("['code', 'split', 'preview']");
    expect(workspaceSource).toContain('SandboxedCodePreview');
  });

  it('keeps Content Canvas state outside tab-specific render branches', () => {
    expect(workspaceSource).toContain('useState<CreatorContentCanvasDraft>');
    expect(workspaceSource).toContain('setContentCanvas(draft.contentCanvas)');
    expect(workspaceSource).toContain('{section === \'content\' && <CreatorContentCanvas');
  });

  it('keeps custom Bot fields in the same draft state while Composer tabs switch', () => {
    const initial = blank();
    const savedAcrossTabs = updateContentEditorValue(initial, `bot-custom:${initial.botPrompt.customFields[0].id}`, 'ข้อความที่ต้องอยู่ต่อ');
    expect(savedAcrossTabs.botPrompt.customFields[0].value).toBe('ข้อความที่ต้องอยู่ต่อ');
    expect(workspaceSource).toContain('contentCanvas');
  });
});
