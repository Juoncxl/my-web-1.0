import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Code2, Eye, ImagePlus, Plus, X } from 'lucide-react';

type WorkSection = 'content' | 'editor' | 'media' | 'review';
type WorkBlockType = 'Text' | 'Code' | 'Image' | 'Quote';
type WorkIconKind = 'emoji' | 'image' | 'gif';

interface WorkBlock {
  id: string;
  type: WorkBlockType;
  title: string;
  body: string;
}

interface CreatorWorkWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESETS: Record<string, { label: string; description: string; blocks: WorkBlockType[] }> = {
  prompt: { label: 'Prompt / Character', description: 'โครงสำหรับ prompt และตัวละคร', blocks: ['Text', 'Text', 'Quote'] },
  ui: { label: 'UI Code', description: 'HTML + CSS หนึ่ง source พร้อม preview', blocks: ['Text', 'Code'] },
  lore: { label: 'Lore / World', description: 'โครงสำหรับ setting และเรื่องราว', blocks: ['Text', 'Text', 'Image'] }
};

const BLOCK_LABELS: Record<WorkBlockType, string> = {
  Text: 'ข้อความ',
  Code: 'UI Code',
  Image: 'รูปภาพ',
  Quote: 'Quote'
};

function makeBlock(type: WorkBlockType, index: number): WorkBlock {
  const defaults: Record<WorkBlockType, string> = {
    Text: 'เขียนรายละเอียดของผลงานที่นี่',
    Code: '<section class="card">\n  <h2>เริ่มจากตรงนี้</h2>\n</section>',
    Image: 'เพิ่มคำอธิบายภาพหรือ reference ที่เกี่ยวข้อง',
    Quote: 'ประโยคสำคัญหรือแนวคิดที่อยากให้คนจำ'
  };
  return { id: `${type}-${Date.now()}-${index}`, type, title: BLOCK_LABELS[type], body: defaults[type] };
}

