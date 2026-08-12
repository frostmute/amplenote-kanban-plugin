// @ts-nocheck
/**
 * Mutation — every board action returns new markdown.
 * Each function takes (markdown, ...args) and returns a new markdown string.
 * They operate by re-parsing into a line model, mutating, then serializing,
 * which keeps non-board content (paragraphs, footnote defs, frontmatter) intact
 * wherever possible.
 */
import { HEADING_RE, META_COMMENT_RE, START_TOKEN_RE_G, TASK_RE } from "./constants";
import {
  composeTaskLine,
  findColumn,
  serialize,
  setLineChecked,
  sourceColumn,
  structure,
  targetColumn,
  taskCheckbox,
  taskMetaComment,
  taskStartToken,
  taskText,
} from "./helpers";

/** Move a card (matched by its task text) from one column to another. */
export function moveCard(markdown, { cardText, fromColumn, toColumn, markComplete = false }) {
  const blocks = structure(markdown);
  const from = sourceColumn(blocks, fromColumn);
  const to = targetColumn(blocks, toColumn);
  if (!from || !to) return markdown;

  const idx = from.cards.findIndex((c) => taskText(c.line) === cardText);
  if (idx === -1) return markdown;

  const [card] = from.cards.splice(idx, 1);
  if (markComplete) card.line = setLineChecked(card.line, true);
  to.cards.push(card);
  return serialize(blocks);
}

/** Reorder a card within / across columns to an explicit index. */
export function moveCardToIndex(markdown, { cardText, fromColumn, toColumn, toIndex, markComplete = false }) {
  const blocks = structure(markdown);
  const from = sourceColumn(blocks, fromColumn);
  const to = targetColumn(blocks, toColumn);
  if (!from || !to) return markdown;
  const idx = from.cards.findIndex((c) => taskText(c.line) === cardText);
  if (idx === -1) return markdown;
  const [card] = from.cards.splice(idx, 1);
  if (markComplete) card.line = setLineChecked(card.line, true);
  if (from === to && toIndex > idx) toIndex--;
  const clamped = Math.max(0, Math.min(toIndex, to.cards.length));
  to.cards.splice(clamped, 0, card);
  return serialize(blocks);
}

/** Add a new card (task) to the bottom of a column. */
export function addCard(markdown, { columnTitle, text, startDate = null, linkNote = null }) {
  const blocks = structure(markdown);
  const col = targetColumn(blocks, columnTitle);
  if (!col) return markdown;
  let content = text.trim();
  if (linkNote && linkNote.uuid) content += ` [${linkNote.name || "note"}](https://www.amplenote.com/notes/${linkNote.uuid})`;
  if (startDate) content += ` {start:${startDate}}`;
  const line = `- [ ] ${content}`;
  col.cards.push({ type: "task", line, bodyLines: [], blanks: 0 });
  return serialize(blocks);
}

/**
 * Replace a card's text + multiline body by matching its old text.
 *
 * The board only ever shows the human-readable task text, so the hidden
 * Amplenote metadata comment, the `{start:…}` token and the completion state
 * are carried over from the original line unless the caller supplied them.
 */
export function editCard(markdown, { columnTitle, oldText, newMarkdown }) {
  const blocks = structure(markdown);
  const col = sourceColumn(blocks, columnTitle);
  if (!col) return markdown;
  const card = col.cards.find((c) => taskText(c.line) === oldText);
  if (!card) return markdown;

  const preserved = {
    fallbackBox: taskCheckbox(card.line),
    meta: taskMetaComment(card.line),
    start: taskStartToken(card.line),
  };

  const newLines = newMarkdown.split("\n");
  const firstTaskIdx = newLines.findIndex((l) => TASK_RE.test(l));
  const headIdx = firstTaskIdx === -1 ? 0 : firstTaskIdx;
  card.line = composeTaskLine(newLines[headIdx] || "", preserved);
  card.bodyLines = newLines.slice(headIdx + 1);
  return serialize(blocks);
}

/** Toggle / set a card's completed state. */
export function setCardComplete(markdown, { columnTitle, cardText, complete }) {
  const blocks = structure(markdown);
  const col = sourceColumn(blocks, columnTitle);
  if (!col) return markdown;
  const card = col.cards.find((c) => taskText(c.line) === cardText);
  if (!card) return markdown;
  card.line = setLineChecked(card.line, complete);
  return serialize(blocks);
}

