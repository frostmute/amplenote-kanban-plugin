// @ts-nocheck
/**
 * kanban-core.js
 *
 * Pure, dependency-free markdown <-> board model logic for the
 * Markdown-Backed Kanban Board plugin.
 *
 * This module is the single source of truth for how a note's markdown maps to
 * a kanban board and back. It is deliberately free of any Amplenote `app`
 * dependency so it can be:
 *   - bundled into the embed (for rendering the board), and
 *   - bundled into the plugin action handler (for mutating note markdown), and
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
 */

/** Bumped whenever the markdown<->model contract changes. */
const SCHEMA_VERSION = 1;

const TASK_RE = /^(\s*)- \[([ xX])\]\s?(.*)$/;
const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const META_COMMENT_RE = /\s*<!--\s*(\{.*\})\s*-->\s*$/;

const NO_HEADING_TITLE = "(No heading)";

/* ------------------------------------------------------------------ *
 * Parsing
 * ------------------------------------------------------------------ */

/**
 * Parse note markdown into a board model.
 * @param {string} markdown
 * @returns {{columns: Column[]}}
 *
 * Column = { id, title, level, tasks: Card[], hasHeading }
 * Card   = { id, rawText, text, checked, meta, body, line }
 */
function parseBoard(markdown) {
  const lines = (markdown || "").split("\n");
  const columns = [];

  // Implicit backlog for tasks before any heading.
  let current = makeColumn(NO_HEADING_TITLE, 0, false, 0);
  let lastCard = null;

  const flush = () => {
    // Only keep the implicit backlog column if it actually holds tasks.
    if (current.hasHeading || current.tasks.length > 0) {
      columns.push(current);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      flush();
      const level = headingMatch[1].length;
      current = makeColumn(headingMatch[2].trim(), level, true, i);
      lastCard = null;
      continue;
    }

    const taskMatch = line.match(TASK_RE);
    if (taskMatch && taskMatch[1].length === 0) {
      // Top-level task => a card.
      const card = parseTaskLine(line, i);
      current.tasks.push(card);
      lastCard = card;
      continue;
    }

    // Anything else is body content. Attach to the last card on this column
    // if we are still "inside" it (no blank-line gap that ends the card).
    if (lastCard) {
      if (line.trim() === "" && lastCard._sawBlank) {
        // A second blank line ends the card body.
        lastCard = null;
        continue;
      }
      if (line.trim() === "") {
        lastCard._sawBlank = true;
        lastCard.bodyLines.push(line);
        continue;
      }
      lastCard._sawBlank = false;
      lastCard.bodyLines.push(line);
    }
  }
  flush();

  // Finalize bodies and extract images.
  for (const col of columns) {
    for (const card of col.tasks) {
      card.body = trimTrailingBlank(card.bodyLines).join("\n");
      card.firstImage = firstImage(card);
      delete card.bodyLines;
      delete card._sawBlank;
    }
  }

  return { schemaVersion: SCHEMA_VERSION, columns };
}

function makeColumn(title, level, hasHeading, line) {
  return { id: `col-${line}-${slug(title)}`, title, level: level || 2, hasHeading, tasks: [], line };
}

function parseTaskLine(line, lineNo) {
  const m = line.match(TASK_RE);
  const checked = m[2].toLowerCase() === "x";
  let rest = m[3];

  let meta = null;
  const metaMatch = rest.match(META_COMMENT_RE);
  if (metaMatch) {
    try {
      meta = JSON.parse(metaMatch[1]);
    } catch (_e) {
      meta = null;
    }
    rest = rest.replace(META_COMMENT_RE, "");
  }

  let startDate = null;
  const startMatch = rest.match(/\s*\{start:([^}]*)\}/);
  if (startMatch) {
    startDate = startMatch[1];
    rest = rest.replace(/\s*\{start:[^}]*\}/g, "");
  }

  const labelsMatch = rest.match(/#([\w-]+)/g);
  const labels = labelsMatch ? labelsMatch.map(l => l.substring(1)) : [];

  return {
    id: meta && meta.uuid ? meta.uuid : `card-${lineNo}`,
    rawText: rest,
    text: rest.trim(),
    checked,
    meta,
    startDate,
    labels,
    body: "",
    bodyLines: [],
    line: lineNo,
  };
}

