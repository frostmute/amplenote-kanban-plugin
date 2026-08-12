// @ts-nocheck
/**
 * Shared constants for the markdown <-> board contract.
 *
 * This file is the first fragment inlined into the plugin note by `build.mjs`,
 * so it must only contain declarations (no imports).
 */

/** Bumped whenever the markdown<->model contract changes. */
export const SCHEMA_VERSION = 1;

export const TASK_RE = /^(\s*)- \[([ xX])\]\s?(.*)$/;
export const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
export const META_COMMENT_RE = /\s*<!--\s*(\{.*\})\s*-->\s*$/;
export const START_TOKEN_RE = /\s*\{start:([^}]*)\}/;
export const START_TOKEN_RE_G = /\s*\{start:[^}]*\}/g;

/** `[^id]: …` definition lines belong to the note, never to a card. */
export const FOOTNOTE_DEF_RE = /^\s*\[\^[^\]]+\]:/;

export const NO_HEADING_TITLE = "(No heading)";
