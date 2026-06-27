import React, { useState, useRef, useEffect } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Column as ColumnType } from '../types';
import { Card } from './Card';

interface ColumnProps {
  column: ColumnType;
  onEditTask?: (taskId: string, newText: string) => void;
  onAddTask?: (columnId: string, text: string) => void;
  onEditColumnTitle?: (columnId: string, newTitle: string) => void;
  onDeleteColumn?: (columnId: string) => void;
  onNavigateToNote?: (uuid: string) => void;
  dragHandleProps?: any;
}

export const Column: React.FC<ColumnProps> = ({ column, onEditTask, onAddTask, onEditColumnTitle, onDeleteColumn, onNavigateToNote, dragHandleProps }) => {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleText, setEditTitleText] = useState(column.title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
        titleInputRef.current.focus();
        titleInputRef.current.setSelectionRange(titleInputRef.current.value.length, titleInputRef.current.value.length);
    }
  }, [isEditingTitle]);

  const handleAddTaskSubmit = () => {
    if (newTaskText.trim() && onAddTask) {
      onAddTask(column.id, newTaskText.trim());
    }
    setIsAddingTask(false);
    setNewTaskText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddTaskSubmit();
    }
    if (e.key === 'Escape') {
      setIsAddingTask(false);
      setNewTaskText('');
    }
  };

  const handleTitleSave = () => {
    setIsEditingTitle(false);
    if (editTitleText.trim() && editTitleText.trim() !== column.title && onEditColumnTitle) {
        onEditColumnTitle(column.id, editTitleText.trim());
    } else {
        setEditTitleText(column.title);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleTitleSave();
    }
    if (e.key === 'Escape') {
        setIsEditingTitle(false);
        setEditTitleText(column.title);
    }
  };

  const isUncategorized = column.id === 'uncategorized' && column.title === 'Uncategorized';
  
  const limitMatch = column.title.match(/\[(\d+)\]/);
  const limit = limitMatch ? parseInt(limitMatch[1], 10) : null;
  const isNearLimit = limit !== null && column.tasks.length >= limit;
  const isOverLimit = limit !== null && column.tasks.length > limit;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '300px',
      minWidth: '300px',
      backgroundColor: isOverLimit ? '#ffebe6' : isNearLimit ? '#fffae6' : '#ebecf0',
      borderRadius: '8px',
      padding: '8px',
      boxSizing: 'border-box',
      border: isOverLimit ? '2px solid #bf2600' : isNearLimit ? '2px solid #ff8b00' : 'none'
    }}>
      <div 
        {...dragHandleProps}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 12px 0', padding: '0 8px', cursor: 'grab' }}
      >
        {isEditingTitle ? (
            <input 
                ref={titleInputRef}
                value={editTitleText}
                onChange={(e) => setEditTitleText(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKeyDown}
                style={{
                    flexGrow: 1,
                    fontSize: '16px',
                    fontWeight: 600,
                    padding: '4px',
                    marginRight: '8px',
                    border: '1px solid #0052cc',
                    borderRadius: '3px'
                }}
            />
        ) : (
            <h3 
                style={{ fontSize: '16px', fontWeight: 600, color: '#172b4d', margin: 0, cursor: isUncategorized ? 'default' : 'text' }}
                onClick={(e) => {
                    // Prevent drag handle from interfering with click to edit
                    e.stopPropagation();
                    if (!isUncategorized) setIsEditingTitle(true);
                }}
            >
                {column.title}
            </h3>
        )}
        
        {!isUncategorized && onDeleteColumn && (
            <button
                onClick={() => {
                    if (window.confirm(`Are you sure you want to delete the column "${column.title}"? Tasks will be moved to Uncategorized.`)) {
                        onDeleteColumn(column.id);
                    }
                }}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#6b778c',
                    cursor: 'pointer',
                    fontSize: '16px',
                    padding: '4px'
                }}
                title="Delete column"
            >
                &times;
            </button>
        )}
      </div>
      
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{
              flexGrow: 1,
              minHeight: '100px',
              transition: 'background-color 0.2s ease',
              backgroundColor: snapshot.isDraggingOver ? '#dfe1e6' : 'transparent',
              borderRadius: '4px'
            }}
          >
            {column.tasks.map((task, index) => (
              <Card key={task.id} task={task} index={index} onEdit={onEditTask} onNavigateToNote={onNavigateToNote} />
            ))}
            {provided.placeholder}
            
            {isAddingTask && (
                <div style={{ padding: '8px 0' }}>
                  <textarea
                    autoFocus
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onBlur={handleAddTaskSubmit}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter task text..."
                    style={{
                        width: '100%',
                        minHeight: '40px',
                        border: '1px solid #0052cc',
                        borderRadius: '3px',
                        padding: '4px',
                        fontFamily: 'inherit',
                        fontSize: '14px',
                        resize: 'none',
                        boxSizing: 'border-box'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button 
                        onClick={handleAddTaskSubmit}
                        style={{ backgroundColor: '#0052cc', color: 'white', border: 'none', borderRadius: '3px', padding: '4px 8px', cursor: 'pointer' }}
                    >
                        Add
                    </button>
                    <button 
                        onClick={() => setIsAddingTask(false)}
                        style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                    >
                        Cancel
                    </button>
                  </div>
                </div>
            )}
          </div>
        )}
      </Droppable>
      
      {!isAddingTask && (
        <button style={{
            marginTop: '8px',
            padding: '8px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '4px',
            color: '#5e6c84',
            cursor: 'pointer',
            textAlign: 'left',
            fontWeight: 500,
            transition: 'background-color 0.2s ease'
        }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#dadce2')}
        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        onClick={() => setIsAddingTask(true)}
        >
            + Add Task
        </button>
      )}
    </div>
  );
};
