import React from 'react';
import { Check, FolderPlus } from 'lucide-react';
import { FOLDER_COLOR_PRESETS } from '../../lib/constants';
import { FolderIconPicker, type FolderIconMode } from './FolderIconPicker';

interface FolderFormProps {
  editing: boolean;
  folderName: string;
  selectedIcon: string;
  selectedColor: string;
  iconMode: FolderIconMode;
  customEmojiInput: string;
  imageUrlInput: string;
  error: string;
  isSubmitting: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFolderNameChange: (value: string) => void;
  onIconChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onIconModeChange: (mode: FolderIconMode) => void;
  onCustomEmojiChange: (value: string) => void;
  onImageUrlChange: (value: string) => void;
  onApplyEmoji: () => void;
  onApplyUrl: () => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onResetIcon: () => void;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent) => void;
}

export const FolderForm: React.FC<FolderFormProps> = (props) => {
  const selectedColorMeta = FOLDER_COLOR_PRESETS.find(color => color.id === props.selectedColor) || FOLDER_COLOR_PRESETS[0];

  return (
    <form onSubmit={props.onSubmit} className="cv-folder-form">
      <div className="cv-folder-form-heading">
        <span className="cv-folder-form-title"><FolderPlus className="h-3.5 w-3.5" /><span>{props.editing ? 'แก้ไขข้อมูลโฟลเดอร์' : 'สร้างโฟลเดอร์ใหม่'}</span></span>
        {props.editing && <button type="button" onClick={props.onCancel} className="cv-folder-form-cancel">ยกเลิกการแก้ไข</button>}
      </div>

      <div className="cv-folder-form-field">
        <label htmlFor="folder-name">ชื่อโฟลเดอร์</label>
        <input id="folder-name" type="text" value={props.folderName} onChange={event => props.onFolderNameChange(event.target.value)} placeholder="เช่น โปรเจกต์บอทแฟนตาซี หรือ System Prompts" />
      </div>

      <FolderIconPicker
        selectedIcon={props.selectedIcon}
        iconMode={props.iconMode}
        customEmojiInput={props.customEmojiInput}
        imageUrlInput={props.imageUrlInput}
        error={props.error}
        onIconChange={props.onIconChange}
        onModeChange={props.onIconModeChange}
        onCustomEmojiChange={props.onCustomEmojiChange}
        onImageUrlChange={props.onImageUrlChange}
        onApplyEmoji={props.onApplyEmoji}
        onApplyUrl={props.onApplyUrl}
        onFileUpload={props.onFileUpload}
        onReset={props.onResetIcon}
        fileInputRef={props.fileInputRef}
      />

      <fieldset className="cv-folder-color-field">
        <legend>สีประจำโฟลเดอร์</legend>
        <div className="cv-folder-color-options">
          {FOLDER_COLOR_PRESETS.map(color => {
            const isSelected = props.selectedColor === color.id;
            return (
              <button
                key={color.id}
                type="button"
                onClick={() => props.onColorChange(color.id)}
                className={`cv-folder-color-swatch-button${isSelected ? ' is-selected' : ''}`}
                aria-label={`เลือกสี${color.name}`}
                aria-pressed={isSelected}
                title={color.name}
              >
                <span className="cv-folder-color-swatch" style={{ backgroundColor: color.swatch }} />
                {isSelected && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
        <p className="cv-folder-color-note"><span style={{ backgroundColor: selectedColorMeta.swatch }} />เลือกอยู่: {selectedColorMeta.name}</p>
      </fieldset>

      {props.error && <p className="cv-folder-form-error" role="alert">{props.error}</p>}

      <div className="cv-folder-form-actions">
        <button type="submit" disabled={props.isSubmitting || !props.folderName.trim()} className="cv-folder-submit">
          {props.isSubmitting ? 'กำลังบันทึก...' : props.editing ? 'บันทึกการแก้ไข' : 'สร้างโฟลเดอร์'}
        </button>
      </div>
    </form>
  );
};
