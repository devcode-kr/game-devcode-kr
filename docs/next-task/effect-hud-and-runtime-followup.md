# Next Task

## Recommended Goal
- Finish moving runtime execution out of `GameScene`, then polish equipment interaction UX.

## Why This Next
- The combat spec model is now broad enough for the current prototype:
  - event-driven projectiles
  - deploy / summon inheritance
  - action bundle execution runtime
  - manual equipment / socket panel
- The main limitation is now execution placement and interaction polish.
- `GameScene` still owns projectile lifecycle event application and some UI glue.

## Scope

### 1. Projectile lifecycle execution split
- Move projectile lifecycle event application out of `GameScene`.
- Target helpers:
  - direct hit execution
  - debuff application
  - area damage resolution
  - spawn projectile execution
- Keep `GameScene` at orchestration level only.

### 2. Equipment panel polish
- Add drag-preview feedback for equipped items.
- Highlight valid inventory drop cells during unequip drags.
- Add richer slot tooltip details:
  - current stat bonuses
  - granted skill action
  - socket compatibility hints

### 3. Lifecycle expansion
- Extend current event kinds with:
  - spawn deployable
  - spawn summon
  - area secondary debuff support
- Then add more representative sample actions:
  - fireball
  - split arrow
  - trap shot
  - summoning shard

### 4. Remove auto-loadout fallback
- Once equipment UI is considered stable, remove fallback auto-loadout behavior.
- Persist explicit loadout and socket state as the only source of truth.

## Out Of Scope
- Contact-based auto combat
- Cooldown HUD rows
- Full summon AI trees
- Multiplayer or PvP targeting

## Suggested File Targets
- `game/interactions/ActionExecutionRuntime.ts`
- `game/interactions/ProjectileAreaDamageRules.ts`
- `game/interactions/ProjectileRuntime.ts`
- `game/interactions/ProjectileEventExecution.ts`
- `game/ui/EquipmentPanel.ts`
- `game/ui/InventoryPanel.ts`
- `game/scenes/GameScene.ts`

## Success Criteria
1. `GameScene` no longer directly owns projectile lifecycle event execution details.
2. Equipment unequip drags show clear feedback and valid drop targets.
3. Deploy/summon/projectile execution remains event-driven and type-safe.
4. Explicit equipment state can be maintained without relying on auto-loadout.
5. Type check and lint both pass.
