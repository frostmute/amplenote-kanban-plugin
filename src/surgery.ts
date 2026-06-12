import { fromMarkdown } from 'mdast-util-from-markdown';
import { visit } from 'unist-util-visit';

/**
 * Performs raw string surgery on markdown to move a task block from its current
 * location to a new heading, at a specific index. Avoids corrupting frontmatter
 * or unsupported markdown extensions by not using AST serialization.
 */
export function moveTaskInMarkdown(
  markdown: string,
  taskId: string,
  destColTitle: string,
  newIndex: number,
  isLastColumn: boolean
): string {
  const tree = fromMarkdown(markdown);
  
  let taskNode: any = null;

  // 1. Locate the exact start/end offset of the task
  visit(tree, 'listItem', (node) => {
    let hasUuid = false;
    visit(node, 'html', (htmlNode: any) => {
      if (htmlNode.value.includes(`<!-- {"uuid":"${taskId}"} -->`)) {
        hasUuid = true;
      }
    });
    if (hasUuid) {
      taskNode = node;
    }
  });

  if (!taskNode || !taskNode.position) return markdown;

  const startOffset = taskNode.position.start.offset;
  const endOffset = taskNode.position.end.offset;

  let taskStr = markdown.substring(startOffset, endOffset);

  // 2. Update checkbox state if moving to/from the final column
  if (isLastColumn) {
    taskStr = taskStr.replace(/^(\s*[-*+]\s+)\[[ \]]\]/, '$1[x]');
  } else {
    taskStr = taskStr.replace(/^(\s*[-*+]\s+)\[[xX]\]/, '$1[ ]');
  }

  // 3. Remove task from original string
  let prefix = markdown.substring(0, startOffset);
  let suffix = markdown.substring(endOffset);

  // Clean up double newlines left behind
  if (prefix.endsWith('\n') && suffix.startsWith('\n')) {
    suffix = suffix.substring(1);
  }

  const markdownWithoutTask = prefix + suffix;

  // 4. Reparse the cleaned string to find the destination heading
  const tree2 = fromMarkdown(markdownWithoutTask);
  let destHeadingNode: any = null;
  let destHeadingIndex = -1;

  visit(tree2, 'heading', (node: any, index: number | undefined) => {
    const title = node.children
      .filter((n: any) => 'value' in n)
      .map((n: any) => n.value)
      .join('').trim();
    
    if (title === destColTitle) {
      destHeadingNode = node;
      destHeadingIndex = index!;
    }
  });

  // Fallback if destination heading is somehow missing
  if (!destHeadingNode) {
    return markdownWithoutTask + '\n\n' + taskStr + '\n';
  }

  // 5. Find the exact insertion byte offset
  const parentChildren = (tree2 as any).children;
  let insertOffset = destHeadingNode.position.end.offset;
  let foundList = false;
  let isAppending = false;

  for (let i = destHeadingIndex + 1; i < parentChildren.length; i++) {
    const sibling = parentChildren[i];
    if (sibling.type === 'heading') break; // Next section reached
    
    if (sibling.type === 'list') {
      foundList = true;
      const listItems = sibling.children;
      if (newIndex < listItems.length) {
        insertOffset = listItems[newIndex].position.start.offset;
      } else {
        insertOffset = sibling.position.end.offset;
        isAppending = true;
      }
      break;
    }
  }

  // 6. Stitch it back together
  let finalMarkdown = '';
  if (foundList) {
    if (isAppending) {
      finalMarkdown = markdownWithoutTask.substring(0, insertOffset) + '\n' + taskStr + markdownWithoutTask.substring(insertOffset);
    } else {
      finalMarkdown = markdownWithoutTask.substring(0, insertOffset) + taskStr + '\n' + markdownWithoutTask.substring(insertOffset);
    }
  } else {
    // No list exists yet under this heading
    finalMarkdown = markdownWithoutTask.substring(0, insertOffset) + '\n\n' + taskStr + '\n' + markdownWithoutTask.substring(insertOffset);
  }

  return finalMarkdown;
}