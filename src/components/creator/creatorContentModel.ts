export type CreatorContentType = 'character' | 'lore' | 'image_prompt' | 'ui_code' | 'bot_prompt';

export type CreatorContentCounterMode = 'characters' | 'tokens';

export type CreatorContentEditorId =
  | 'character'
  | 'story'
  | 'image-prompt'
  | 'ui-code'
  | 'bot-front'
  | 'bot-back'
  | 'bot-ooc'
  | 'bot-extra'
  | `bot-custom:${string}`;

export interface CreatorBotCustomField {
  id: string;
  title: string;
  value: string;
}

interface CreatorLegacyBotPromptFields {
  /** D.3 fixed-field shape retained only to migrate an already-open draft safely. */
  frontOfHouse?: string;
  backOfHouse?: string;
  ooc?: string;
  extra?: string;
}

export interface CreatorContentCanvasDraft {
  character: string;
  story: string;
  imagePrompt: {
    prompt: string;
    toolModel: string;
    /** D.3.0 in-session compatibility; never rendered as a separate model field. */
    model?: string;
    exampleImages: string[];
  };
  uiCode: string;
  botPrompt: CreatorLegacyBotPromptFields & {
    customFields: CreatorBotCustomField[];
  };
}

export interface CreatorContentTypeMeta {
  value: CreatorContentType;
  label: string;
  description: string;
}

export const CREATOR_CONTENT_TYPE_META: CreatorContentTypeMeta[] = [
  { value: 'character', label: '👤 โปรไฟล์ / ประวัติตัวละคร', description: 'ตัวละคร บุคลิก และข้อมูลเบื้องหลัง' },
  { value: 'lore', label: '📖 เนื้อเรื่อง / โลกทัศน์', description: 'ฉาก ประวัติศาสตร์ และกฎของโลก' },
  { value: 'image_prompt', label: '🎨 พรอมต์เจนรูป', description: 'พรอมต์สำหรับเจนรูป พร้อมข้อมูลเครื่องมือหรือโมเดลและรูปตัวอย่าง' },
  { value: 'ui_code', label: '💻 โค้ดหน้า UI', description: 'โค้ด HTML / CSS สำหรับหน้าจอ' },
  { value: 'bot_prompt', label: '🧩 พรอมต์ / OOC / เทมเพลตบอท', description: 'ช่องข้อมูลแบบยืดหยุ่นสำหรับตั้งค่าเนื้อหาของบอท' }
];

const VALID_CONTENT_TYPES = new Set<CreatorContentType>(CREATOR_CONTENT_TYPE_META.map(option => option.value));

export function createBlankContentCanvasDraft(): CreatorContentCanvasDraft {
  return {
    character: '',
    story: '',
    imagePrompt: { prompt: '', toolModel: '', exampleImages: [] },
    uiCode: '',
    botPrompt: { customFields: [createBlankBotCustomField()] }
  };
}

export function createBlankBotCustomField(): CreatorBotCustomField {
  return { id: `custom-${Date.now()}`, title: '', value: '' };
}

const LEGACY_BOT_FIELD_TITLES: Array<[keyof CreatorLegacyBotPromptFields, string]> = [
  ['frontOfHouse', 'ข้อมูล / ข้อความหน้าบ้าน'],
  ['backOfHouse', 'พรอมต์ / คำสั่งหลังบ้าน'],
  ['ooc', 'คำสั่ง OOC'],
  ['extra', 'เทมเพลต / ข้อมูลเพิ่มเติม']
];

function migrateLegacyBotFields(botPrompt: CreatorContentCanvasDraft['botPrompt']): CreatorBotCustomField[] {
  const customFields = botPrompt.customFields.map(field => ({ ...field }));
  LEGACY_BOT_FIELD_TITLES.forEach(([key, title]) => {
    const value = botPrompt[key]?.trim();
    if (value) customFields.push({ id: `legacy-${key}`, title, value });
  });
  return customFields;
}