/* ------------------------------------------------------------------ *
 * Card content extraction (for rich rendering in the embed)
 * ------------------------------------------------------------------ */

/** First markdown image `![alt](url)` found in text+body, or null. */
function firstImage(card) {
  const haystack = `${card.text}\n${card.body || ""}`;
  const m = haystack.match(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
  return m ? { alt: m[1], url: m[2] } : null;
}

/** Bare and markdown web URLs found in a card's text+body. */
function extractUrls(card) {
  const haystack = `${card.text}\n${card.body || ""}`;
  const urls = new Set();
  const mdLink = /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;
  let m;
  while ((m = mdLink.exec(haystack))) urls.add(m[1]);
  const bare = /(?<!\()(https?:\/\/[^\s)<>]+)/g;
  while ((m = bare.exec(haystack))) urls.add(m[1]);
  return [...urls];
}

/**
 * Parse Amplenote-style Rich Footnotes from the full note markdown.
 * Returns a map of footnote-id -> { label, target, body }.
 * Inline references look like `text[^id]`; definitions look like
 * `[^id]: [label](url)` optionally followed by indented rich body lines.
 */
function parseFootnotes(markdown) {
  const lines = (markdown || "").split("\n");
  const defs = {};
  const defRe = /^\[\^([^\]]+)\]:\s*(.*)$/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(defRe);
    if (!m) continue;
    const id = m[1];
    const firstLine = m[2];
    const bodyLines = [];
    let j = i + 1;
    while (j < lines.length && (lines[j].startsWith("    ") || lines[j].startsWith("\t"))) {
      bodyLines.push(lines[j].replace(/^(\t| {4})/, ""));
      j++;
    }
    const linkMatch = firstLine.match(/^\[([^\]]*)\]\(([^)\s]+)\)\s*(.*)$/);
    defs[id] = {
      id,
      label: linkMatch ? linkMatch[1] : firstLine,
      target: linkMatch ? linkMatch[2] : null,
      body: [linkMatch ? linkMatch[3] : "", ...bodyLines].filter(Boolean).join("\n").trim(),
    };
  }
  return defs;
}

/** Footnote ids referenced inside a card. */
function cardFootnoteIds(card) {
  const haystack = `${card.text}\n${card.body || ""}`;
  const ids = [];
  const re = /\[\^([^\]]+)\]/g;
  let m;
  while ((m = re.exec(haystack))) ids.push(m[1]);
  return ids;
}

/**
 * Classify a footnote so the embed knows how to render it.
 *   - "link"  : a single web url, click to open.
 *   - "embed" : rich content (images and/or multi-part text/urls) -> sidebar.
 */
function classifyFootnote(fn) {
  if (!fn) return "link";
  const hasImage = /!\[[^\]]*\]\([^)]+\)/.test(fn.body || "");
  const urlCount = (fn.body || "").match(/https?:\/\//g)?.length || 0;
  const hasBody = (fn.body || "").trim().length > 0;
  if (hasImage || hasBody || urlCount > 1) return "embed";
  return "link";
}

/* ------------------------------------------------------------------ *
 * Mutation — every board action returns new markdown.
 * Each function takes (markdown, ...args) and returns a new markdown string.
 * They operate by re-parsing into a line model, mutating, then serializing,
 * which keeps non-board content (paragraphs, footnote defs, frontmatter) intact
 * wherever possible.
 * ------------------------------------------------------------------ */

/**
 * Internal: build a structured, serializable model of the note that preserves
 * every line, tagged by ownership (heading / task / body / other).
 */
