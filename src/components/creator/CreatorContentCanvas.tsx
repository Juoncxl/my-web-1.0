import React, { useMemo, useRef } from 'react';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { SandboxedCodePreview } from '../SandboxedCodePreview';
import {
  CREATOR_CONTENT_TYPE_META,
  addBotCustomField,
  formatContentCounter,
  getSelectedContentTypes,
  removeBotCustomField,
  updateBotCustomFieldTitle,
  updateContentEditorValue,
  updateImagePromptExamples,
  updateImagePromptToolModel,
  type CreatorBotCustomField,
  type CreatorContentCanvasDraft,
  type CreatorContentCounterMode,
  type CreatorContentEditorId,
  type CreatorContentType
} from './creatorContentModel';

export type CreatorUiCodeView = 'code' | 'split' | 'preview';

interface ContentLongEditorProps {
  editorId: CreatorContentEditorId;
  label: string;
  placeholder: string;
  value: string;
  counterMode: CreatorContentCounterMode;
  onChange: (value: string) => void;
  onExpand: (editorId: CreatorContentEditorId, title: string) => void;
  code?: boolean;
}

const ContentLongEditor: React.FC<ContentLongEditorProps> = ({ editorId, label, placeholder, value, counterMode, onChange, onExpand, code = false }) => {
  const inputId = `csp-content-editor-${editorId.replace(/[^a-z0-9-]/gi, '-')}`;
  return <div className={`csp-content-long-editor ${code ? 'is-code-editor' : ''}`}>
    <div className="csp-content-editor-heading">
      <label htmlFor={inputId}>{label}</label>
      <div className="csp-content-editor-tools">
        <span>{formatContentCounter(value, counterMode)}</span>
        <button type="button" className="csp-content-expand-button" onClick={() => onExpand(editorId, label)} aria-label={`ขยายตัวแก้ไข ${label}`}>⛶ ขยาย</button>
      </div>
    </div>
    <textarea
      id={inputId}
      data-content-editor={editorId}
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      rows={8}
      spellCheck={!code}
      className={code ? 'csp-code-textarea' : undefined}
    />
  </div>;
};

interface ContentSectionProps {
  type: CreatorContentType;
  draft: CreatorContentCanvasDraft;
  counterMode: CreatorContentCounterMode;
  onChange: (draft: CreatorContentCanvasDraft) => void;
  onExpand: (editorId: CreatorContentEditorId, title: string) => void;
  onOpenFullPreview: () => void;
  uiCodeView: CreatorUiCodeView;
  onUiCodeViewChange: (view: CreatorUiCodeView) => void;
  onExampleImagesChange: (images: string[]) => void;
}

const CONTENT_PLACEHOLDERS: Record<CreatorContentType, string> = {
  character: 'เขียนโปรไฟล์ บุคลิก ประวัติ ความสัมพันธ์ หรือข้อมูลเบื้องหลังของตัวละครที่นี่',
  lore: 'เขียนพล็อต ฉาก เส้นเวลา กฎของโลก หรือรายละเอียด lore ที่นี่',
  image_prompt: 'เขียนคำสั่งเจนรูป องค์ประกอบภาพ สไตล์ แสง และรายละเอียดที่ต้องการที่นี่',
  ui_code: '<section class="card">\n  <h2>ชื่อส่วนของฉัน</h2>\n</section>\n\n<style>\n.card { padding: 24px; }\n</style>',
  bot_prompt: 'เขียนข้อมูลที่ต้องการให้ผู้ใช้เห็นบนหน้าบ้านที่นี่'
};

const CONTENT_DESCRIPTIONS: Record<CreatorContentType, string> = {
  character: 'ข้อมูลตัวละคร บุคลิก ประวัติ ความสัมพันธ์ และข้อมูลเบื้องหลัง',
  lore: 'พล็อต ฉาก เส้นเวลา กฎของโลก และรายละเอียดเรื่องราว',
  image_prompt: 'คำสั่งเจนรูป เครื่องมือหรือโมเดลที่ใช้ และรูปตัวอย่างที่เกี่ยวข้อง',
  ui_code: 'เขียน HTML และ CSS พร้อมดูผลลัพธ์ในพื้นที่ปลอดภัย',
  bot_prompt: 'ตั้งชื่อและเพิ่มช่องข้อมูลตามวิธีทำงานของคุณได้อย่างอิสระ'
};

