# Phase 04: Rich Media and Advanced Features

This phase adds polish and implements the advanced formatting requirements for Amplenote tasks, including limits, dates, rich footnotes, and images.

## Tasks

- [x] Implement Column Limits:
  - Added a UI configuration to set a maximum task limit per column.
  - Updated `onDragEnd` to prevent dropping a card into a column that has reached its limit.
  - Highlighted columns that are at or near capacity with visual warnings.

- [x] Implement Rich Footnotes and Links:
  - Updated `Card.tsx` parsing to detect Amplenote Rich Footnotes and standard markdown links (`[text](url)`).
  - Render URLs as clickable `<a>` tags that open externally.
  - Render note links such that clicking them triggers the Amplenote peek viewer API (e.g., `app.navigateToNote`).

- [x] Implement Image Embedding:
  - Updated the card rendering logic to scan the task's markdown for the first image syntax (`![alt](url)`).
  - Extract this image URL and render it as an embedded `<img>` at the bottom of the card UI.

- [x] Implement Labels and Dates:
  - Parse markdown tags (e.g., `#label`) and render them as colored pills on the card matching the label tag.
  - Detect date strings or standard task dates (e.g., `@today`) and render them with a calendar icon on the card layout.
