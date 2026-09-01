// Legacy compatibility entry point. Canonical Work viewing is implemented in
// WorkDetailModal and all new production/QA callers import that path directly.
export { WorkDetailModal as AssetViewModal } from './WorkDetailModal';
export type { WorkDetailModalProps as AssetViewModalProps } from './WorkDetailModal';
