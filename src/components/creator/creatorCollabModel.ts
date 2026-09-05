import type { PublicAssetCollaboration, WorkContentBlock } from '../../types';
import { CREATOR_MEDIA_MAX_ITEMS, type CreatorMediaItem } from './creatorMediaModel';

export type CreatorCollabDeadlineKind = 'data' | 'image' | 'publish' | 'custom';
export type CreatorCollabSubmissionStatus = 'not_submitted' | 'reviewing' | 'needs_fix' | 'approved';
export type CreatorCollabSharedInformationType = 'text' | 'code';
/** `unspecified` means the item has no app classification. */
export type CreatorCollabSharedInformationAppScope = 'unspecified' | 'all_apps' | 'specific_apps';

export interface CreatorCollabDeadline { id: string; kind: CreatorCollabDeadlineKind; label: string; date: string; }

export interface CreatorCollabSharedInformation {
  id: string;
  title: string;
  type: CreatorCollabSharedInformationType;
  content: string;
  appScope: CreatorCollabSharedInformationAppScope;
  platforms: string[];
}

export interface CreatorCollabParticipant {
  id: string;
  /** Only the organizer's own entry can be marked as owner. */
  isOwner: boolean;
  creatorName: string;
  houseTag: string;
  platforms: string[];
  contact: string;
  externalWorkName: string;
  dataStatus: CreatorCollabSubmissionStatus;
  imageStatus: CreatorCollabSubmissionStatus;
  notes: string;
  /** Participant-scoped static images; never global Work Media. */
  referenceImages: CreatorMediaItem[];
  linkedWorkIds: string[];
  deadlineOverrides: Record<string, string>;
  useDeadlineOverrides: boolean;
}

export interface CreatorCollaborationDraft {
  name: string;
  sharedTag: string;
  platforms: string[];
  /** Fully creator-defined shared material. It starts empty on purpose. */
  sharedInformation: CreatorCollabSharedInformation[];
  /** An empty collection naturally means this collaboration has no deadlines. */
  deadlines: CreatorCollabDeadline[];
  participants: CreatorCollabParticipant[];
  visibilityPolicy: {
    showParticipantStatuses: boolean;
    showParticipantNotes: boolean;
    showParticipantDeadlineOverrides: boolean;
  };
}

export interface CreatorCollaborationSummary { participants: number; dataApproved: number; imageApproved: number; }

export const CREATOR_COLLAB_PUBLIC_BLOCK_PREFIX = 'csp-collab-shared-';
export const CREATOR_COLLAB_IDENTITY_BLOCK_ID = 'csp-collab-identity-v1';

let collabIdSequence = 0;
function createCollabId(prefix: string): string { collabIdSequence += 1; return `${prefix}-${Date.now()}-${collabIdSequence}`; }

export const CREATOR_COLLAB_STATUS_OPTIONS: Array<{ value: CreatorCollabSubmissionStatus; label: string }> = [
  { value: 'not_submitted', label: '⚪ ยังไม่ส่ง' },
  { value: 'reviewing', label: '🟡 รอตรวจ' },
  { value: 'needs_fix', label: '🟣 ต้องแก้' },
  { value: 'approved', label: '🟢 ผ่านแล้ว' }
];

export const CREATOR_COLLAB_DEADLINE_PRESETS: Array<{ kind: Exclude<CreatorCollabDeadlineKind, 'custom'>; label: string }> = [
  { kind: 'data', label: '📋 ส่งข้อมูล' },
  { kind: 'image', label: '🖼️ ส่งรูป' },
  { kind: 'publish', label: '🚀 เผยแพร่' }
];

export function createBlankCollaborationDraft(): CreatorCollaborationDraft {
  return {
    name: '',
    sharedTag: '',
    platforms: [],
    sharedInformation: [],
    deadlines: [],
    participants: [],
    visibilityPolicy: {
      showParticipantStatuses: false,
      showParticipantNotes: false,
      showParticipantDeadlineOverrides: false
    }
  };
}

export function createBlankCollabSharedInformation(input: Partial<CreatorCollabSharedInformation> = {}): CreatorCollabSharedInformation {
  return { id: input.id || createCollabId('shared-information'), title: input.title || '', type: input.type || 'text', content: input.content || '', appScope: input.appScope || 'unspecified', platforms: [...(input.platforms || [])] };
}

