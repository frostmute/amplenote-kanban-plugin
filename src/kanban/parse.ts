// @ts-nocheck
/**
 * Markdown -> board model parsing and card content extraction.
 */
import { HEADING_RE, META_COMMENT_RE, NO_HEADING_TITLE, SCHEMA_VERSION, START_TOKEN_RE, START_TOKEN_RE_G, TASK_RE } from "./constants";
import { slug, trimTrailingBlank } from "./helpers";

/**
 * Parse note markdown into a board model.
 * @param {string} markdown
 * @returns {{columns: Column[]}}
 *
 * Column = { id, title, level, tasks: Card[], hasHeading }
 * Card   = { id, rawText, text, checked, meta, body, line }
 */
export function parseBoard(markdown) {
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
    // Footnote definition lines (`[^id]: ...`) and their indented body
    // belong to the document, not to any card — skip them entirely.
    if (/^\s*\[\^[^\]]+\]:/.test(line)) {
      lastCard = null;
      continue;
    }
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

export function makeColumn(title, level, hasHeading, line) {
  return { id: `col-${line}-${slug(title)}`, title, level: level || 2, hasHeading, tasks: [], line };
}

export function parseTaskLine(line, lineNo) {
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
  const startMatch = rest.match(START_TOKEN_RE);
  if (startMatch) {
    startDate = startMatch[1];
    rest = rest.replace(START_TOKEN_RE_G, "");
  }

  const labelsMatch = rest.match(/#([\w-]+)/g);
  const labels = labelsMatch ? labelsMatch.map((l) => l.substring(1)) : [];

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
export function firstImage(card) {
  const haystack = `${card.text}\n${card.body || ""}`;
  const m = haystack.match(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
  return m ? { alt: m[1], url: m[2] } : null;
}

/** Bare and markdown web URLs found in a card's text+body. */
export function extractUrls(card) {
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
export function parseFootnotes(markdown) {
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
export function cardFootnoteIds(card) {
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
export function classifyFootnote(fn) {
  if (!fn) return "link";
  const hasImage = /!\[[^\]]*\]\([^)]+\)/.test(fn.body || "");
  const urlCount = (fn.body || "").match(/https?:\/\//g)?.length || 0;
  const hasBody = (fn.body || "").trim().length > 0;
  if (hasImage || hasBody || urlCount > 1) return "embed";
  return "link";
}
