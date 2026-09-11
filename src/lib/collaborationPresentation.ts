/** Normalize a participant's house tag for the standalone tag-copy button. */
export function getParticipantTagCopy(houseTag?: string | null): string {
  const normalized = houseTag?.trim().replace(/^#+/, '') || '';
  return normalized ? `#${normalized}` : '';
}

/** Copy only the participant-authored note body, without presentation metadata. */
export function getParticipantContentCopy(notes?: string | null): string {
  return notes?.trim() || '';
}