export function createBlankCollabParticipant(input: Partial<CreatorCollabParticipant> = {}): CreatorCollabParticipant {
  return {
    id: input.id || createCollabId('participant'), isOwner: input.isOwner ?? false, creatorName: input.creatorName || '', houseTag: input.houseTag || '', platforms: [...(input.platforms || [])], contact: input.contact || '', externalWorkName: input.externalWorkName || '', dataStatus: input.dataStatus || 'not_submitted', imageStatus: input.imageStatus || 'not_submitted', notes: input.notes || '', referenceImages: (input.referenceImages || []).map(image => ({ ...image })), linkedWorkIds: [...(input.linkedWorkIds || [])], deadlineOverrides: { ...(input.deadlineOverrides || {}) }, useDeadlineOverrides: input.useDeadlineOverrides ?? false
  };
}

export function cloneCreatorCollaborationDraft(draft: CreatorCollaborationDraft): CreatorCollaborationDraft {
  return {
    name: draft.name, sharedTag: draft.sharedTag, platforms: [...draft.platforms],
    sharedInformation: draft.sharedInformation.map(item => ({ ...item, platforms: [...item.platforms] })),
    deadlines: draft.deadlines.map(deadline => ({ ...deadline })),
    participants: draft.participants.map(participant => ({ ...participant, platforms: [...participant.platforms], referenceImages: participant.referenceImages.map(image => ({ ...image })), linkedWorkIds: [...participant.linkedWorkIds], deadlineOverrides: { ...participant.deadlineOverrides } })),
    visibilityPolicy: {
      showParticipantStatuses: draft.visibilityPolicy?.showParticipantStatuses ?? false,
      showParticipantNotes: draft.visibilityPolicy?.showParticipantNotes ?? false,
      showParticipantDeadlineOverrides: draft.visibilityPolicy?.showParticipantDeadlineOverrides ?? false
    }
  };
}

export function updateCollabDraft(draft: CreatorCollaborationDraft, update: Partial<CreatorCollaborationDraft>): CreatorCollaborationDraft {
  const next = cloneCreatorCollaborationDraft(draft);
  if (update.name !== undefined) next.name = update.name;
  if (update.sharedTag !== undefined) next.sharedTag = update.sharedTag;
  if (update.platforms) next.platforms = [...update.platforms];
  if (update.sharedInformation) next.sharedInformation = update.sharedInformation.map(item => createBlankCollabSharedInformation(item));
  if (update.deadlines) next.deadlines = update.deadlines.map(deadline => ({ ...deadline }));
  if (update.participants) next.participants = update.participants.map(participant => createBlankCollabParticipant(participant));
  if (update.visibilityPolicy) next.visibilityPolicy = {
    showParticipantStatuses: update.visibilityPolicy.showParticipantStatuses ?? next.visibilityPolicy.showParticipantStatuses,
    showParticipantNotes: update.visibilityPolicy.showParticipantNotes ?? next.visibilityPolicy.showParticipantNotes,
    showParticipantDeadlineOverrides: update.visibilityPolicy.showParticipantDeadlineOverrides ?? next.visibilityPolicy.showParticipantDeadlineOverrides
  };
  return next;
}

export function addCollabSharedInformation(draft: CreatorCollaborationDraft, item: CreatorCollabSharedInformation = createBlankCollabSharedInformation()): CreatorCollaborationDraft {
  const next = cloneCreatorCollaborationDraft(draft);
  if (!next.sharedInformation.some(existing => existing.id === item.id)) next.sharedInformation.push(createBlankCollabSharedInformation(item));
  return next;
}

export function updateCollabSharedInformation(draft: CreatorCollaborationDraft, itemId: string, update: Partial<CreatorCollabSharedInformation>): CreatorCollaborationDraft {
  const next = cloneCreatorCollaborationDraft(draft);
  const item = next.sharedInformation.find(candidate => candidate.id === itemId);
  if (!item) return next;
  Object.assign(item, update);
  if (update.platforms) item.platforms = [...update.platforms];
  if (update.appScope && update.appScope !== 'specific_apps') item.platforms = [];
  return next;
}

