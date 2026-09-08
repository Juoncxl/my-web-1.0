/** Public participant copy is intentionally limited to the creator's house tag. */
export function getParticipantHouseTagCopy(houseTag?: string | null): string {
  const normalized = houseTag?.trim().replace(/^#+/, '') || '';
  return normalized ? `#${normalized}` : '';
}
