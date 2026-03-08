# Effect Tick Policy Handoff

## Branch
- Current working branch: `feat/effect-tick-policy`
- Local `main` was fast-forwarded to latest `origin/main` on 2026-03-07.

## Recently Landed
- Character stat system is now computed, not stored as flat fixed properties.
- Final stats are composed from:
  - job modifiers
  - user overrides
  - equipment bonuses
  - potion buffs
  - temporary bonuses
- Potion rules currently include:
  - shared cooldown groups
  - HUD display for active buffs and cooldowns
  - same-group replacement
  - same-potion refresh by replacing the existing buff entry with a new end time
- Time-based health/mana regeneration is already implemented and merged into `main`.

## Current Runtime Policy
- Regeneration is currently time-based using `deltaMs`, not frame-count-based.
- Relevant files:
  - `game/characters/CharacterRegenRules.ts`
  - `game/characters/CharacterUnit.ts`
  - `game/scenes/GameScene.ts`

## Next Design Question
- Decide the policy for when sustained effects are applied within one simulation tick.
- Main concern:
  - frame-driven effect application can disadvantage low-FPS users

## Recommended Direction
- Prefer fixed-step simulation for effect resolution instead of raw per-frame application.
- Recommended model:
  - accumulate elapsed time
  - consume fixed simulation ticks such as `100ms` or `200ms`
  - apply regen / DoT / HoT / buff expiration on those fixed ticks
- This keeps gameplay fair even when render FPS fluctuates.

## Worker Review
- A separate browser worker is not the first fix for fairness.
- Fairness comes from:
  - time-based simulation
  - fixed-step ticking
  - deterministic effect scheduling
- A worker may still help later if:
  - simulation cost grows large
  - pathfinding, combat, or AI begins to stall rendering
- For the current scope, worker introduction is likely premature.

## Suggested Next Steps
1. Introduce a small fixed-step effect scheduler in gameplay runtime.
2. Move regen and future DoT/HoT to the same scheduler.
3. Define exact ordering rules inside one tick:
   - expiration
   - damage over time
   - healing over time
   - mana regen
4. Only evaluate Web Worker extraction after profiling shows main-thread contention.