export function removeCollabSharedInformation(draft: CreatorCollaborationDraft, itemId: string): CreatorCollaborationDraft {
  const next = cloneCreatorCollaborationDraft(draft);
  next.sharedInformation = next.sharedInformation.filter(item => item.id !== itemId);
  return next;
}

export function addCollabDeadline(draft: CreatorCollaborationDraft, kind: CreatorCollabDeadlineKind = 'custom'): CreatorCollaborationDraft {
  const next = cloneCreatorCollaborationDraft(draft);
  const preset = CREATOR_COLLAB_DEADLINE_PRESETS.find(item => item.kind === kind);
  next.deadlines.push({ id: createCollabId('deadline'), kind, label: preset?.label || '', date: '' });
  return next;
}

export function addCustomCollabDeadline(draft: CreatorCollaborationDraft, label = ''): CreatorCollaborationDraft {
  const next = addCollabDeadline(draft, 'custom');
  const deadline = next.deadlines.at(-1);
  if (deadline) deadline.label = label.trim();
  return next;
}

export function upsertCollabDeadline(draft: CreatorCollaborationDraft, deadlineId: string, update: Partial<CreatorCollabDeadline>): CreatorCollaborationDraft {
  const next = cloneCreatorCollaborationDraft(draft);
  const deadline = next.deadlines.find(item => item.id === deadlineId);
  if (deadline) Object.assign(deadline, update);
  return next;
}

export function removeCollabDeadline(draft: CreatorCollaborationDraft, deadlineId: string): CreatorCollaborationDraft {
  const next = cloneCreatorCollaborationDraft(draft);
  next.deadlines = next.deadlines.filter(deadline => deadline.id !== deadlineId);
  next.participants.forEach(participant => { delete participant.deadlineOverrides[deadlineId]; });
  return next;
}

export function addCollabParticipant(draft: CreatorCollaborationDraft, participant: CreatorCollabParticipant = createBlankCollabParticipant()): CreatorCollaborationDraft {
  const next = cloneCreatorCollaborationDraft(draft);
  if (!next.participants.some(existing => existing.id === participant.id)) next.participants.push(createBlankCollabParticipant(participant));
  return next;
}

export function removeCollabParticipant(draft: CreatorCollaborationDraft, participantId: string): CreatorCollaborationDraft {
  const next = cloneCreatorCollaborationDraft(draft);
  next.participants = next.participants.filter(participant => participant.id !== participantId);
  return next;
}

export function updateCollabParticipant(draft: CreatorCollaborationDraft, participantId: string, update: Partial<CreatorCollabParticipant>): CreatorCollaborationDraft {
  const next = cloneCreatorCollaborationDraft(draft);
  const participant = next.participants.find(item => item.id === participantId);
  if (!participant) return next;
  Object.assign(participant, update);
  if (update.platforms) participant.platforms = [...update.platforms];
  if (update.referenceImages) participant.referenceImages = update.referenceImages.map(image => ({ ...image }));
  if (update.linkedWorkIds) participant.linkedWorkIds = [...update.linkedWorkIds];
  if (update.deadlineOverrides) participant.deadlineOverrides = { ...update.deadlineOverrides };
  return next;
}

export function addCollabParticipantReferenceImage(draft: CreatorCollaborationDraft, participantId: string, image: CreatorMediaItem): CreatorCollaborationDraft {
  const participant = draft.participants.find(item => item.id === participantId);
  if (!participant || participant.referenceImages.length >= CREATOR_MEDIA_MAX_ITEMS || participant.referenceImages.some(item => item.src === image.src)) return cloneCreatorCollaborationDraft(draft);
  return updateCollabParticipant(draft, participantId, { referenceImages: [...participant.referenceImages, { ...image }] });
}

export function removeCollabParticipantReferenceImage(draft: CreatorCollaborationDraft, participantId: string, imageId: string): CreatorCollaborationDraft {
  const participant = draft.participants.find(item => item.id === participantId);
  if (!participant) return cloneCreatorCollaborationDraft(draft);
  return updateCollabParticipant(draft, participantId, { referenceImages: participant.referenceImages.filter(image => image.id !== imageId) });
}

