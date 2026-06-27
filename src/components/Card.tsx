import React, { useState, useRef, useEffect } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Card as CardType } from '../types';

interface CardProps {
  task: CardType;
  index: number;
  onEdit?: (taskId: string, newText: string) => void;
  onNavigateToNote?: (uuid: string) => void;
}

const renderRichText = (text: string, onNavigateToNote?: (uuid: string) => void) => {
    if (!text) return text;
    
    // Simplistic regex for markdown links [text](url) and Amplenote notes [text](https://www.amplenote.com/notes/uuid)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }
        
        const linkText = match[1];
        const linkUrl = match[2];
        
        const amplenoteMatch = linkUrl.match(/^https:\/\/www\.amplenote\.com\/notes\/([a-zA-Z0-9-]+)$/);
        
        if (amplenoteMatch && onNavigateToNote) {
            const uuid = amplenoteMatch[1];
            parts.push(
                <a 
                    key={match.index} 
                    href={linkUrl} 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onNavigateToNote(uuid);
                    }}
                    style={{ color: '#0052cc', cursor: 'pointer', textDecoration: 'none' }}
                >
                    {linkText}
                </a>
            );
        } else {
            parts.push(
                <a 
                    key={match.index} 
                    href={linkUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: '#0052cc', textDecoration: 'none' }}
                >
                    {linkText}
                </a>
            );
        }
        lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
};

export const Card: React.FC<CardProps> = ({ task, index, onEdit, onNavigateToNote }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
    }
  }, [isEditing]);

  const handleSave = () => {
    setIsEditing(false);
    if (editText.trim() !== task.text && onEdit) {
      onEdit(task.id, editText.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText(task.text);
    }
  };

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
          onClick={(e) => {
            // Prevent entering edit mode when dragging
            if (!snapshot.isDragging) {
                setIsEditing(true);
            }
          }}
        >
          {isEditing ? (
            <textarea
              ref={inputRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
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
          ) : (
            <>
                <div style={{ fontWeight: 500, color: '#172b4d', fontSize: '14px', marginBottom: task.body ? '8px' : '0' }}>
                  {renderRichText(task.text, onNavigateToNote)}
                </div>
                {task.body && (
                  <div style={{ fontSize: '12px', color: '#5e6c84', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                    {renderRichText(task.body, onNavigateToNote)}
                  </div>
                )}
                {task.firstImage && (
                    <img 
                        src={task.firstImage.url} 
                        alt={task.firstImage.alt || 'embedded image'} 
                        style={{ maxWidth: '100%', marginTop: '8px', borderRadius: '4px' }}
                    />
                )}
                {(task.labels && task.labels.length > 0 || task.startDate) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                        {task.startDate && (
                            <span style={{ backgroundColor: '#ebecf0', color: '#5e6c84', padding: '2px 4px', borderRadius: '3px', fontSize: '12px', display: 'flex', alignItems: 'center' }}>
                                📅 {task.startDate}
                            </span>
                        )}
                        {task.labels && task.labels.map(label => (
                            <span key={label} style={{ backgroundColor: '#e3fcef', color: '#006644', padding: '2px 4px', borderRadius: '3px', fontSize: '12px' }}>
                                #{label}
                            </span>
                        ))}
                    </div>
                )}
            </>
          )}
        </div>
      )}
    </Draggable>
  );
};
