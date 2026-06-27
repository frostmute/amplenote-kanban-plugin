import React, { useState } from 'react';
import { DragDropContext, DropResult, Droppable } from '@hello-pangea/dnd';
import { Board as BoardType } from '../types';
import { mockBoard } from '../mockData';
import { Column } from './Column';

export const Board: React.FC = () => {
  const [board, setBoard] = useState<BoardType>(mockBoard);

  const onDragEnd = (result: DropResult) => {
    const { destination, source } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceColIndex = board.columns.findIndex(col => col.id === source.droppableId);
    const destColIndex = board.columns.findIndex(col => col.id === destination.droppableId);

    if (sourceColIndex === -1 || destColIndex === -1) {
      return;
    }

    const newColumns = Array.from(board.columns);
    const sourceCol = newColumns[sourceColIndex];
    const destCol = newColumns[destColIndex];

    const sourceTasks = Array.from(sourceCol.tasks);
    const destTasks = source.droppableId === destination.droppableId 
      ? sourceTasks 
      : Array.from(destCol.tasks);

    const [movedTask] = sourceTasks.splice(source.index, 1);
    destTasks.splice(destination.index, 0, movedTask);

    if (source.droppableId === destination.droppableId) {
      newColumns[sourceColIndex] = { ...sourceCol, tasks: sourceTasks };
    } else {
      newColumns[sourceColIndex] = { ...sourceCol, tasks: sourceTasks };
      newColumns[destColIndex] = { ...destCol, tasks: destTasks };
    }

    setBoard({ columns: newColumns });
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div style={{ display: 'flex', overflowX: 'auto', padding: '16px', gap: '16px', height: '100vh', boxSizing: 'border-box', backgroundColor: '#f4f5f7' }}>
        {board.columns.map(column => (
          <Column key={column.id} column={column} />
        ))}
      </div>
    </DragDropContext>
  );
};