export function setCollabParticipantReferenceImageDimensions(draft: CreatorCollaborationDraft, participantId: string, imageId: string, naturalWidth: number, naturalHeight: number): CreatorCollaborationDraft {
  const participant = draft.participants.find(item => item.id === participantId);
  if (!participant || naturalWidth <= 0 || naturalHeight <= 0) return cloneCreatorCollaborationDraft(draft);
  const image = participant.referenceImages.find(item => item.id === imageId);
  if (!image || (image.naturalWidth === naturalWidth && image.naturalHeight === naturalHeight)) return cloneCreatorCollaborationDraft(draft);
  return updateCollabParticipant(draft, participantId, { referenceImages: participant.referenceImages.map(item => item.id === imageId ? { ...item, naturalWidth, naturalHeight } : item) });
}

export function getCollaborationSummary(draft: CreatorCollaborationDraft): CreatorCollaborationSummary {
  return { participants: draft.participants.length, dataApproved: draft.participants.filter(participant => participant.dataStatus === 'approved').length, imageApproved: draft.participants.filter(participant => participant.imageStatus === 'approved').length };
}

export function getCollabStatusLabel(status: CreatorCollabSubmissionStatus): string {
  return CREATOR_COLLAB_STATUS_OPTIONS.find(option => option.value === status)?.label || '⚪ ยังไม่ส่ง';
}

/**
 * Build the only Collaboration object that public Card/Detail/export surfaces may read.
 * Contact details are omitted by construction, including when an older private draft contains them.
 */
