import React from 'react';

// react-grid-layout resizable panel grid
export default function PanelGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>;
}