/** Delete a single card. */
export function deleteCard(markdown, { columnTitle, cardText }) {
  const blocks = structure(markdown);
  const col = sourceColumn(blocks, columnTitle);
  if (!col) return markdown;
  const idx = col.cards.findIndex((c) => taskText(c.line) === cardText);
  if (idx === -1) return markdown;
  col.cards.splice(idx, 1);
  return serialize(blocks);
}

/** Create a new (empty) column at the end of the note. */
export function addColumn(markdown, { title, level = 2 }) {
  const md = markdown.replace(/\s*$/, "");
  const heading = `${"#".repeat(level)} ${title.trim()}`;
  return `${md}\n\n${heading}\n`;
}

/** Rename a column by editing its heading text (keeps heading level). */
export function renameColumn(markdown, { oldTitle, newTitle }) {
  const blocks = structure(markdown);
  const col = findColumn(blocks, oldTitle);
  if (!col) return markdown;
  col.headingLine = col.headingLine.replace(HEADING_RE, (full, hashes) => `${hashes} ${newTitle.trim()}`);
  col.title = newTitle.trim();
  return serialize(blocks);
}

/**
 * Delete a column. Its tasks are moved to the very top of the note, under no
 * heading in particular (prepended to the preamble), per the bounty spec.
 */
export function deleteColumn(markdown, { title }) {
  const blocks = structure(markdown);
  const idx = blocks.findIndex((b) => b.type === "column" && b.title === title);
  if (idx === -1) return markdown;
  const [col] = blocks.splice(idx, 1);

  let preamble = blocks.find((b) => b.type === "preamble");
  if (!preamble) {
    preamble = { type: "preamble", title: null, level: 0, headingLine: null, cards: [], trailing: [] };
    blocks.unshift(preamble);
  }
  // Orphaned tasks go to the top of the note.
  preamble.cards = [...col.cards, ...preamble.cards];
  return serialize(blocks);
}

/** Reorder columns. `order` is an array of column titles in the desired order. */
export function reorderColumns(markdown, { order }) {
  const blocks = structure(markdown);
  const cols = blocks.filter((b) => b.type === "column");
  const others = blocks.filter((b) => b.type !== "column");
  const byTitle = new Map(cols.map((c) => [c.title, c]));
  const reordered = order.map((t) => byTitle.get(t)).filter(Boolean);
  // Append any columns not named in `order` to avoid data loss.
  for (const c of cols) if (!order.includes(c.title)) reordered.push(c);
  // Preserve preamble first, then reordered columns.
  const preamble = others.filter((b) => b.type === "preamble");
  return serialize([...preamble, ...reordered]);
}

/** Attach a start date (YYYY-MM-DD) to a card as an Amplenote start marker. */
export function setCardStartDate(markdown, { columnTitle, cardText, date }) {
  const blocks = structure(markdown);
  const col = sourceColumn(blocks, columnTitle);
  if (!col) return markdown;
  const card = col.cards.find((c) => taskText(c.line) === cardText);
  if (!card) return markdown;
  // Remove any existing trailing start-date token, then append the new one.
  const meta = taskMetaComment(card.line);
  let line = card.line.replace(META_COMMENT_RE, "").replace(START_TOKEN_RE_G, "").replace(/\s*$/, "");
  if (date) line += ` {start:${date}}`;
  card.line = `${line}${meta}`;
  return serialize(blocks);
}

/** Append a note link to a card's task line. */
export function tagCardWithNote(markdown, { columnTitle, cardText, noteName, noteUUID }) {
  const blocks = structure(markdown);
  const col = sourceColumn(blocks, columnTitle);
  if (!col) return markdown;
  const card = col.cards.find((c) => taskText(c.line) === cardText);
  if (!card) return markdown;
  const meta = taskMetaComment(card.line);
  const line = card.line.replace(META_COMMENT_RE, "").replace(/\s*$/, "");
  card.line = `${line} [${noteName}](https://www.amplenote.com/notes/${noteUUID})${meta}`;
  return serialize(blocks);
}
