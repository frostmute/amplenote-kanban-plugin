# Amplenote Plugin Embed Starter Project

This project provides a basic starting point for developing a
React-based application that can be rendered in an Amplenote
embed.

# Getting Started

1. Fork this repo, choosing a repo name appropriate to the plugin you will build.
2. `git clone` your forked repo, following GitHub's instructions
3. Install dependencies with `yarn install`
4. Create a build with `yarn build`

# Output

The output of the build step is a zip file containing a markdown note
that can be used as a plugin note in Amplenote. Import this zip file
as a markdown archive in Amplenote and enable it as a plugin in your
Amplenote account. The zip file contains an attachment containing
the potentially-large plugin code, to avoid creating an extremely
large note.

The following plugin actions are implemented in the plugin:

- `appOption` triggering the plugin via the quick open menu will open a sidebar embed for the plugin
- `renderEmbed` handles rendering the sidebar embed, rendering this application in the sidebar
- `onEmbedCall` called when `window.callAmplenotePlugin` is called from the embed code in this project

The `renderEmbed` action output by this plugin can remain unchanged in the final plugin, but it's likely that the
`appOption` and `onEmbedCall` actions will need to be customized to fit the needs of the final plugin.

# Development

Run `yarn dev` to serve the application locally, with automatic reloading on filesystem changes.

# Markdown-Backed Kanban Board

This repo is now a working Markdown-Backed Kanban Board plugin for
Amplenote. The shipped contract is:

- `renderEmbed` returns the embedded React UI (loaded from the
  `build.html.json` attachment).
- `onEmbedCall` accepts a small set of semantic actions and mutates
  the target note using the in-tree `KanbanCore` mutators:
  - `getBoard` / `refresh` — return the current note markdown.
  - `applyAction` — apply a single mutator (`moveCard`, `addCard`,
    `editCard`, `setCardComplete`, `deleteCard`, `addColumn`,
    `renameColumn`, `deleteColumn`, `reorderColumns`,
    `setCardStartDate`, `tagCardWithNote`) and return the new
    markdown.

The embed keeps a local board model in sync with the note, never
replaces the document via a destructive serializer, and re-parses the
returned markdown after every action.

# Tests

`npm test` runs the vitest suite against `src/kanban-core.test.ts`,
which exercises `parseBoard`, the mutators, footnotes, image/URL
extraction, and round-trips. The build pipeline inlines
`src/kanban-core.ts` into the plugin note so the same mutators run
both in the embed (for parsing) and in the plugin note (for
mutation).