export function createPublicCollaborationSnapshot(draft: CreatorCollaborationDraft): PublicAssetCollaboration {
  const policy = {
    showParticipantStatuses: draft.visibilityPolicy?.showParticipantStatuses ?? false,
    showParticipantNotes: draft.visibilityPolicy?.showParticipantNotes ?? false,
    showParticipantDeadlineOverrides: draft.visibilityPolicy?.showParticipantDeadlineOverrides ?? false
  };

  return {
    name: draft.name.trim(),
    sharedTag: draft.sharedTag.trim().replace(/^#/, ''),
    platforms: draft.platforms.map(value => value.trim()).filter(Boolean),
    sharedInformation: draft.sharedInformation
      .filter(item => item.title.trim() || item.content.trim())
      .map(item => ({
        id: item.id,
        title: item.title.trim(),
        type: item.type,
        content: item.content,
        appScope: item.appScope,
        platforms: item.platforms.map(value => value.trim()).filter(Boolean)
      })),
    deadlines: draft.deadlines
      .filter(deadline => deadline.label.trim() || deadline.date)
      .map(deadline => ({ ...deadline, label: deadline.label.trim() })),
    participants: draft.participants
      .filter(participant => participant.creatorName.trim() || participant.externalWorkName.trim() || participant.referenceImages.length > 0)
      .map(participant => ({
        id: participant.id,
        isOwner: participant.isOwner,
        creatorName: participant.creatorName.trim(),
        houseTag: participant.houseTag.trim().replace(/^#/, ''),
        platforms: participant.platforms.map(value => value.trim()).filter(Boolean),
        externalWorkName: participant.externalWorkName.trim(),
        referenceImages: participant.referenceImages.map(image => ({ ...image })),
        linkedWorkIds: [...participant.linkedWorkIds],
        ...(policy.showParticipantStatuses ? { dataStatus: participant.dataStatus, imageStatus: participant.imageStatus } : {}),
        ...(policy.showParticipantNotes && participant.notes.trim() ? { notes: participant.notes } : {}),
        ...(policy.showParticipantDeadlineOverrides && participant.useDeadlineOverrides
          ? { deadlineOverrides: Object.fromEntries(Object.entries(participant.deadlineOverrides).filter(([, value]) => Boolean(value))) }
          : {})
      })),
    visibilityPolicy: policy
  };
}

export function createCollabDraftFromPublicSnapshot(snapshot: PublicAssetCollaboration): CreatorCollaborationDraft {
  return {
    name: snapshot.name,
    sharedTag: snapshot.sharedTag,
    platforms: [...snapshot.platforms],
    sharedInformation: snapshot.sharedInformation.map(item => ({ ...item, platforms: [...item.platforms] })),
    deadlines: snapshot.deadlines.map(deadline => ({ ...deadline })),
    participants: snapshot.participants.map(participant => createBlankCollabParticipant({
      ...participant,
      contact: '',
      dataStatus: participant.dataStatus || 'not_submitted',
      imageStatus: participant.imageStatus || 'not_submitted',
      notes: participant.notes || '',
      deadlineOverrides: participant.deadlineOverrides || {},
      useDeadlineOverrides: Boolean(participant.deadlineOverrides && Object.keys(participant.deadlineOverrides).length)
    })),
    visibilityPolicy: { ...snapshot.visibilityPolicy }
  };
}

function createCollabIdentityBlock(draft: CreatorCollaborationDraft): WorkContentBlock | null {
  const name = draft.name.trim();
  const sharedTag = draft.sharedTag.trim().replace(/^#/, '');
  const platforms = draft.platforms.map(platform => platform.trim()).filter(Boolean);
  if (!name && !sharedTag && platforms.length === 0) return null;
  const body = [
    sharedTag ? `แท็กคอลแลป: #${sharedTag}` : '',
    platforms.length ? `แอป / แพลตฟอร์ม: ${platforms.join(' · ')}` : ''
  ].filter(Boolean).join('\n');
  return { id: CREATOR_COLLAB_IDENTITY_BLOCK_ID, type: 'Note', title: name || 'ข้อมูลคอลแลป', body };
}

/** Public output is intentionally limited to Shared Information plus creator-entered public Collaboration identity. */
export function createPublicCollabContentBlocks(draft: CreatorCollaborationDraft): WorkContentBlock[] {
  const identity = createCollabIdentityBlock(draft);
  const sharedBlocks = draft.sharedInformation
    .filter(item => item.content.trim())
    .map<WorkContentBlock>(item => ({
      id: `${CREATOR_COLLAB_PUBLIC_BLOCK_PREFIX}${encodeURIComponent(JSON.stringify({ id: item.id, appScope: item.appScope, platforms: item.platforms }))}`,
      type: item.type === 'code' ? 'Prompt' : 'Text',
      title: item.title.trim() || 'ข้อมูลกลางของคอลแลป',
      body: item.content
    }));
  return [...(identity ? [identity] : []), ...sharedBlocks];
}

export function isPublicCollabContentBlock(block: Pick<WorkContentBlock, 'id'>): boolean {
  return block.id === CREATOR_COLLAB_IDENTITY_BLOCK_ID || block.id.startsWith(CREATOR_COLLAB_PUBLIC_BLOCK_PREFIX);
}

export function createCollabDraftFromPublicContentBlocks(blocks: WorkContentBlock[]): CreatorCollaborationDraft {
  const draft = createBlankCollaborationDraft();
  const identity = blocks.find(block => block.id === CREATOR_COLLAB_IDENTITY_BLOCK_ID);
  if (identity) {
    draft.name = identity.title === 'ข้อมูลคอลแลป' ? '' : identity.title.trim();
    identity.body.split(/\r?\n/).forEach(line => {
      if (line.startsWith('แท็กคอลแลป:')) draft.sharedTag = line.slice('แท็กคอลแลป:'.length).trim().replace(/^#/, '');
      if (line.startsWith('แอป / แพลตฟอร์ม:')) draft.platforms = line.slice('แอป / แพลตฟอร์ม:'.length).split('·').map(value => value.trim()).filter(Boolean);
    });
  }
  draft.sharedInformation = blocks
    .filter(block => block.id.startsWith(CREATOR_COLLAB_PUBLIC_BLOCK_PREFIX))
    .map(block => {
      const encoded = block.id.slice(CREATOR_COLLAB_PUBLIC_BLOCK_PREFIX.length);
      let metadata: Partial<Pick<CreatorCollabSharedInformation, 'id' | 'appScope' | 'platforms'>> = { id: encoded };
      try {
        const parsed = JSON.parse(decodeURIComponent(encoded));
        if (parsed && typeof parsed === 'object') metadata = parsed;
      } catch { /* Older public Collab blocks used the raw item id. */ }
      return createBlankCollabSharedInformation({
        id: typeof metadata.id === 'string' ? metadata.id : undefined,
        title: block.title,
        type: block.type === 'Prompt' ? 'code' : 'text',
        content: block.body,
        appScope: metadata.appScope === 'all_apps' || metadata.appScope === 'specific_apps' ? metadata.appScope : 'unspecified',
        platforms: Array.isArray(metadata.platforms) ? metadata.platforms.filter(platform => typeof platform === 'string') : []
      });
    });
  return draft;
}
