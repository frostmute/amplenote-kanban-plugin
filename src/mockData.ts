import { Board } from './types';

export const mockBoard: Board = {
  columns: [
    {
      id: 'col-todo',
      title: 'To Do',
      tasks: [
        { id: 'card-1', text: 'Initialize project configuration', body: 'Create package.json, tsconfig.json, and build scripts.' },
        { id: 'card-2', text: 'Create mock state and data models', body: 'Define Board, Column, and Card types.' }
      ]
    },
    {
      id: 'col-doing',
      title: 'Doing',
      tasks: [
        { id: 'card-3', text: 'Create Kanban Board and Drag-and-Drop context' }
      ]
    },
    {
      id: 'col-done',
      title: 'Done',
      tasks: [
        { id: 'card-4', text: 'Read the spec', body: 'Familiarize with the markdown-backed kanban requirements.' }
      ]
    }
  ]
};
