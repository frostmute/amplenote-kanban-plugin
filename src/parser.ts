import { fromMarkdown } from 'mdast-util-from-markdown';
import { visit } from 'unist-util-visit';

/**
 * Parses markdown to extract sections and map tasks to them.
 * Handles hidden UUID comments injected by Amplenote.
 */
export async function parseKanbanData(app: any, markdown: string) {
  const tree = fromMarkdown(markdown);
  
  const columns: {id: string, title: string, tasks: any[]}[] = [];
  let currentColumn: {id: string, title: string, tasks: any[]} | null = null;
  
  // If no initial heading, create a default "Uncategorized" column
  const defaultColumn = { id: "uncategorized", title: "Uncategorized", tasks: [] as any[] };
  
  visit(tree, (node) => {
    if (node.type === 'heading') {
      // Extract heading text
      const title = node.children
        .filter((n: any) => 'value' in n)
        .map((n: any) => (n as any).value as string)
        .join('');
        
      currentColumn = {
        id: `col-${columns.length}`,
        title: title.trim(),
        tasks: []
      };
      columns.push(currentColumn);
    } 
    else if (node.type === 'listItem' || node.type === 'paragraph') {
      let htmlNode: any = null;
      let textContent: string = '';
      
      visit(node, (child: any) => {
        if (child.type === 'html' && (child.value as string).includes('<!-- {"uuid":')) {
          htmlNode = child;
        }
        if ('value' in child && child.type !== 'html') {
          textContent += (child.value as string);
        }
      });
      
      if (htmlNode) {
        const uuidMatch = htmlNode.value.match(/<!-- \{"uuid":"(.+?)"\} -->/);
        if (uuidMatch) {
          const taskUUID = uuidMatch[1];
          const targetCol = currentColumn || defaultColumn;
          
          targetCol.tasks.push({
            id: taskUUID,
            content: textContent.trim()
          });
          
          if (!columns.some(c => c.id === defaultColumn.id) && targetCol === defaultColumn) {
            columns.unshift(defaultColumn);
          }
        }
      }
    }
  });
  
  // Now we have the AST mapping, but we should enrich it with real task data from the API
  for (const col of columns) {
    for (let i = 0; i < col.tasks.length; i++) {
      const task = col.tasks[i];
      try {
        const apiTask = await app.getTask(task.id);
        if (apiTask) {
          col.tasks[i] = {
            ...task,
            ...apiTask, // merge in completedAt, etc.
          };
        }
      } catch (e) {
        console.error(`Failed to fetch task ${task.id}`, e);
      }
    }
  }

  return { columns };
}
