import React from 'react';
import { AllocationBlocks } from './memory/AllocationBlocks';

export const AllocatorVisualizer: React.FC = () => {
  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <AllocationBlocks />
    </div>
  );
};

export default AllocatorVisualizer;