function structure(markdown) {
  const lines = (markdown || "").split("\n");
  const blocks = [];
  // Leading block holds content before the first heading or task.
  let col = { type: "preamble", title: null, level: 0, headingLine: null, cards: [], trailing: [] };
  let card = null;

  const pushCol = () => blocks.push(col);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hm = line.match(HEADING_RE);
    if (hm) {
      pushCol();
      col = { type: "column", title: hm[2].trim(), level: hm[1].length, headingLine: line, cards: [], trailing: [] };
      card = null;
      continue;
    }
    const tm = line.match(TASK_RE);
    if (tm && tm[1].length === 0) {
      card = { type: "task", line, bodyLines: [], blanks: 0 };
      col.cards.push(card);
      continue;
    }
    if (card) {
      if (line.trim() === "") {
        card.blanks++;
        if (card.blanks >= 2) {
          card = null;
          col.trailing.push(line);
        } else {
          card.bodyLines.push(line);
        }
      } else {
        card.blanks = 0;
        card.bodyLines.push(line);
      }
    } else {
      col.trailing.push(line);
    }
  }
  pushCol();
  return blocks;
}

function serialize(blocks) {
  const out = [];
  for (const block of blocks) {
    if (block.type === "column") out.push(block.headingLine);
    for (const card of block.cards) {
      out.push(card.line);
      for (const b of card.bodyLines) out.push(b);
    }
    for (const t of block.trailing) out.push(t);
  }
  return out.join("\n");
}

function findColumn(blocks, columnTitle) {
  return blocks.find((b) => b.type === "column" && b.title === columnTitle);
}

/**
 * Resolve a column for a *source* operation. A null/blank title means the
 * implicit "(No heading)" backlog, which is the preamble block.
 */
function sourceColumn(blocks, columnTitle) {
  if (columnTitle == null || columnTitle === "") return blocks.find((b) => b.type === "preamble");
  return findColumn(blocks, columnTitle);
}

/**
 * Resolve a column for a *target* operation. A null/blank title means the
 * backlog; the preamble block is created if the note doesn't have one yet.
 */
function targetColumn(blocks, columnTitle) {
  if (columnTitle == null || columnTitle === "") {
    let pre = blocks.find((b) => b.type === "preamble");
    if (!pre) {
      pre = { type: "preamble", title: null, level: 0, headingLine: null, cards: [], trailing: [] };
      blocks.unshift(pre);
    }
    return pre;
  }
  return findColumn(blocks, columnTitle);
}

/** Set the checkbox state of a task line, preserving its metadata comment. */
function setLineChecked(line, checked) {
  return line.replace(TASK_RE, (full, indent, _box, rest) => `${indent}- [${checked ? "x" : " "}] ${rest}`.replace(/\]\s+$/, "] "));
}