export const CreatorWorkWorkspace: React.FC<CreatorWorkWorkspaceProps> = ({ isOpen, onClose }) => {
  const [section, setSection] = useState<WorkSection>('content');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('คำสั่งพรอมต์');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('ส่วนตัว');
  const [status, setStatus] = useState('กำลังทำ');
  const [blocks, setBlocks] = useState<WorkBlock[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [html, setHtml] = useState('<section class="work-preview">\n  <h2>My new work</h2>\n  <p>เริ่มสร้างผลงานของคุณ</p>\n</section>');
  const [css, setCss] = useState('.work-preview {\n  padding: 24px;\n  border-radius: 20px;\n  background: linear-gradient(135deg, #7660ce, #67b8c7);\n  color: white;\n  font-family: system-ui, sans-serif;\n}');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [iconKind, setIconKind] = useState<WorkIconKind>('emoji');
  const [iconValue, setIconValue] = useState('✦');
  const [iconImage, setIconImage] = useState('');
  const [reviewViewport, setReviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [nestedEditorOpen, setNestedEditorOpen] = useState(false);

  const activeBlock = blocks.find(block => block.id === activeBlockId) || null;
  const previewSrcDoc = useMemo(() => {
    const csp = "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob: https:; font-src data: https:; script-src 'none'; connect-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>html,body{margin:0;min-height:100%;background:#20213c}*{box-sizing:border-box}</style><style>${css}</style></head><body>${html}</body></html>`;
  }, [css, html]);

  if (!isOpen) return null;

  const addBlock = (type: WorkBlockType) => {
    const block = makeBlock(type, blocks.length);
    setBlocks(previous => [...previous, block]);
    setActiveBlockId(block.id);
    setSection('editor');
  };

  const handleIconFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setIconImage(URL.createObjectURL(file));
    setIconKind(file.type === 'image/gif' ? 'gif' : 'image');
  };

  const applyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    const nextBlocks = preset.blocks.map((type, index) => makeBlock(type, index));
    setBlocks(nextBlocks);
    setActiveBlockId(nextBlocks[0]?.id || null);
    setCategory(presetKey === 'ui' ? 'โค้ดหน้าตา UI' : presetKey === 'lore' ? 'เนื้อเรื่อง / โลกทัศน์' : 'คำสั่งพรอมต์');
    setSection('editor');
  };

  const updateActiveBlock = (value: string) => {
    if (!activeBlockId) return;
    setBlocks(previous => previous.map(block => block.id === activeBlockId ? { ...block, body: value } : block));
  };

  const addTag = () => {
    const clean = tagInput.trim().replace(/^#/, '');
    if (!clean || tags.includes(clean) || tags.length >= 6) return;
    setTags(previous => [...previous, clean]);
    setTagInput('');
  };

  return (
    <div className="csp-modal-backdrop" role="presentation">
      <section className="csp-work-modal" role="dialog" aria-modal="true" aria-labelledby="csp-work-title">
        <header className="csp-modal-header">
          <div>
            <p className="csp-eyebrow">CREATOR SPACE · WORKSPACE</p>
            <h2 id="csp-work-title">สร้างผลงานใหม่</h2>
            <p>พื้นที่สร้างผลงานตาม approved preview · Phase 1 ยังไม่บันทึกเข้า production</p>
          </div>
          <button type="button" className="csp-icon-button" onClick={onClose} aria-label="ปิด workspace"><X className="h-4 w-4" /></button>
        </header>

        <nav className="csp-work-nav" aria-label="เมนู Create Work">
          {([['content', 'ข้อมูลหลัก'], ['editor', 'เนื้อหา'], ['media', 'สื่อ'], ['review', 'ตรวจสอบ']] as const).map(([value, label]) => (
            <button type="button" key={value} className={section === value ? 'is-active' : ''} onClick={() => setSection(value)}>{label}</button>
          ))}
        </nav>

        <div className="csp-work-body">
          <main className="csp-work-main">
            {(section === 'content' || section === 'editor') && (
              <>
                <section className="csp-work-section">
                  <div className="csp-section-heading"><div><h3>ข้อมูลหลัก</h3><p>ชื่อ ไอคอน หมวดหมู่ และคำอธิบายสั้นของ Work Card</p></div><span>Required</span></div>
                  <label className="csp-field">ชื่อผลงาน *<input value={title} onChange={event => setTitle(event.target.value)} placeholder="เช่น Moonlit Companion System" /></label>
                  <div className="csp-two-column">
                    <label className="csp-field">หมวดหมู่<select value={category} onChange={event => setCategory(event.target.value)}><option>คำสั่งพรอมต์</option><option>โปรไฟล์ตัวละคร</option><option>โค้ดหน้าตา UI</option><option>เนื้อเรื่อง / โลกทัศน์</option><option>แอป / แพลตฟอร์ม</option><option>คอลแลป</option></select></label>
                    <div className="csp-field"><span>Work Icon</span><div className="csp-icon-picker"><button type="button" className={iconKind === 'emoji' ? 'is-active' : ''} onClick={() => setIconKind('emoji')}>Emoji</button><button type="button" className={iconKind === 'image' ? 'is-active' : ''} onClick={() => setIconKind('image')}>Image</button><button type="button" className={iconKind === 'gif' ? 'is-active' : ''} onClick={() => setIconKind('gif')}>GIF</button></div>{iconKind === 'emoji' ? <input value={iconValue} onChange={event => setIconValue(event.target.value.slice(0, 4))} aria-label="ไอคอนผลงาน" /> : <label className="csp-file-picker">{iconImage ? <img src={iconImage} alt="Work icon" /> : 'เลือกไฟล์ image/GIF'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleIconFile} /></label>}</div>
                  </div>
                  <label className="csp-field">คำอธิบายสั้น <span className="csp-field-count">{description.length}/240</span><textarea value={description} maxLength={240} onChange={event => setDescription(event.target.value)} placeholder="ข้อความสำหรับ Work Card / Preview" rows={3} /></label>
                </section>

                <section className="csp-work-section">
                  <div className="csp-section-heading"><div><h3>Starter Presets</h3><p>แม่แบบเพิ่มโครงสร้างเท่านั้น ไม่ใช่ข้อมูลปลอมที่ถูกบันทึก</p></div><span>Optional</span></div>
                  <div className="csp-preset-grid">{Object.entries(PRESETS).map(([key, preset]) => <button type="button" key={key} className="csp-preset" onClick={() => applyPreset(key)}><strong>{preset.label}</strong><span>{preset.description}</span><small>{preset.blocks.length} blocks</small></button>)}</div>
                </section>

                <section className="csp-work-section" aria-labelledby="csp-blocks-title">
                  <div className="csp-section-heading"><div><h3 id="csp-blocks-title">Main Content</h3><p>แต่ละ block มี summary และ editor แยกกัน</p></div><span>{blocks.length} blocks</span></div>
                  <div className="csp-block-list">
                    {blocks.length === 0 && <div className="csp-empty-inline"><Code2 className="h-5 w-5" /><span>ยังไม่มี block · เลือกชนิดด้านล่างเพื่อเริ่ม</span></div>}
                    {blocks.map((block, index) => <div key={block.id} className={`csp-block-row ${activeBlockId === block.id ? 'is-active' : ''}`}><span className="csp-block-index">{String(index + 1).padStart(2, '0')}</span><button type="button" className="csp-block-summary" onClick={() => { setActiveBlockId(block.id); setSection('editor'); setNestedEditorOpen(true); }}><strong>{block.title}</strong><span>{BLOCK_LABELS[block.type]} · {block.body.slice(0, 56)}</span></button><div className="csp-row-actions"><button type="button" onClick={() => setBlocks(previous => { const next = [...previous]; if (index > 0) [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })} aria-label="เลื่อนขึ้น"><ChevronLeft className="h-4 w-4 -rotate-90" /></button><button type="button" onClick={() => setBlocks(previous => { const next = [...previous]; if (index < next.length - 1) [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })} aria-label="เลื่อนลง"><ChevronRight className="h-4 w-4 rotate-90" /></button><button type="button" className="is-danger" onClick={() => { setBlocks(previous => previous.filter(item => item.id !== block.id)); if (activeBlockId === block.id) setActiveBlockId(null); }} aria-label="ลบ block">×</button></div></div>)}
                  </div>
                  <div className="csp-add-blocks">{(['Text', 'Code', 'Image', 'Quote'] as WorkBlockType[]).map(type => <button type="button" key={type} onClick={() => addBlock(type)}><Plus className="h-3.5 w-3.5" />{type === 'Code' ? 'UI Code' : BLOCK_LABELS[type]}</button>)}</div>
                </section>

                {section === 'editor' && activeBlock && <section className="csp-work-section csp-block-editor"><div className="csp-section-heading"><div><h3>Block Editor · {activeBlock.title}</h3><p>แก้เนื้อหาของ block ที่เลือกใน session นี้</p></div><span>{activeBlock.type}</span></div><label className="csp-field">ชื่อ block<input value={activeBlock.title} onChange={event => setBlocks(previous => previous.map(block => block.id === activeBlock.id ? { ...block, title: event.target.value } : block))} /></label><label className="csp-field">เนื้อหา<textarea value={activeBlock.body} onChange={event => updateActiveBlock(event.target.value)} rows={activeBlock.type === 'Code' ? 12 : 7} /></label>{activeBlock.type === 'Code' && <div className="csp-code-editor-grid"><label className="csp-field"><span><Code2 className="inline h-3.5 w-3.5" /> HTML + CSS source</span><textarea value={`${html}\n\n/* CSS */\n${css}`} onChange={event => { const [nextHtml, ...cssParts] = event.target.value.split(/\/\* CSS \*\//); setHtml(nextHtml.trim()); setCss(cssParts.join('/* CSS */').trim()); }} rows={18} /></label><div className="csp-code-editor-help"><strong>Safe rendered preview</strong><span>HTML และ CSS ใช้ source เดียวกัน · script, network และ form ถูกปิดด้วย sandbox/CSP</span><button type="button" className="csp-secondary-button" onClick={() => setNestedEditorOpen(true)}>เปิด editor แบบเต็ม</button></div></div>}</section>}
              </>
            )}

            {section === 'media' && <section className="csp-work-section"><div className="csp-section-heading"><div><h3>สื่อ</h3><p>Cover, gallery และ icon อยู่ใน local session นี้ ยังไม่อัปโหลดหรือบันทึกจริง</p></div><span>Local only</span></div><div className="csp-media-placeholder"><ImagePlus className="h-7 w-7" /><strong>Cover / Gallery</strong><span>ไฟล์ที่เลือกจะใช้เพื่อ review ใน workspace เท่านั้น</span><label className="csp-secondary-button csp-file-button">เลือกภาพจากเครื่อง<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" /></label></div><div className="csp-two-column"><label className="csp-field">Cover fit<select defaultValue="Cover"><option>Cover</option><option>Contain</option></select></label><label className="csp-field">Icon fit<select defaultValue="Contain"><option>Contain</option><option>Cover</option></select></label></div></section>}

            {section === 'review' && <section className="csp-work-section"><div className="csp-section-heading"><div><h3>ตรวจสอบ</h3><p>Rendered preview จากค่าที่กรอกใน workspace</p></div><div className="csp-review-switcher"><button type="button" className={reviewViewport === 'desktop' ? 'is-active' : ''} onClick={() => setReviewViewport('desktop')}>Desktop</button><button type="button" className={reviewViewport === 'mobile' ? 'is-active' : ''} onClick={() => setReviewViewport('mobile')}>Mobile</button></div></div><div className={`csp-review-card ${reviewViewport === 'mobile' ? 'is-mobile' : ''}`}><div className="csp-review-icon">{iconKind === 'emoji' ? iconValue : iconImage ? <img src={iconImage} alt="" /> : '✦'}</div><div><strong>{title || 'ยังไม่ได้ตั้งชื่อผลงาน'}</strong><span>{category} · {visibility} · {status}</span><p>{description || 'ยังไม่มีคำอธิบายสั้น'}</p><div className="csp-tag-list">{tags.map(tag => <span key={tag}>#{tag}</span>)}</div></div></div><div className="csp-code-preview-wrap"><div className="csp-section-heading"><div><h3>UI Code preview</h3><p>iframe sandbox + CSP · ไม่รัน script จาก source</p></div><Eye className="h-4 w-4" /></div><iframe title="UI Code preview" sandbox="" srcDoc={previewSrcDoc} /></div></section>}
          </main>

          <aside className="csp-work-sidebar">
            <section className="csp-work-section"><div className="csp-section-heading"><div><h3>Metadata</h3><p>จัดระเบียบก่อนเชื่อมการบันทึกจริง</p></div><span>Draft</span></div><label className="csp-field">Visibility<select value={visibility} onChange={event => setVisibility(event.target.value)}><option>ส่วนตัว</option><option>สาธารณะ</option><option>แบบร่าง</option></select></label><label className="csp-field">Workflow status<select value={status} onChange={event => setStatus(event.target.value)}><option>ไอเดีย</option><option>แบบร่าง</option><option>กำลังทำ</option><option>เสร็จสมบูรณ์</option><option>จัดเก็บแล้ว</option></select></label><label className="csp-field">Folder<select defaultValue=""><option value="">ไม่จัดโฟลเดอร์</option><option>เลือกจากคอลเลกชันจริงใน Vault เมื่อเชื่อม</option></select></label></section>
            <section className="csp-work-section"><div className="csp-section-heading"><div><h3>Tags</h3><p>{tags.length}/6</p></div></div><div className="csp-tag-list">{tags.map(tag => <button type="button" key={tag} onClick={() => setTags(previous => previous.filter(item => item !== tag))}>#{tag} ×</button>)}</div><div className="csp-tag-entry"><input value={tagInput} onChange={event => setTagInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }} placeholder="พิมพ์ tag แล้วกด Enter" /><button type="button" onClick={addTag}>เพิ่ม</button></div></section>
            <section className="csp-work-section csp-persistence-note"><strong>สถานะการบันทึก</strong><p>Phase 1 เปิด workspace และโครงสร้างการสร้างงานแล้ว แต่ยังไม่เชื่อม create/update asset เพื่อไม่สร้างข้อมูลหลอกใน production</p></section>
          </aside>
        </div>

        <footer className="csp-modal-footer"><span>ยังไม่เชื่อม backend · ไม่มีการเขียนข้อมูลเมื่อกดปุ่มนี้</span><button type="button" className="csp-secondary-button" onClick={onClose}>ยกเลิก</button><button type="button" className="csp-primary-button" disabled title="การบันทึกผลงานจะเชื่อมใน phase ถัดไป">สร้างผลงาน · ยังไม่เชื่อม</button></footer>
      </section>
      {nestedEditorOpen && activeBlock && <div className="csp-nested-modal" role="dialog" aria-modal="true" aria-label={`Block Editor ${activeBlock.title}`}><section className="csp-nested-modal-card"><header className="csp-modal-header"><div><p className="csp-eyebrow">MAIN CONTENT · BLOCK EDITOR</p><h2>{activeBlock.title}</h2></div><button type="button" className="csp-icon-button" onClick={() => setNestedEditorOpen(false)} aria-label="ปิด editor"><X className="h-4 w-4" /></button></header><div className="csp-nested-modal-body"><label className="csp-field">ชื่อ block<input value={activeBlock.title} onChange={event => setBlocks(previous => previous.map(block => block.id === activeBlock.id ? { ...block, title: event.target.value } : block))} /></label><label className="csp-field">เนื้อหา<textarea value={activeBlock.body} onChange={event => updateActiveBlock(event.target.value)} rows={12} /></label>{activeBlock.type === 'Code' && <label className="csp-field">UI Code · HTML + CSS<textarea value={`${html}\n\n/* CSS */\n${css}`} onChange={event => { const [nextHtml, ...cssParts] = event.target.value.split(/\/\* CSS \*\//); setHtml(nextHtml.trim()); setCss(cssParts.join('/* CSS */').trim()); }} rows={18} /></label>}</div><footer className="csp-modal-footer"><span>กลับไปยังตำแหน่งเดิมใน workspace ได้โดยไม่หาย</span><button type="button" className="csp-primary-button" onClick={() => setNestedEditorOpen(false)}>เสร็จสิ้น</button></footer></section></div>}
    </div>
  );
};
