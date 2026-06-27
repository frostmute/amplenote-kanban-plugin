import { describe, it, expect } from 'vitest';
import { KanbanCore } from './kanban-core';

describe('KanbanCore.parseBoard', () => {
  it('should parse standard markdown with headings and tasks', () => {
    const markdown = `
# To Do
- [ ] Task 1
- [ ] Task 2

# In Progress
- [ ] Task 3

# Done
- [x] Task 4
`;
    const board = KanbanCore.parseBoard(markdown);
    expect(board.columns.length).toBe(3);
    
    expect(board.columns[0].title).toBe('To Do');
    expect(board.columns[0].tasks.length).toBe(2);
    expect(board.columns[0].tasks[0].text).toBe('Task 1');
    expect(board.columns[0].tasks[0].checked).toBe(false);
    expect(board.columns[0].tasks[1].text).toBe('Task 2');
    
    expect(board.columns[1].title).toBe('In Progress');
    expect(board.columns[1].tasks.length).toBe(1);
    expect(board.columns[1].tasks[0].text).toBe('Task 3');
    
    expect(board.columns[2].title).toBe('Done');
    expect(board.columns[2].tasks.length).toBe(1);
    expect(board.columns[2].tasks[0].text).toBe('Task 4');
    expect(board.columns[2].tasks[0].checked).toBe(true);
  });

  it('should handle markdown with no headings (implicit backlog)', () => {
    const markdown = `
- [ ] Task A
- [x] Task B
`;
    const board = KanbanCore.parseBoard(markdown);
    expect(board.columns.length).toBe(1);
    expect(board.columns[0].title).toBe('(No heading)');
    expect(board.columns[0].tasks.length).toBe(2);
    expect(board.columns[0].tasks[0].text).toBe('Task A');
    expect(board.columns[0].tasks[1].text).toBe('Task B');
  });

  it('should gracefully handle markdown with text between tasks', () => {
    const markdown = `
# Column 1
- [ ] Task with body
This is the body of the task.
It spans multiple lines.

- [ ] Next task
`;
    const board = KanbanCore.parseBoard(markdown);
    expect(board.columns.length).toBe(1);
    expect(board.columns[0].tasks.length).toBe(2);
    
    const firstTask = board.columns[0].tasks[0];
    expect(firstTask.text).toBe('Task with body');
    expect(firstTask.body).toContain('This is the body of the task.');
    expect(firstTask.body).toContain('It spans multiple lines.');
    
    expect(board.columns[0].tasks[1].text).toBe('Next task');
  });

  it('should extract hidden UUID comments if present', () => {
    const markdown = `
# Test
- [ ] Task with UUID <!-- {"uuid":"1234-5678"} -->
`;
    const board = KanbanCore.parseBoard(markdown);
    expect(board.columns[0].tasks[0].text).toBe('Task with UUID');
    expect(board.columns[0].tasks[0].meta).toEqual({ uuid: '1234-5678' });
    expect(board.columns[0].tasks[0].id).toBe('1234-5678');
  });
});