function findMeta(type: CreatorContentType) {
  return CREATOR_CONTENT_TYPE_META.find(option => option.value === type) || CREATOR_CONTENT_TYPE_META[0];
}

const ContentSection: React.FC<ContentSectionProps> = ({
  type,
  draft,
  counterMode,
  onChange,
  onExpand,
  onOpenFullPreview,
  uiCodeView,
  onUiCodeViewChange,
  onExampleImagesChange
}) => {
  const meta = findMeta(type);
  const updateText = (editorId: CreatorContentEditorId, value: string) => {
    onChange(updateContentEditorValue(draft, editorId, value));
  };

  if (type === 'character' || type === 'lore') {
    const editorId: CreatorContentEditorId = type === 'character' ? 'character' : 'story';
    return <article className="csp-content-canvas-section" data-content-section={type}>
      <div className="csp-content-section-heading"><div><h3>{meta.label}</h3><p>{CONTENT_DESCRIPTIONS[type]}</p></div></div>
      <ContentLongEditor editorId={editorId} label={type === 'character' ? 'ข้อมูลตัวละคร' : 'เนื้อเรื่องและโลกทัศน์'} placeholder={CONTENT_PLACEHOLDERS[type]} value={type === 'character' ? draft.character : draft.story} counterMode={counterMode} onChange={value => updateText(editorId, value)} onExpand={onExpand} />
    </article>;
  }

  if (type === 'image_prompt') {
    return <article className="csp-content-canvas-section" data-content-section={type}>
      <div className="csp-content-section-heading"><div><h3>{meta.label}</h3><p>{CONTENT_DESCRIPTIONS[type]}</p></div></div>
      <ContentLongEditor editorId="image-prompt" label="คำสั่งเจนรูป" placeholder={CONTENT_PLACEHOLDERS[type]} value={draft.imagePrompt.prompt} counterMode={counterMode} onChange={value => updateText('image-prompt', value)} onExpand={onExpand} />
      <label className="csp-content-field csp-content-tool-model-field">เครื่องมือ / โมเดลที่ใช้<input value={draft.imagePrompt.toolModel} onChange={event => onChange(updateImagePromptToolModel(draft, event.target.value))} placeholder="เช่น TensorArt — Z-Image Turbo, ChatGPT, Gemini" /></label>
      <div className="csp-content-example-images"><div className="csp-content-section-heading"><div><h4>รูปตัวอย่าง</h4><p>เพิ่มภาพอ้างอิงหรือผลลัพธ์ตัวอย่างไว้กับคำสั่งเจนรูปนี้</p></div><span>{draft.imagePrompt.exampleImages.length}/6 รูป</span></div><label className="csp-secondary-button csp-file-button"><ImagePlus className="h-4 w-4" />เลือกภาพตัวอย่าง<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => { const file = event.target.files?.[0]; if (!file || !isSupportedCanvasImage(file)) return; const reader = new FileReader(); reader.onload = () => { if (typeof reader.result === 'string') onExampleImagesChange([...draft.imagePrompt.exampleImages, reader.result]); }; reader.readAsDataURL(file); event.target.value = ''; }} /></label>{draft.imagePrompt.exampleImages.length > 0 && <div className="csp-content-example-strip">{draft.imagePrompt.exampleImages.map((image, index) => <button type="button" key={`${image.slice(0, 18)}-${index}`} onClick={() => onExampleImagesChange(draft.imagePrompt.exampleImages.filter((_, itemIndex) => itemIndex !== index))} aria-label={`ลบภาพตัวอย่างที่ ${index + 1}`}><img src={image} alt="" /></button>)}</div>}</div>
    </article>;
  }

  if (type === 'ui_code') {
    return <article className="csp-content-canvas-section csp-ui-code-section" data-content-section={type}>
      <div className="csp-content-section-heading"><div><h3>{meta.label}</h3><p>{CONTENT_DESCRIPTIONS[type]}</p></div></div>
      <div className="csp-code-toolbar" role="toolbar" aria-label="โหมดดูโค้ดหน้า UI"><div className="csp-code-view-switcher">{(['code', 'split', 'preview'] as CreatorUiCodeView[]).map(view => <button type="button" key={view} className={uiCodeView === view ? 'is-active' : ''} aria-pressed={uiCodeView === view} onClick={() => onUiCodeViewChange(view)}>{view === 'code' ? 'โค้ด' : view === 'split' ? 'แบ่งจอ' : 'พรีวิว'}</button>)}</div><button type="button" className="csp-secondary-button" onClick={onOpenFullPreview}>⛶ ดูพรีวิวเต็ม</button><button type="button" className="csp-secondary-button" onClick={() => onExpand('ui-code', 'โค้ดหน้า UI')}>⛶ ขยายโค้ด</button></div>
      <div className={`csp-code-canvas-layout is-${uiCodeView}`}>
        {uiCodeView !== 'preview' && <ContentLongEditor editorId="ui-code" label="โค้ด HTML + CSS" placeholder={CONTENT_PLACEHOLDERS[type]} value={draft.uiCode} counterMode={counterMode} onChange={value => updateText('ui-code', value)} onExpand={onExpand} code />}
        {uiCodeView !== 'code' && <div className="csp-code-preview-panel"><div className="csp-code-preview-heading"><strong>พรีวิว</strong><span>แสดงผลแบบปลอดภัย</span></div><SandboxedCodePreview code={draft.uiCode} minHeight="260px" /></div>}
      </div>
    </article>;
  }

  return <article className="csp-content-canvas-section" data-content-section={type}>
    <div className="csp-content-section-heading"><div><h3>{meta.label}</h3><p>{CONTENT_DESCRIPTIONS[type]}</p></div></div>
    <div className="csp-bot-field-stack">
      {draft.botPrompt.customFields.map((field: CreatorBotCustomField) => <div className="csp-bot-custom-field" key={field.id}><div className="csp-custom-field-heading"><label htmlFor={`csp-custom-title-${field.id}`}>ชื่อช่องข้อมูล<input id={`csp-custom-title-${field.id}`} value={field.title} placeholder="ช่องข้อมูลใหม่" onChange={event => onChange(updateBotCustomFieldTitle(draft, field.id, event.target.value))} /></label><button type="button" className="csp-content-remove-button" onClick={() => onChange(removeBotCustomField(draft, field.id))}><Trash2 className="h-4 w-4" />ลบช่องนี้</button></div><ContentLongEditor editorId={`bot-custom:${field.id}`} label="เนื้อหา" placeholder="เขียนข้อมูลของช่องนี้ที่นี่" value={field.value} counterMode={counterMode} onChange={value => updateText(`bot-custom:${field.id}`, value)} onExpand={onExpand} /></div>)}
      <button type="button" className="csp-add-custom-field-button" onClick={() => onChange(addBotCustomField(draft))}><Plus className="h-4 w-4" />เพิ่มช่องข้อมูล</button>
    </div>
  </article>;
};

