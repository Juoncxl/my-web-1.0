/** Public participant copy contains only the promotion-ready house tag and note body. */
export function getParticipantPromotionCopy(houseTag?: string | null, notes?: string | null): string {
  const normalized = houseTag?.trim().replace(/^#+/, '') || '';
  const noteBody = notes?.trim() || '';
  return [normalized ? `#${normalized}` : '', noteBody].filter(Boolean).join('\n\n');
}
