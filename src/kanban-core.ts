// @ts-nocheck
/**
 * kanban-core
 *
 * Pure, dependency-free markdown <-> board model logic for the
 * Markdown-Backed Kanban Board plugin.
 *
 * This module is the single source of truth for how a note's markdown maps to
 * a kanban board and back. It is deliberately free of any Amplenote `app`
 * dependency so it can be:
 *   - bundled into the embed (for rendering the board), and
 *   - inlined into the plugin note action handler (for mutating note markdown), and
 *   - unit-tested in plain Node.
 *
 * Markdown contract (a subset of Amplenote's GFM):
 *   - A column is a Markdown heading (`#`..`######`). The heading text is the
 *     column title.
 *   - A card is a top-level task line under that heading:
 *         - [ ] open task
 *         - [x] completed task
 *     Completed tasks may carry a trailing HTML metadata comment that
 *     Amplenote uses, e.g. `<!-- {"uuid":"...","completedAt":123} -->`. We
 *     preserve any trailing comment verbatim.
 *   - Continuation lines (indented, or non-task lines) immediately following a
 *     task, up until the next task / heading / blank-blank break, form that
 *     card's multiline body.
 *   - Tasks that appear before the first heading live in an implicit
 *     "(No heading)" backlog column that is never written as a heading.
 *
 * The implementation is split across `src/kanban/` so every file stays small;
 * `build.mjs` concatenates those fragments (in dependency order) plus the
 * `KanbanCore` facade below into the plugin note.
 */
import { HEADING_RE, META_COMMENT_RE, NO_HEADING_TITLE, SCHEMA_VERSION, START_TOKEN_RE, TASK_RE } from "./kanban/constants";
import { composeTaskLine, findColumn, serialize, setLineChecked, slug, sourceColumn, structure, targetColumn, taskCheckbox, taskMetaComment, taskStartToken, taskText, trimTrailingBlank } from "./kanban/helpers";
import { cardFootnoteIds, classifyFootnote, extractUrls, firstImage, makeColumn, parseBoard, parseFootnotes, parseTaskLine } from "./kanban/parse";
import { addCard, addColumn, deleteCard, deleteColumn, editCard, moveCard, moveCardToIndex, renameColumn, reorderColumns, setCardComplete, setCardStartDate, tagCardWithNote } from "./kanban/mutate";

export const KanbanCore = {
  SCHEMA_VERSION,
  TASK_RE,
  HEADING_RE,
  META_COMMENT_RE,
  START_TOKEN_RE,
  NO_HEADING_TITLE,
  parseBoard,
  makeColumn,
  parseTaskLine,
  firstImage,
  extractUrls,
  parseFootnotes,
  cardFootnoteIds,
  classifyFootnote,
  structure,
  serialize,
  findColumn,
  sourceColumn,
  targetColumn,
  setLineChecked,
  composeTaskLine,
  taskCheckbox,
  taskMetaComment,
  taskStartToken,
  moveCard,
  moveCardToIndex,
  addCard,
  editCard,
  setCardComplete,
  deleteCard,
  addColumn,
  renameColumn,
  deleteColumn,
  reorderColumns,
  setCardStartDate,
  tagCardWithNote,
  taskText,
  slug,
  trimTrailingBlank
};
