# Install Plan

- **Provider**: opencode
- **Supported**: yes
- **Date**: 2026-06-27

## Prerequisites
- `git`: git version 2.54.0
- Harness CLI (`opencode`): /Users/thewytchhaus/.opencode/bin/opencode
- Provider-specific: OpenCode config: ~/.config/opencode/opencode.json (exists)

## Strategy
Since `INSTALL_RECIPES.md` was missing from the playbook assets directory, I cannot load specific recipe steps for opencode. Document 3 will be instructed to halt because the playbook is missing a required asset file.

## Automatable Steps
1. Halt the run
   - Action: Edit 3_INSTALL.md to contain `<!-- maestro:halt: missing INSTALL_RECIPES.md asset required to form a plan -->`
   - Expects: File is edited.

## User-Required Steps

## Skip / Block
Playbook is missing required `/Users/thewytchhaus/Documents/GitHub/amplenote-kanban-plugin/.maestro/playbooks/2026-06-26-Amplenote-Kanban-Plugin/assets/INSTALL_RECIPES.md`. The plan cannot be fully constructed without it.
