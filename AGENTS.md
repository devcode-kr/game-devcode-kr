# Repository Instructions

## File Organization
- Keep `GameScene` focused on scene lifecycle, wiring, and high-level orchestration.
- Split feature logic into domain folders when a feature grows beyond simple scene-local glue.
- Prefer these directories:
  - `game/ui/`: screen panels and HUD-related rendering helpers
  - `game/world/`: interactable/trap types and world object placement
  - `game/interactions/`: gameplay interaction flow such as chest, dialogue, potion, trap, respawn
  - `game/progress/`: persistence, journey log, achievement rules
  - `game/items/`: item definitions, inventory model, inventory helpers

## Naming
- Use file names that state responsibility directly.
- Prefer suffixes by role:
  - `*Panel.ts` for UI panels
  - `*Builder.ts` for scene/world construction
  - `*Rules.ts` for pure game rule logic
  - `*Persistence.ts` for save/load translation
  - `*Utils.ts` only for narrow shared helpers, not mixed feature logic

## Scene Boundary
- `GameScene` should not own detailed rendering code for panels or detailed rule tables for rewards/achievements.
- When adding a new feature, first decide whether it belongs to `ui`, `world`, `interactions`, `progress`, or `items`.
- If a method in `GameScene` starts handling one concrete feature end-to-end, move it into a feature file and keep only state passing in the scene.