export function cloneContentCanvasDraft(draft: CreatorContentCanvasDraft): CreatorContentCanvasDraft {
  return {
    character: draft.character,
    story: draft.story,
    imagePrompt: {
      prompt: draft.imagePrompt.prompt,
      toolModel: draft.imagePrompt.toolModel ?? draft.imagePrompt.model ?? '',
      exampleImages: [...draft.imagePrompt.exampleImages]
    },
    uiCode: draft.uiCode,
    botPrompt: {
      customFields: migrateLegacyBotFields(draft.botPrompt)
    }
  };
}

/** Keep legacy categories useful for old drafts while allowing an explicit [] selection. */
export function normalizeCreatorContentTypes(category: string, values?: CreatorContentType[]): CreatorContentType[] {
  const selected = [...new Set((values || []).filter(value => VALID_CONTENT_TYPES.has(value)))];
  if (values !== undefined) return selected;
  if (category === 'character') return ['character'];
  if (category === 'lore') return ['lore'];
  if (category === 'ui_code') return ['ui_code'];
  return ['bot_prompt'];
}

/** Render selected types in the canonical order, without duplicates. */
export function getSelectedContentTypes(values: readonly CreatorContentType[]): CreatorContentType[] {
  const selected = new Set(values.filter(value => VALID_CONTENT_TYPES.has(value)));
  return CREATOR_CONTENT_TYPE_META
    .map(option => option.value)
    .filter(value => selected.has(value));
}

export function createContentCanvasDraftFromLegacy(input: {
  category: string;
  content?: string;
  contentBlocks?: Array<{ id?: string; type: string; title?: string; body: string }>;
  uiCodeSnippet?: string;
}): CreatorContentCanvasDraft {
  const draft = createBlankContentCanvasDraft();
  const blocks = input.contentBlocks || [];
  const customFields: CreatorBotCustomField[] = [];
  const knownTitles: Record<string, keyof CreatorContentCanvasDraft> = {
    'ข้อมูลตัวละคร': 'character',
    'โปรไฟล์ / ประวัติตัวละคร': 'character',
    'เนื้อเรื่องและโลกทัศน์': 'story',
    'เนื้อเรื่อง / โลกทัศน์': 'story'
  };
  blocks.filter(block => block.type !== 'UI Code').forEach((block, index) => {
    const title = (block.title || '').trim();
    const body = block.body || '';
    if (!body.trim()) return;
    if (block.id === 'creator-character' || knownTitles[title] === 'character') draft.character = body;
    else if (block.id === 'creator-story' || knownTitles[title] === 'story') draft.story = body;
    else if (block.id === 'creator-image-prompt' || title === 'คำสั่งเจนรูป') draft.imagePrompt.prompt = body;
    else if (block.id === 'creator-image-tool-model' || title === 'เครื่องมือ / โมเดลที่ใช้') draft.imagePrompt.toolModel = body;
    else if (block.type === 'Image' || block.id?.startsWith('creator-image-example-')) draft.imagePrompt.exampleImages.push(body);
    else if (block.id?.startsWith('creator-bot-')) {
      if (!customFields.some(field => field.title === (title || 'ช่องข้อมูล') && field.value === body)) customFields.push({ id: block.id.slice('creator-bot-'.length) || `legacy-custom-${index}`, title: title || 'ช่องข้อมูล', value: body });
    } else if (!customFields.some(field => field.title === (title || 'ข้อมูลเดิม') && field.value === body)) customFields.push({ id: block.id || `legacy-custom-${index}`, title: title || 'ข้อมูลเดิม', value: body });
  });

  const headingSections = parseLegacyHeadingSections(input.content || '');
  headingSections.forEach(section => {
    const title = section.title.trim();
    const body = section.body.trim();
    if (!body) return;
    if (title === 'ข้อมูลตัวละคร' || title === 'โปรไฟล์ / ประวัติตัวละคร') draft.character ||= body;
    else if (title === 'เนื้อเรื่องและโลกทัศน์' || title === 'เนื้อเรื่อง / โลกทัศน์') draft.story ||= body;
    else if (title === 'คำสั่งเจนรูป') draft.imagePrompt.prompt ||= body;
    else if (title === 'เครื่องมือ / โมเดลที่ใช้') draft.imagePrompt.toolModel ||= body;
    else if (title !== 'โค้ดหน้า UI' && !/^รูปตัวอย่าง\s*\d+$/u.test(title) && !customFields.some(field => field.title === title && field.value === body)) customFields.push({ id: `legacy-section-${customFields.length}`, title, value: body });
  });

  const hasStructuredContent = Boolean(draft.character || draft.story || draft.imagePrompt.prompt || draft.imagePrompt.toolModel || draft.imagePrompt.exampleImages.length || customFields.length);
  if (!hasStructuredContent) {
    const legacyText = (input.content || '').trim() || blocks.filter(block => block.type !== 'UI Code').map(block => block.body).join('\n\n').trim();
    if (input.category === 'character') draft.character = legacyText;
    else if (input.category === 'lore') draft.story = legacyText;
    else if (legacyText) customFields.push({ id: 'legacy-content', title: 'ข้อมูลเดิม', value: legacyText });
  }
  draft.botPrompt.customFields = customFields.length ? customFields : draft.botPrompt.customFields;
  draft.uiCode = (input.uiCodeSnippet || '').trim() || blocks.find(block => block.type === 'UI Code')?.body || '';
  return draft;
}