/** Move a card (matched by its task text) from one column to another. */
function moveCard(markdown, { cardText, fromColumn, toColumn, markComplete = false }) {
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
function moveCardToIndex(markdown, { cardText, fromColumn, toColumn, toIndex, markComplete = false }) {
  const blocks = structure(markdown);
  const from = sourceColumn(blocks, fromColumn);
  const to = targetColumn(blocks, toColumn);
  if (!from || !to) return markdown;
  const idx = from.cards.findIndex((c) => taskText(c.line) === cardText);
  if (idx === -1) return markdown;
  const [card] = from.cards.splice(idx, 1);
  if (markComplete) card.line = setLineChecked(card.line, true);
  else if (from === to && toIndex > idx) toIndex--;
  const clamped = Math.max(0, Math.min(toIndex, to.cards.length));
  to.cards.splice(clamped, 0, card);
  return serialize(blocks);
}

/** Add a new card (task) to the bottom of a column. */
function addCard(markdown, { columnTitle, text, startDate = null, linkNote = null }) {
  const blocks = structure(markdown);
  const col = findColumn(blocks, columnTitle);
  if (!col) return markdown;
  let content = text.trim();
  if (linkNote && linkNote.uuid) content += ` [${linkNote.name || "note"}](https://www.amplenote.com/notes/${linkNote.uuid})`;
  const line = `- [ ] ${content}` + (startDate ? ` ` : "");
  col.cards.push({ type: "task", line, bodyLines: [], blanks: 0 });
  return serialize(blocks);
}

/** Replace a card's full markdown (text + multiline body) by matching old text. */
function editCard(markdown, { columnTitle, oldText, newMarkdown }) {
  const blocks = structure(markdown);
  const col = sourceColumn(blocks, columnTitle);
  if (!col) return markdown;
  const card = col.cards.find((c) => taskText(c.line) === oldText);
  if (!card) return markdown;

  const newLines = newMarkdown.split("\n");
  const firstTaskIdx = newLines.findIndex((l) => TASK_RE.test(l));
  if (firstTaskIdx === -1) {
    // User stripped the checkbox; re-wrap first line as a task.
    card.line = `- [${card.line.match(TASK_RE)[2]}] ${newLines[0].trim()}`;
    card.bodyLines = newLines.slice(1);
  } else {
    card.line = newLines[firstTaskIdx];
    card.bodyLines = newLines.slice(firstTaskIdx + 1);
  }
  return serialize(blocks);
}

/** Toggle / set a card's completed state. */
function setCardComplete(markdown, { columnTitle, cardText, complete }) {
  const blocks = structure(markdown);
  const col = sourceColumn(blocks, columnTitle);
  if (!col) return markdown;
  const card = col.cards.find((c) => taskText(c.line) === cardText);
  if (!card) return markdown;
  card.line = setLineChecked(card.line, complete);
  return serialize(blocks);
}

/** Delete a single card. */
function deleteCard(markdown, { columnTitle, cardText }) {
  const blocks = structure(markdown);
  const col = sourceColumn(blocks, columnTitle);
  if (!col) return markdown;
  const idx = col.cards.findIndex((c) => taskText(c.line) === cardText);
  if (idx === -1) return markdown;
  col.cards.splice(idx, 1);
  return serialize(blocks);
}

/** Create a new (empty) column at the end of the note. */
function addColumn(markdown, { title, level = 2 }) {
  const md = markdown.replace(/\s*$/, "");
  const heading = `${"#".repeat(level)} ${title.trim()}`;
  return `${md}\n\n${heading}\n`;
}

/** Rename a column by editing its heading text (keeps heading level). */
function renameColumn(markdown, { oldTitle, newTitle }) {
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
function deleteColumn(markdown, { title }) {
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
function reorderColumns(markdown, { order }) {
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
function setCardStartDate(markdown, { columnTitle, cardText, date }) {
  const blocks = structure(markdown);
  const col = sourceColumn(blocks, columnTitle);
  if (!col) return markdown;
  const card = col.cards.find((c) => taskText(c.line) === cardText);
  if (!card) return markdown;
  // Remove any existing trailing start-date token, then append the new one.
  card.line = card.line.replace(/\s*\{start:[^}]*\}/g, "").replace(/\s*$/, "");
  if (date) card.line += ` {start:${date}}`;
  return serialize(blocks);
}

/** Append a note link to a card's task line. */
function tagCardWithNote(markdown, { columnTitle, cardText, noteName, noteUUID }) {
  const blocks = structure(markdown);
  const col = sourceColumn(blocks, columnTitle);
  if (!col) return markdown;
  const card = col.cards.find((c) => taskText(c.line) === cardText);
  if (!card) return markdown;
  card.line = card.line.replace(/\s*$/, "") + ` [${noteName}](https://www.amplenote.com/notes/${noteUUID})`;
  return serialize(blocks);
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Extract the human task text (no checkbox, no trailing meta comment). */
function taskText(line) {
  const m = line.match(TASK_RE);
  const raw = m ? m[3] : line;
  return raw
    .replace(META_COMMENT_RE, "")
    .replace(/\s*\{start:[^}]*\}/g, "")
    .trim();
}

function slug(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
}

function trimTrailingBlank(arr) {
  const copy = [...arr];
  while (copy.length && copy[copy.length - 1].trim() === "") copy.pop();
  return copy;
}

export const KanbanCore = {
  SCHEMA_VERSION,
  TASK_RE,
  HEADING_RE,
  META_COMMENT_RE,
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
