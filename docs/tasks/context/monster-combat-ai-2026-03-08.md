# Monster Combat AI Handoff 2026-03-08

## Branch / PR
- Branch: `feat/gamescene-runtime-monster-ai`
- PR: `#26`

## Goal
- Replace passive monster wandering with basic combat behavior that uses the new runtime split.

## What Changed

### 1. Monster combat behavior moved into scene combat runtime
- Updated [game/interactions/SceneCombatRuntime.ts](/home/eitetu/git/game-devcode-kr/game/interactions/SceneCombatRuntime.ts)
- Added monster combat update flow to the existing scene combat runtime.

### 2. Current monster behavior
- Monsters idle-wander when the player is outside aggro range.
- Monsters aggro when the player is within `6.5` tiles.
- Monsters chase using path search toward the player when outside attack range.
- Monsters stop and attack when the player is within `4.75` tiles.
- Monsters use a projectile attack with:
  - `debugBolt` presentation
  - `8` direct damage
  - `1400ms` attack interval

### 3. Chase policy
- Monsters repath toward the player on a short cadence (`300ms`) while aggroed.
- Monsters use a small path budget (`48`) to avoid expensive chase searches every frame.
- If pathfinding fails, they fall back to direct destination chasing.

### 4. Idle policy
- Monsters keep previous idle wandering behavior outside aggro range.
- Idle decision cadence remains slower than chase cadence.

## Scene Integration
- [game/scenes/GameScene.ts](/home/eitetu/git/game-devcode-kr/game/scenes/GameScene.ts) now delegates monster update to scene combat runtime rather than directly updating monster wandering logic.

## Current Limitations
- Monsters do not yet have melee-only attack variants.
- Monsters do not yet use distinct attack specs by monster type.
- No line-of-sight gate is applied before ranged attack.
- Attack status text currently reuses generic interaction status updates.

## Recommended Next Steps
1. Add monster archetypes with different aggro range, attack range, and projectile/melee patterns.
2. Add line-of-sight gating so ranged attacks require a clear shot.
3. Move monster AI tuning constants into a dedicated rules file.
