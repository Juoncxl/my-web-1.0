import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const managerSource = readFileSync(new URL('./FolderManagerModal.tsx', import.meta.url), 'utf8');
const confirmationSource = readFileSync(new URL('./ConfirmationDialog.tsx', import.meta.url), 'utf8');
const folderDataSource = readFileSync(new URL('../hooks/useFolderData.ts', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../lib/supabaseService.ts', import.meta.url), 'utf8');
const managerCss = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const folderFormSource = readFileSync(new URL('./folder-manager/FolderForm.tsx', import.meta.url), 'utf8');
const folderIconPickerSource = readFileSync(new URL('./folder-manager/FolderIconPicker.tsx', import.meta.url), 'utf8');
const folderRowSource = readFileSync(new URL('./folder-manager/FolderRow.tsx', import.meta.url), 'utf8');

describe('Folder Delete confirmation UI', () => {
  it('routes the active Folder Delete action through the shared dialog and preserves the existing handler', () => {
    expect(managerSource).toContain("import { ConfirmationDialog } from './ConfirmationDialog';");
    expect(managerSource).toContain('const [folderPendingDeletion, setFolderPendingDeletion] = useState<Folder | null>(null);');
    expect(managerSource).toContain('setFolderPendingDeletion(folder);');
    expect(managerSource).not.toContain('window.confirm');
    expect(managerSource).toContain('setFolderPendingDeletion(null);');
    expect(managerSource).toContain('void onDeleteFolder(folderId);');
    expect(managerSource).toContain('title="ลบโฟลเดอร์?"');
    expect(managerSource).toContain('confirmLabel="ลบโฟลเดอร์"');
    expect(managerSource).toContain('(ผลงานข้างในจะไม่ถูกลบ)');
    expect(managerSource).toContain('onCancel={() => setFolderPendingDeletion(null)}');
    expect(managerSource).toContain('onConfirm={handleConfirmDelete}');
    expect(confirmationSource).toContain('data-confirmation-dialog');
    expect(confirmationSource).toContain('data-confirmation-cancel');
    expect(confirmationSource).toContain('data-confirmation-confirm');
    expect(confirmationSource).toContain('closeRef.current();');
    expect(confirmationSource).toContain('if (confirmClickRef.current) return;');
  });

  it('keeps the existing App-to-folder-data-to-service deletion path intact', () => {
    expect(appSource).toContain('const handleDeleteFolder = async (id: string): Promise<boolean> => {');
    expect(appSource).toContain('const res = await deleteFolder(id);');
    expect(appSource).toContain('clearFolderAssignments(id);');
    expect(appSource).toContain('onDeleteFolder={handleDeleteFolder}');
    expect(folderDataSource).toContain('const deleteFolder = useCallback(async (id: string) => {');
    expect(folderDataSource).toContain('const result = await supabaseService.deleteFolder(id, currentUserId);');
    expect(folderDataSource).toContain('setFolders(previous => previous.filter(folder => folder.id !== id));');
    expect(serviceSource).toContain('async deleteFolder(id: string, userId: string)');
  });

  it('keeps Folder Manager controls intact while applying a scoped visual treatment', () => {
    expect(managerSource).toContain('className="cv-modal-panel cv-folder-manager-modal');
    expect(managerSource).toContain('className="cv-folder-manager-content flex');
    expect(managerSource).toContain('<FolderForm');
    expect(managerSource).toContain('<FolderList');
    expect(folderFormSource).toContain('id="folder-name"');
    expect(folderFormSource).toContain('<FolderIconPicker');
    expect(folderFormSource).toContain('FOLDER_COLOR_PRESETS.map');
    expect(folderFormSource).toContain('className="cv-folder-submit"');
    expect(folderIconPickerSource).toContain('Emoji แนะนำ');
    expect(folderIconPickerSource).toContain('Emoji ของฉัน');
    expect(folderIconPickerSource).toContain('GIF / รูป');
    expect(folderIconPickerSource).toContain('className="cv-folder-icon-preview"');
    expect(folderRowSource).toContain('className="cv-folder-row"');
    expect(folderRowSource).toContain('แก้ไขโฟลเดอร์');
    expect(folderRowSource).toContain('ลบโฟลเดอร์');
    expect(managerCss).toContain('.cv-folder-manager-modal > .cv-folder-manager-content');
    expect(managerCss).toContain('.cv-folder-manager-modal .cv-folder-icon-tabs');
    expect(managerCss).toContain('.cv-folder-manager-modal .cv-folder-color-swatch-button.is-selected');
    expect(managerCss).toContain('.cv-folder-manager-modal .cv-folder-row');
    expect(managerCss).toContain('@media (max-width: 520px)');
  });
});
