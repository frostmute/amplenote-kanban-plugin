import React, { useState, useEffect } from 'react';
import { DragDropContext, DropResult, Droppable, Draggable } from '@hello-pangea/dnd';
import { Board as BoardType } from '../types';
import { Column } from './Column';
import { serializeBoardToMarkdown } from '../services/markdownSerializer';

// We'll receive the initial board state and an update callback from the parent App
interface BoardProps {
  initialBoard: BoardType;
  onBoardUpdate: (markdown: string) => void;
  onNavigateToNote?: (uuid: string) => void;
}

export const Board: React.FC<BoardProps> = ({ initialBoard, onBoardUpdate, onNavigateToNote }) => {
  const [board, setBoard] = useState<BoardType>(initialBoard);

  // Sync internal state if props change (e.g., initial load finishes)
  useEffect(() => {
    setBoard(initialBoard);
  }, [initialBoard]);

  const onDragEnd = (result: DropResult) => {
    const { destination, source, type } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    if (type === 'column') {
        const newColumns = Array.from(board.columns);
        const [movedCol] = newColumns.splice(source.index, 1);
        newColumns.splice(destination.index, 0, movedCol);

        const newBoardState = { columns: newColumns };
        setBoard(newBoardState);
        const newMarkdown = serializeBoardToMarkdown(newBoardState);
        onBoardUpdate(newMarkdown);
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
        // Check column limits if they are set (limit parsed from column title, e.g. "To Do [5]")
        const destLimitMatch = destCol.title.match(/\[(\d+)\]/);
        if (destLimitMatch) {
            const limit = parseInt(destLimitMatch[1], 10);
            if (destCol.tasks.length >= limit) {
                // Return without modifying if the limit is reached
                alert(`Cannot move task to ${destCol.title}: Column limit (${limit}) reached.`);
                return;
            }
        }
        
        newColumns[sourceColIndex] = { ...sourceCol, tasks: sourceTasks };
        newColumns[destColIndex] = { ...destCol, tasks: destTasks };
      }

    const newBoardState = { columns: newColumns };
    setBoard(newBoardState);
    
    // Serialize and send up to Amplenote
    const newMarkdown = serializeBoardToMarkdown(newBoardState);
    onBoardUpdate(newMarkdown);
  };

  const handleEditTask = (taskId: string, newText: string) => {
    const newColumns = board.columns.map(col => ({
        ...col,
        tasks: col.tasks.map(task => 
            task.id === taskId ? { ...task, text: newText } : task
        )
    }));
    
    const newBoardState = { columns: newColumns };
    setBoard(newBoardState);
    
    const newMarkdown = serializeBoardToMarkdown(newBoardState);
    onBoardUpdate(newMarkdown);
  };

  const handleAddTask = (columnId: string, text: string) => {
    const newTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text
    };

    const newColumns = board.columns.map(col => {
        if (col.id === columnId) {
            return {
                ...col,
                tasks: [...col.tasks, newTask]
            };
        }
        return col;
    });

    const newBoardState = { columns: newColumns };
    setBoard(newBoardState);
    
    const newMarkdown = serializeBoardToMarkdown(newBoardState);
    onBoardUpdate(newMarkdown);
  };

  const handleEditColumnTitle = (columnId: string, newTitle: string) => {
    const newColumns = board.columns.map(col => 
        col.id === columnId ? { ...col, title: newTitle } : col
    );

    const newBoardState = { columns: newColumns };
    setBoard(newBoardState);
    
    const newMarkdown = serializeBoardToMarkdown(newBoardState);
    onBoardUpdate(newMarkdown);
  };

  const handleDeleteColumn = (columnId: string) => {
    // Find the column to delete and its tasks
    const columnToDelete = board.columns.find(col => col.id === columnId);
    if (!columnToDelete) return;

    let uncategorizedCol = board.columns.find(col => col.id === 'uncategorized');
    
    // Create new columns list, excluding the deleted one
    let newColumns = board.columns.filter(col => col.id !== columnId);

    // If there wasn't an uncategorized column, we need to create one, OR add to existing
    if (!uncategorizedCol) {
        uncategorizedCol = {
            id: 'uncategorized',
            title: 'Uncategorized',
            tasks: [...columnToDelete.tasks]
        };
        newColumns = [uncategorizedCol, ...newColumns];
    } else {
        newColumns = newColumns.map(col => {
            if (col.id === 'uncategorized') {
                return {
                    ...col,
                    tasks: [...col.tasks, ...columnToDelete.tasks]
                };
            }
            return col;
        });
    }

    const newBoardState = { columns: newColumns };
    setBoard(newBoardState);
    
    const newMarkdown = serializeBoardToMarkdown(newBoardState);
    onBoardUpdate(newMarkdown);
  };

  const handleAddColumn = () => {
    const newTitle = prompt('Enter new column name:');
    if (newTitle && newTitle.trim()) {
        const newColumn = {
            id: `col-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: newTitle.trim(),
            tasks: []
        };
        const newBoardState = { columns: [...board.columns, newColumn] };
        setBoard(newBoardState);
        
        const newMarkdown = serializeBoardToMarkdown(newBoardState);
        onBoardUpdate(newMarkdown);
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="all-columns" direction="horizontal" type="column">
        {(provided) => (
          <div 
            {...provided.droppableProps}
            ref={provided.innerRef}
            style={{ display: 'flex', overflowX: 'auto', padding: '16px', gap: '16px', height: '100vh', boxSizing: 'border-box', backgroundColor: '#f4f5f7' }}
          >
            {board.columns.map((column, index) => (
              <Draggable key={column.id} draggableId={column.id} index={index}>
                {(provided) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        style={{ ...provided.draggableProps.style, display: 'flex' }}
                    >
                      <Column 
                        column={column} 
                        onEditTask={handleEditTask}
                        onAddTask={handleAddTask}
                        onEditColumnTitle={handleEditColumnTitle}
                        onDeleteColumn={handleDeleteColumn}
                        onNavigateToNote={onNavigateToNote}
                        dragHandleProps={provided.dragHandleProps}
                      />
                    </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            <div style={{ minWidth: '300px' }}>
                <button
                    onClick={handleAddColumn}
                    style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: 'rgba(9, 30, 66, 0.04)',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#172b4d',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontWeight: 500,
                        fontSize: '14px',
                        transition: 'background-color 0.2s ease'
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(9, 30, 66, 0.08)')}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'rgba(9, 30, 66, 0.04)')}
                >
                    + Add another list
                </button>
            </div>
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};
