import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Column as ColumnType } from '../types';
import { Card } from './Card';

interface ColumnProps {
  column: ColumnType;
}

export const Column: React.FC<ColumnProps> = ({ column }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '300px',
      minWidth: '300px',
      backgroundColor: '#ebecf0',
      borderRadius: '8px',
      padding: '8px',
      boxSizing: 'border-box'
    }}>
      <h3 style={{ margin: '0 0 12px 0', padding: '0 8px', fontSize: '16px', fontWeight: 600, color: '#172b4d' }}>
        {column.title}
      </h3>
      
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
              <Card key={task.id} task={task} index={index} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      
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
      >
        + Add Task
      </button>
    </div>
  );
};
