import React from 'react';
import { createRoot } from 'react-dom/client';
import { Board } from './components/Board';
import { mockBoard } from './mockData';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Board initialBoard={mockBoard} onBoardUpdate={(md) => console.log('Mock Update:', md)} />);
}
