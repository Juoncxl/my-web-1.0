import React, { useMemo } from 'react';

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
  const fullHtml = useMemo(() => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Prompt:ital,wght@0,300;0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: 'Prompt', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: transparent;
      overflow: auto;
    }
  </style>
</head>
<body>
  ${code || ''}
</body>
</html>`;
  }, [code]);

  return (
    <iframe
      srcDoc={fullHtml}
      title="UI Code Preview"
      sandbox="allow-scripts"
      className={`w-full rounded-xl border-0 bg-transparent transition-all ${className}`}
      style={{ minHeight }}
    />
  );
};
