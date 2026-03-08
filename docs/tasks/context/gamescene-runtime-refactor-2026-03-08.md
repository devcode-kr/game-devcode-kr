# GameScene Runtime Refactor Handoff 2026-03-08

## Branch Context
- Base working branch before this split: `init/first-feature`
- This handoff documents the GameScene decomposition work completed on 2026-03-08.

## Goal
- Reduce `GameScene` toward scene lifecycle, orchestration, and top-level wiring.
- Move feature-specific behavior into focused local runtime objects with consistent responsibilities.
- Keep rendering-specific code out of gameplay flow where possible.

## What Changed

### 1. World state moved out of `GameScene`
- Added [game/world/GameWorldRuntime.ts](/home/eitetu/git/game-devcode-kr/game/world/GameWorldRuntime.ts)
- Responsibility:
  - monster collection ownership
  - deployable collection ownership
  - summon collection ownership
  - projectile collection ownership
  - actor reset/destroy
  - world collection application for action execution

### 2. Projectile lifecycle handling moved out of `GameScene`
- Added [game/interactions/ProjectileLifecycleRuntime.ts](/home/eitetu/git/game-devcode-kr/game/interactions/ProjectileLifecycleRuntime.ts)
- Responsibility:
  - apply projectile hit/expire events
  - direct damage
  - debuff application
  - area damage
  - spawned follow-up projectiles

### 3. Inventory and equipment interaction moved out of `GameScene`
- Added [game/items/SceneInventoryRuntime.ts](/home/eitetu/git/game-devcode-kr/game/items/SceneInventoryRuntime.ts)
- Responsibility:
  - inventory panel pointer flow
  - equipment panel pointer flow
  - equip / unequip / drag-drop
  - debug item injection

### 4. Player state and effect-runtime sync moved out of `GameScene`
- Added [game/characters/PlayerStateRuntime.ts](/home/eitetu/git/game-devcode-kr/game/characters/PlayerStateRuntime.ts)
- Responsibility:
  - player stat source refresh
  - effect runtime worker lifecycle
  - effect runtime sync
  - inventory item use application

### 5. Interaction flow moved out of `GameScene`
- Added [game/interactions/SceneInteractionRuntime.ts](/home/eitetu/git/game-devcode-kr/game/interactions/SceneInteractionRuntime.ts)
- Responsibility:
  - chest interaction flow
  - NPC dialogue flow
  - floor advance interaction
  - nearby interaction status text

### 6. Survival flow moved out of `GameScene`
- Added [game/interactions/PlayerSurvivalRuntime.ts](/home/eitetu/git/game-devcode-kr/game/interactions/PlayerSurvivalRuntime.ts)
- Responsibility:
  - trap processing
  - respawn processing
  - debug damage processing

### 7. Floor generation moved out of `GameScene`
- Added [game/world/SceneFloorRuntime.ts](/home/eitetu/git/game-devcode-kr/game/world/SceneFloorRuntime.ts)
- Responsibility:
  - floor generation
  - interactable/trap replacement
  - floor progression bookkeeping

### 8. Progress persistence moved out of `GameScene`
- Added [game/progress/SceneProgressRuntime.ts](/home/eitetu/git/game-devcode-kr/game/progress/SceneProgressRuntime.ts)
- Responsibility:
  - progress snapshot creation
  - progress load
  - progress restore application

### 9. Rendering orchestration moved out of `GameScene`
- Added [game/world/GameSceneWorldRenderer.ts](/home/eitetu/git/game-devcode-kr/game/world/GameSceneWorldRenderer.ts)
- Added [game/ui/GameSceneHudRuntime.ts](/home/eitetu/git/game-devcode-kr/game/ui/GameSceneHudRuntime.ts)
- Added [game/ui/GameSceneRenderRuntime.ts](/home/eitetu/git/game-devcode-kr/game/ui/GameSceneRenderRuntime.ts)
- Responsibility:
  - world tile rendering
  - trap/interactable rendering
  - path/hover marker rendering
  - HUD text assembly invocation
  - effect HUD / panel / caret render orchestration

### 10. Navigation and movement flow moved out of `GameScene`
- Added [game/navigation/SceneNavigationRuntime.ts](/home/eitetu/git/game-devcode-kr/game/navigation/SceneNavigationRuntime.ts)
- Responsibility:
  - input vector resolution
  - click-to-move pathing
  - blocked repath
  - monster occupancy checks
  - visibility refresh
  - path status text
  - tile texture selection for scene rendering

### 11. Combat launch/update flow moved out of `GameScene`
- Added [game/interactions/SceneCombatRuntime.ts](/home/eitetu/git/game-devcode-kr/game/interactions/SceneCombatRuntime.ts)
- Responsibility:
  - equipped attack execution
  - debug totem deployment
  - projectile update and lifecycle application
  - projectile launch bridge

### 12. Debug controls were consolidated
- Added [game/debug/SceneDebugRuntime.ts](/home/eitetu/git/game-devcode-kr/game/debug/SceneDebugRuntime.ts)
- Responsibility:
  - debug damage hotkey
  - debug item hotkey
  - debug deploy hotkey

## Current Result
- `GameScene` now mainly does:
  - scene bootstrapping
  - runtime construction
  - key binding
  - pointer event entrypoints
  - per-frame orchestration across runtimes
- `GameScene` line count after this refactor is approximately `722`.

## Important Files
- [game/scenes/GameScene.ts](/home/eitetu/git/game-devcode-kr/game/scenes/GameScene.ts)
- [game/navigation/SceneNavigationRuntime.ts](/home/eitetu/git/game-devcode-kr/game/navigation/SceneNavigationRuntime.ts)
- [game/interactions/SceneCombatRuntime.ts](/home/eitetu/git/game-devcode-kr/game/interactions/SceneCombatRuntime.ts)
- [game/ui/GameSceneRenderRuntime.ts](/home/eitetu/git/game-devcode-kr/game/ui/GameSceneRenderRuntime.ts)
- [game/world/GameWorldRuntime.ts](/home/eitetu/git/game-devcode-kr/game/world/GameWorldRuntime.ts)
- [game/characters/PlayerStateRuntime.ts](/home/eitetu/git/game-devcode-kr/game/characters/PlayerStateRuntime.ts)

## Verification
- `npm run lint`
- `npx tsc --noEmit`

## Recommended Next Feature
- Implement monster combat AI on top of the new split.
- Most natural follow-up area:
  - decision phase in monster update
  - chase / disengage range rules
  - monster attack cooldown
  - projectile or melee attack behavior
