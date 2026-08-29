import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Asset } from '../types';
import { findAssetById } from '../lib/assetSelection';

export type AssetEditorState =
  | { mode: 'create' }
  | { mode: 'edit'; assetId: string };

export function useAssetModalState(assets: readonly Asset[]) {
  const [viewingAssetId, setViewingAssetId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<AssetEditorState | null>(null);
  const [reportingAssetId, setReportingAssetId] = useState<string | null>(null);
  const [movingAssetId, setMovingAssetId] = useState<string | null>(null);

  const viewingAsset = useMemo(
    () => findAssetById(assets, viewingAssetId),
    [assets, viewingAssetId]
  );
  const editingAsset = useMemo(
    () => editorState?.mode === 'edit'
      ? findAssetById(assets, editorState.assetId)
      : null,
    [assets, editorState]
  );
  const reportingAsset = useMemo(
    () => findAssetById(assets, reportingAssetId),
    [assets, reportingAssetId]
  );
  const movingAsset = useMemo(
    () => findAssetById(assets, movingAssetId),
    [assets, movingAssetId]
  );

  // A deleted or otherwise unavailable asset must not leave an orphaned
  // selection that can reopen a modal with stale domain data.
  useEffect(() => {
    if (viewingAssetId && !viewingAsset) setViewingAssetId(null);
    if (reportingAssetId && !reportingAsset) setReportingAssetId(null);
    if (movingAssetId && !movingAsset) setMovingAssetId(null);
    if (editorState?.mode === 'edit' && !editingAsset) setEditorState(null);
  }, [editingAsset, editorState, movingAsset, movingAssetId, reportingAsset, reportingAssetId, viewingAsset, viewingAssetId]);

  const openAssetView = useCallback((assetId: string) => {
    setViewingAssetId(assetId);
  }, []);

  const closeAssetView = useCallback(() => {
    setViewingAssetId(null);
  }, []);

  const openCreateEditor = useCallback(() => {
    setEditorState({ mode: 'create' });
  }, []);

  const openEditEditor = useCallback((assetId: string) => {
    setEditorState({ mode: 'edit', assetId });
    setViewingAssetId(null);
  }, []);

  const closeEditor = useCallback(() => {
    setEditorState(null);
  }, []);

  const openReport = useCallback((assetId: string) => {
    setReportingAssetId(assetId);
  }, []);

  const closeReport = useCallback(() => {
    setReportingAssetId(null);
  }, []);

  const openMoveToFolder = useCallback((assetId: string) => {
    setMovingAssetId(assetId);
  }, []);

  const closeMoveToFolder = useCallback(() => {
    setMovingAssetId(null);
  }, []);

  const clearSelectionsForAsset = useCallback((assetId: string) => {
    setViewingAssetId(previous => previous === assetId ? null : previous);
    setReportingAssetId(previous => previous === assetId ? null : previous);
    setMovingAssetId(previous => previous === assetId ? null : previous);
    setEditorState(previous => previous?.mode === 'edit' && previous.assetId === assetId ? null : previous);
  }, []);

  return {
    viewingAssetId,
    viewingAsset,
    editingAssetId: editorState?.mode === 'edit' ? editorState.assetId : null,
    editingAsset,
    editorState,
    isEditorOpen: editorState?.mode === 'create' || Boolean(editingAsset),
    reportingAssetId,
    reportingAsset,
    movingAssetId,
    movingAsset,
    openAssetView,
    closeAssetView,
    openCreateEditor,
    openEditEditor,
    closeEditor,
    openReport,
    closeReport,
    openMoveToFolder,
    closeMoveToFolder,
    clearSelectionsForAsset
  };
}