const SUPPORTED_CANVAS_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
function isSupportedCanvasImage(file: File): boolean { return SUPPORTED_CANVAS_IMAGE_TYPES.has(file.type) && file.size > 0; }

export interface CreatorContentCanvasProps {
  selectedContentTypes: CreatorContentType[];
  draft: CreatorContentCanvasDraft;
  counterMode: CreatorContentCounterMode;
  onCounterModeChange: (mode: CreatorContentCounterMode) => void;
  onChange: (draft: CreatorContentCanvasDraft) => void;
  onExpand: (editorId: CreatorContentEditorId, title: string) => void;
  onGoToDetails: () => void;
  onOpenFullPreview: () => void;
  uiCodeView: CreatorUiCodeView;
  onUiCodeViewChange: (view: CreatorUiCodeView) => void;
}

export const CreatorContentCanvas: React.FC<CreatorContentCanvasProps> = ({
  selectedContentTypes,
  draft,
  counterMode,
  onCounterModeChange,
  onChange,
  onExpand,
  onGoToDetails,
  onOpenFullPreview,
  uiCodeView,
  onUiCodeViewChange
}) => {
  const sectionRefs = useRef<Partial<Record<CreatorContentType, HTMLElement>>>({});
  const selected = useMemo(() => getSelectedContentTypes(selectedContentTypes), [selectedContentTypes]);
  const focusSection = (type: CreatorContentType) => {
    const element = sectionRefs.current[type];
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    element?.querySelector<HTMLElement>('[data-content-editor]')?.focus();
  };

  return <section className="csp-content-canvas" aria-labelledby="csp-content-canvas-title">
    <div className="csp-content-canvas-summary">
      <div className="csp-content-canvas-title"><h2 id="csp-content-canvas-title">เนื้อหาของงานนี้</h2><p>ช่องเขียนจะแสดงตามประเภทเนื้อหาที่เลือกไว้</p></div>
      {selected.length > 0 && <div className="csp-content-summary-controls"><div className="csp-content-type-summary" aria-label="ประเภทเนื้อหาที่เลือก">{selected.map(type => <button type="button" key={type} className="csp-content-summary-button" onClick={() => focusSection(type)}>{findMeta(type).label}</button>)}</div><button type="button" className="csp-content-edit-types-button" onClick={onGoToDetails}>แก้ไขประเภท</button></div>}
    </div>
    <div className="csp-content-counter-switcher" aria-label="รูปแบบตัวนับ"><span>ตัวนับ:</span><button type="button" className={counterMode === 'characters' ? 'is-active' : ''} aria-pressed={counterMode === 'characters'} onClick={() => onCounterModeChange('characters')}>ตัวอักษร</button><button type="button" className={counterMode === 'tokens' ? 'is-active' : ''} aria-pressed={counterMode === 'tokens'} onClick={() => onCounterModeChange('tokens')}>โทเคนโดยประมาณ</button></div>
    {selected.length === 0 ? <div className="csp-content-empty-state"><strong>ยังไม่ได้เลือกประเภทเนื้อหา</strong><p>เลือกประเภทเนื้อหาก่อน เพื่อให้ CXL เตรียมช่องเขียนที่เหมาะกับงานนี้</p><button type="button" className="csp-primary-button" onClick={onGoToDetails}>ไปเลือกประเภทเนื้อหา</button></div> : <div className="csp-content-section-list">{selected.map(type => <div key={type} ref={element => { if (element) sectionRefs.current[type] = element; }}><ContentSection type={type} draft={draft} counterMode={counterMode} onChange={onChange} onExpand={onExpand} onOpenFullPreview={onOpenFullPreview} uiCodeView={uiCodeView} onUiCodeViewChange={onUiCodeViewChange} onExampleImagesChange={images => onChange(updateImagePromptExamples(draft, images))} /></div>)}</div>}
  </section>;
};

export interface CreatorFocusEditorProps {
  title: string;
  value: string;
  counterMode: CreatorContentCounterMode;
  code?: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
}

export const CreatorFocusEditor: React.FC<CreatorFocusEditorProps> = ({ title, value, counterMode, code = false, onChange, onClose }) => <div className="csp-focus-editor-backdrop" role="presentation">
  <section className="csp-focus-editor" role="dialog" aria-modal="true" aria-labelledby="csp-focus-editor-title">
    <header className="csp-focus-editor-header"><div><span>ตัวแก้ไขโฟกัส</span><h2 id="csp-focus-editor-title">{title}</h2></div><button type="button" className="csp-icon-button" onClick={onClose} aria-label="ปิดตัวแก้ไขโฟกัส">×</button></header>
    <div className="csp-focus-editor-body"><textarea autoFocus data-focus-editor value={value} onChange={event => onChange(event.target.value)} spellCheck={!code} className={code ? 'csp-code-textarea' : undefined} /></div>
    <footer className="csp-focus-editor-footer"><span>{formatContentCounter(value, counterMode)}</span><button type="button" className="csp-primary-button" onClick={onClose}>เสร็จสิ้น</button></footer>
  </section>
</div>;
