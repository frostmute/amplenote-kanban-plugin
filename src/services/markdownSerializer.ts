import { Board, Column, Card } from './types';

/**
 * Serializes a React Board state back into a valid Markdown string.
 * This will replace the entire content of the note.
 *
 * NOTE: Currently this is a destructive serialization that only preserves headings and tasks.
 * Preserving text *outside* of tasks is more complex and requires either updating specific lines
 * or a more robust AST mapping strategy (like what's in surgery.ts). For Phase 3 MVP, we simply
 * rebuild the markdown from the state.
 */
export function serializeBoardToMarkdown(board: Board): string {
  let markdown = '';

  for (let i = 0; i < board.columns.length; i++) {
    const col = board.columns[i];
    
    // Add Column Heading (only if it's not the implicit "Uncategorized" column at index 0)
    if (col.id !== 'uncategorized' || col.title !== 'Uncategorized') {
       // ensure spacing between sections
       if (i > 0) markdown += '\n\n';
       markdown += `## ${col.title}\n\n`;
    }

    // Add Tasks
    for (const task of col.tasks) {
       // Is this the last column? (Assuming last column means "Done")
       const isLastColumn = i === board.columns.length - 1;
       
       let prefix = '- [ ] ';
       if (isLastColumn) {
          prefix = '- [x] ';
       }
       
       // Note: we can't easily inject the hidden UUID comment back in a way Amplenote respects, 
       // but updating the text of the note will likely re-parse them. 
       // For this minimal serialization, we just output the markdown.
       markdown += `${prefix}${task.text}\n`;
    }
  }

  return markdown.trim();
}