function parseLegacyHeadingSections(value: string): Array<{ title: string; body: string }> {
  const sections: Array<{ title: string; body: string }> = [];
  let current: { title: string; lines: string[] } | null = null;
  value.split(/\r?\n/).forEach(line => {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      if (current) sections.push({ title: current.title, body: current.lines.join('\n') });
      current = { title: heading[1], lines: [] };
    } else if (current) current.lines.push(line);
  });
  if (current) sections.push({ title: current.title, body: current.lines.join('\n') });
  return sections;
}

export function updateContentEditorValue(
  draft: CreatorContentCanvasDraft,
  editorId: CreatorContentEditorId,
  value: string
): CreatorContentCanvasDraft {
  const next = cloneContentCanvasDraft(draft);
  if (editorId === 'character') next.character = value;
  else if (editorId === 'story') next.story = value;
  else if (editorId === 'image-prompt') next.imagePrompt.prompt = value;
  else if (editorId === 'ui-code') next.uiCode = value;
  // These branches preserve a D.3.0 Focus Editor draft long enough to migrate it
  // into custom fields; the D.3.1 UI never renders fixed bot fields.
  else if (editorId === 'bot-front') next.botPrompt.customFields.push({ id: 'legacy-frontOfHouse', title: 'ข้อมูล / ข้อความหน้าบ้าน', value });
  else if (editorId === 'bot-back') next.botPrompt.customFields.push({ id: 'legacy-backOfHouse', title: 'พรอมต์ / คำสั่งหลังบ้าน', value });
  else if (editorId === 'bot-ooc') next.botPrompt.customFields.push({ id: 'legacy-ooc', title: 'คำสั่ง OOC', value });
  else if (editorId === 'bot-extra') next.botPrompt.customFields.push({ id: 'legacy-extra', title: 'เทมเพลต / ข้อมูลเพิ่มเติม', value });
  else if (editorId.startsWith('bot-custom:')) {
    const fieldId = editorId.slice('bot-custom:'.length);
    const field = next.botPrompt.customFields.find(item => item.id === fieldId);
    if (field) field.value = value;
  }
  return next;
}

export function updateImagePromptToolModel(draft: CreatorContentCanvasDraft, toolModel: string): CreatorContentCanvasDraft {
  const next = cloneContentCanvasDraft(draft);
  next.imagePrompt.toolModel = toolModel;
  return next;
}

