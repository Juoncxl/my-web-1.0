import React, { useMemo } from 'react';
import { buildSafeUiPreviewDocument } from '../lib/uiCodePreview';

interface SandboxedCodePreviewProps {
  code: string;
  className?: string;
  minHeight?: string;
}

export const SandboxedCodePreview: React.FC<SandboxedCodePreviewProps> = ({
  code,
  className = '',
  minHeight = '180px'
}) => {
  const fullHtml = useMemo(() => buildSafeUiPreviewDocument(code), [code]);

  return (
    <iframe
      srcDoc={fullHtml}
      title="UI Code Preview"
      sandbox=""
      className={`w-full rounded-xl border-0 bg-transparent transition-all ${className}`}
      style={{ minHeight }}
    />
  );
};
