import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const workspaceSource = readFileSync(new URL('./CreatorWorkWorkspace.tsx', import.meta.url), 'utf8');
const panelSource = readFileSync(new URL('./CreatorCollabPanel.tsx', import.meta.url), 'utf8');
const modelSource = readFileSync(new URL('./creatorCollabModel.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

describe('Creator Composer D.6.1 Collaboration usability contracts', () => {
  it('keeps typography changes scoped to the Collaboration panel', () => {
    expect(styles).toContain('.csp-work-modal .csp-collab-heading h2');
    expect(styles).toContain('.csp-work-modal .csp-collab-area-heading h3');
    expect(styles).toContain('.csp-work-modal .csp-collab-participant-main strong');
    expect(styles).not.toContain('.csp-section-heading h3 { font-size: 1.05rem');
  });

  it('replaces one fixed Notes field with an empty creator-defined Shared Information collection', () => {
    expect(panelSource).toContain('ข้อมูลกลางของคอลแลป');
    expect(panelSource).toContain('ยังไม่มีข้อมูลกลาง');
    expect(panelSource).toContain('เพิ่มข้อมูล');
    expect(modelSource).toContain('sharedInformation: []');
    expect(modelSource).not.toContain('notes: \'\', platforms: [], sharedInformation');
  });

  it('supports text, code, and focused long-form editing with the shared D.3 counter', () => {
    expect(panelSource).toContain("[['text', 'ข้อความ'], ['code', 'โค้ด']]");
    expect(panelSource).toContain('<CreatorFocusEditor');
    expect(panelSource).toContain('formatContentCounter(item.content, counterMode)');
    expect(panelSource).toContain('formatContentCounter(participant.notes, counterMode)');
    expect(panelSource).not.toContain('SandboxedCodePreview');
  });

  it('defaults Shared Information scope to unspecified and only shows platform controls when specifically requested', () => {
    expect(modelSource).toContain("appScope: input.appScope || 'unspecified'");
    expect(panelSource).toContain("item.appScope === 'specific_apps' && <div className=\"csp-collab-app-scope\"");
    expect(panelSource).toContain("['unspecified', 'ไม่ระบุ'], ['all_apps', 'ทุกแอป'], ['specific_apps', 'เฉพาะแอป']");
  });

  it('provides a non-intrusive per-section copy action', () => {
    expect(panelSource).toContain('copyCollabText(item.content)');
    expect(panelSource).toContain("copied ? 'คัดลอกแล้ว' : 'คัดลอก'");
  });

  it('starts deadlines empty and adds editable preset or custom rows', () => {
    expect(modelSource).toContain('deadlines: []');
    expect(panelSource).toContain('ยังไม่มีกำหนดส่ง');
    expect(panelSource).toContain('เพิ่มกำหนดส่ง');
    expect(panelSource).toContain("addDeadline('custom')");
    expect(panelSource).toContain('<DeadlineRow');
    expect(panelSource).not.toContain('disabled={!deadline.enabled}');
  });

  it('keeps participant Reference images scoped to participant data and separate from Work Media', () => {
    expect(modelSource).toContain('referenceImages: CreatorMediaItem[]');
    expect(panelSource).toContain('รูป / Reference');
    expect(panelSource).toContain('addCollabParticipantReferenceImage');
    expect(panelSource).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(panelSource).not.toContain('setCoverMedia');
    expect(panelSource).not.toContain('updateImagePromptExamples');
  });

  it('offers private/public Collab visibility while keeping management data private', () => {
    expect(workspaceSource).toContain("...(workMode === 'collab' ? [['collab', 'คอลแลป'] as const] : [])");
    expect(workspaceSource).toContain('collaboration: cloneCreatorCollaborationDraft(draft.collaboration)');
    expect(workspaceSource).toContain('counterMode={counterMode}');
    expect(panelSource).toContain('การมองเห็นคอลแลป');
    expect(panelSource).toContain("visibility === 'public'");
    expect(workspaceSource).toContain('serializeCreatorWorkDraft');
    expect(modelSource).toContain('createPublicCollaborationSnapshot');
    expect(modelSource).toContain('contact: \'\'');
    expect(panelSource).toContain('ข้อมูลที่เปิดให้คนอื่นเห็น');
    expect(panelSource).toContain('ช่องทางติดต่อและลิงก์ในช่องติดต่อเป็นข้อมูลส่วนตัวเสมอ');
    expect(panelSource).toContain('เก็บเป็นลิงก์ ไม่คัดลอกเนื้อหา');
    expect(panelSource).not.toContain('Related Collaborations');
  });

  it('places cancel and create actions only on the final Review tab', () => {
    expect(workspaceSource).toContain("{section === 'review' && <footer className=\"csp-modal-footer\"");
    expect(workspaceSource).toContain("data-review-actions={section === 'review'}");
    expect(styles).toContain('.csp-work-modal[data-review-actions="true"] > .csp-modal-footer');
    expect(styles).toContain('position: relative;');
    expect(styles).toContain('Keep the zero-height grid slot');
  });
});
