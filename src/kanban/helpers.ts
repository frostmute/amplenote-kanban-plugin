// @ts-nocheck
/**
 * Structural helpers: the line-preserving note model every mutator works on,
 * plus small text utilities.
 */
import { FOOTNOTE_DEF_RE, HEADING_RE, META_COMMENT_RE, START_TOKEN_RE, START_TOKEN_RE_G, TASK_RE } from "./constants";

/**
 * Build a structured, serializable model of the note that preserves every
 * line, tagged by ownership (heading / task / body / other).
 */
export function structure(markdown) {
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
    // A footnote definition ends the current card, matching `parseBoard`: the
    // parser hides these lines from the card body, so they must not live in
    // `bodyLines` either or an edit would overwrite them out of the note.
    if (FOOTNOTE_DEF_RE.test(line)) {
      if (card) {
        while (card.bodyLines.length && card.bodyLines[card.bodyLines.length - 1].trim() === "") {
          col.trailing.push(card.bodyLines.pop());
        }
        card = null;
      }
      col.trailing.push(line);
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

export function serialize(blocks) {
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

export function findColumn(blocks, columnTitle) {
  return blocks.find((b) => b.type === "column" && b.title === columnTitle);
}

/**
 * Resolve a column for a *source* operation. A null/blank title means the
 * implicit "(No heading)" backlog, which is the preamble block.
 */
export function sourceColumn(blocks, columnTitle) {
  if (columnTitle == null || columnTitle === "") return blocks.find((b) => b.type === "preamble");
  return findColumn(blocks, columnTitle);
}

/**
 * Resolve a column for a *target* operation. A null/blank title means the
 * backlog; the preamble block is created if the note doesn't have one yet.
 */
export function targetColumn(blocks, columnTitle) {
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
export function setLineChecked(line, checked) {
  return line.replace(TASK_RE, (full, indent, _box, rest) => `${indent}- [${checked ? "x" : " "}] ${rest}`.replace(/\]\s+$/, "] "));
}

/** Extract the human task text (no checkbox, no trailing meta comment). */
export function taskText(line) {
  const m = line.match(TASK_RE);
  const raw = m ? m[3] : line;
  return raw
    .replace(META_COMMENT_RE, "")
    .replace(START_TOKEN_RE_G, "")
    .trim();
}

/** The checkbox character (`" "` or `"x"`) of a task line. */
export function taskCheckbox(line) {
  const m = line.match(TASK_RE);
  return m ? m[2] : " ";
}

/** The verbatim trailing `<!-- {...} -->` metadata comment of a line, or "". */
export function taskMetaComment(line) {
  const m = line.match(META_COMMENT_RE);
  return m ? m[0] : "";
}

/** The verbatim `{start:…}` token of a line, or "". */
export function taskStartToken(line) {
  const m = line.replace(META_COMMENT_RE, "").match(START_TOKEN_RE);
  return m ? m[0] : "";
}

/**
 * Rebuild a task line from user-supplied markdown, restoring the affordances
 * the board UI never shows: the hidden metadata comment and the `{start:…}`
 * token. `fallbackBox` is used when the supplied text has no checkbox at all.
 */
export function composeTaskLine(supplied, { fallbackBox = " ", meta = "", start = "" } = {}) {
  const m = supplied.match(TASK_RE);
  const box = m ? m[2] : fallbackBox;
  let rest = (m ? m[3] : supplied).trim();

  const suppliedMeta = taskMetaComment(rest);
  if (suppliedMeta) rest = rest.replace(META_COMMENT_RE, "").trim();
  const finalMeta = suppliedMeta || meta;

  const suppliedStart = taskStartToken(rest);
  if (!suppliedStart && start) rest += start;

  return `- [${box}] ${rest}${finalMeta}`;
}

export function slug(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
}

export function trimTrailingBlank(arr) {
  const copy = [...arr];
  while (copy.length && copy[copy.length - 1].trim() === "") copy.pop();
  return copy;
}