export function updateImagePromptExamples(draft: CreatorContentCanvasDraft, images: string[]): CreatorContentCanvasDraft {
  const next = cloneContentCanvasDraft(draft);
  next.imagePrompt.exampleImages = [...images].slice(-6);
  return next;
}

export function addBotCustomField(
  draft: CreatorContentCanvasDraft,
  field: CreatorBotCustomField = createBlankBotCustomField()
): CreatorContentCanvasDraft {
  const next = cloneContentCanvasDraft(draft);
  if (!next.botPrompt.customFields.some(item => item.id === field.id)) next.botPrompt.customFields.push({ ...field });
  return next;
}

export function updateBotCustomFieldTitle(draft: CreatorContentCanvasDraft, fieldId: string, title: string): CreatorContentCanvasDraft {
  const next = cloneContentCanvasDraft(draft);
  const field = next.botPrompt.customFields.find(item => item.id === fieldId);
  if (field) field.title = title;
  return next;
}

export function removeBotCustomField(draft: CreatorContentCanvasDraft, fieldId: string): CreatorContentCanvasDraft {
  const next = cloneContentCanvasDraft(draft);
  next.botPrompt.customFields = next.botPrompt.customFields.filter(item => item.id !== fieldId);
  return next;
}

export function getContentEditorValue(draft: CreatorContentCanvasDraft, editorId: CreatorContentEditorId): { title: string; value: string } | null {
  if (editorId === 'character') return { title: 'โปรไฟล์ / ประวัติตัวละคร', value: draft.character };
  if (editorId === 'story') return { title: 'เนื้อเรื่อง / โลกทัศน์', value: draft.story };
  if (editorId === 'image-prompt') return { title: 'คำสั่งเจนรูป', value: draft.imagePrompt.prompt };
  if (editorId === 'ui-code') return { title: 'โค้ดหน้า UI', value: draft.uiCode };
  if (editorId === 'bot-front') return draft.botPrompt.frontOfHouse ? { title: 'ข้อมูล / ข้อความหน้าบ้าน', value: draft.botPrompt.frontOfHouse } : null;
  if (editorId === 'bot-back') return draft.botPrompt.backOfHouse ? { title: 'พรอมต์ / คำสั่งหลังบ้าน', value: draft.botPrompt.backOfHouse } : null;
  if (editorId === 'bot-ooc') return draft.botPrompt.ooc ? { title: 'คำสั่ง OOC', value: draft.botPrompt.ooc } : null;
  if (editorId === 'bot-extra') return draft.botPrompt.extra ? { title: 'เทมเพลต / ข้อมูลเพิ่มเติม', value: draft.botPrompt.extra } : null;
  if (editorId.startsWith('bot-custom:')) {
    const field = draft.botPrompt.customFields.find(item => item.id === editorId.slice('bot-custom:'.length));
    return field ? { title: field.title, value: field.value } : null;
  }
  return null;
}

export function countThaiCharacters(value: string): number {
  if (!value) return 0;
  const Segmenter = (Intl as unknown as {
    Segmenter?: new (locales?: string | string[], options?: { granularity: 'grapheme' }) => { segment: (text: string) => Iterable<unknown> };
  }).Segmenter;
  if (Segmenter) return Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(value)).length;
  return Array.from(value).length;
}

/** Deliberately deterministic and approximate; this is not tied to a provider tokenizer. */
export function approximateTokenCount(value: string): number {
  const characterCount = countThaiCharacters(value.trim());
  return characterCount === 0 ? 0 : Math.max(1, Math.ceil(characterCount / 4));
}

export function formatContentCounter(value: string, mode: CreatorContentCounterMode): string {
  if (mode === 'tokens') return `ประมาณ ${approximateTokenCount(value).toLocaleString('th-TH')} โทเคน`;
  return `${countThaiCharacters(value).toLocaleString('th-TH')} ตัวอักษร`;
}
