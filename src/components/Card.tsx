import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Card as CardType } from '../types';

interface CardProps {
  task: CardType;
  index: number;
}

export const Card: React.FC<CardProps> = ({ task, index }) => {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{
            userSelect: 'none',
            padding: '12px',
            margin: '0 0 8px 0',
            backgroundColor: '#ffffff',
            borderRadius: '4px',
            boxShadow: snapshot.isDragging 
              ? '0 5px 10px rgba(0,0,0,0.15)' 
              : '0 1px 2px rgba(9,30,66,0.25)',
            ...provided.draggableProps.style
          }}
        >
          <div style={{ fontWeight: 500, color: '#172b4d', fontSize: '14px', marginBottom: task.body ? '8px' : '0' }}>
            {task.text}
          </div>
          {task.body && (
            <div style={{ fontSize: '12px', color: '#5e6c84', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {task.body}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};
