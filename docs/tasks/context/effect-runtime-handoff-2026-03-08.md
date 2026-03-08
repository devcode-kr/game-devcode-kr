# Runtime And Combat Handoff 2026-03-08

## Branch And PR
- Current working branch: `init/first-feature`
- Existing PR: `#24`
- Work has continued on the same branch after the initial PR push.

## Current Direction
- `GameScene` is being reduced toward scene lifecycle and orchestration only.
- Sustained effects use a worker-owned fixed-tick runtime.
- Character state is being lifted into reusable `Character` / `CharacterUnit` / `CharacterController` layers.
- Combat delivery is being split into:
  - `projectile`
  - `deploy`
  - `summon`
- Attack behavior is now driven by:
  - equipped weapon
  - compatible socketed gems
  - action bundle composition

## What Changed

### 1. Effect runtime moved to worker-owned fixed ticks
- Main thread sends elapsed `deltaMs`.
- Worker consumes fixed ticks and returns authoritative effect state.
- Current tick order:
  - expiration
  - damage over time
  - health regen
  - mana regen

### 2. Debuff model generalized
- `poison` is no longer a dedicated timer field.
- Runtime now uses generic `activeDebuffs`.
- Current debuff support includes:
  - duration
  - stat modifiers
  - damage per second
  - damage remainder
  - health regen blocking
  - guard-based mitigation

### 3. Effect definitions and HUD were unified
- Shared effect registry now exists in `game/interactions/EffectDefinitions.ts`.
- Buffs, debuffs, and statuses each have dedicated definitions.
- Effect HUD is managed by `game/ui/EffectHudManager.ts`.
- Top-right layout is:
  - buffs
  - debuffs
  - status effects
- Tooltips come from effect definitions rather than HUD-only hardcoding.

### 4. Character foundation was introduced
- New shared character files:
  - `game/characters/Character.ts`
  - `game/characters/CharacterUnit.ts`
  - `game/characters/CharacterController.ts`
- Player and monster now both use the character stack.
- Character-level methods now cover:
  - inventory access
  - active buff/debuff/status queries
  - resource ticking helpers
  - move permission
  - move distance
  - vision radius

### 5. Movement and world actors were split
- Player and monster movement use character-oriented helpers.
- New world actor layers:
  - `game/world/MonsterActors.ts`
  - `game/world/ProjectileActors.ts`
  - `game/world/DeployableActors.ts`
  - `game/world/SummonActors.ts`
- Player and monsters block each other for occupancy and pathfinding.

### 6. Item model was restructured by role
- Item definitions are now role-based interfaces instead of one shape with ad-hoc flags.
- Current item categories:
  - `UsableItemDefinition`
  - `EquippableItemDefinition`
  - `GeneralItemDefinition`
  - `GemItemDefinition`
- Weapon, armor, accessory, and gem behavior now come from typed item definitions.

### 7. Equipment loadout and panel were introduced
- `game/items/CharacterEquipmentLoadout.ts` now owns equipped state.
- Current structure:
  - weapon slot
  - armor slot
  - accessory slots
  - gem socket ids per accessory
- A real scene-side equipment panel now exists in `game/ui/EquipmentPanel.ts`.
- Current equipment interaction supports:
  - click selected inventory item onto weapon / armor / accessory / socket slots
  - click filled slot with no selected item to clear
  - drag inventory item onto equipment slot to equip or socket
  - drag equipped item back onto the inventory grid to unequip
- Auto-loadout is still used only as a fallback when no explicit loadout exists yet.

### 8. Facing-based attack replaced pointer-based fire
- Projectile launch now follows character `facing`, not raw mouse direction.
- `Shift + LMB`:
  - rotates toward clicked cell
  - fires the current combined attack
- Facing indicator is rendered by `game/ui/FacingCaret.ts`.

### 9. Combat target rules were formalized
- Target validation moved into `game/interactions/CombatTargetRules.ts`.
- Current rules:
  - player can attack monster only
  - monster can attack player only
  - player cannot attack player or NPC
  - monster cannot attack monster or NPC
- Contact-based auto-combat was intentionally not added.

### 10. Projectile system was data-driven and eventized
- Projectile visuals and motion are defined in `game/interactions/ProjectileDefinitions.ts`.
- Projectile lifecycle payload now lives in event arrays.
- Current projectile runtime supports:
  - speed
  - radius
  - range
  - pierce
  - max hits
  - `onHit` events
  - `onExpire` events
  - direct damage
  - debuff application
  - area damage
  - spawn projectile
- Area damage currently supports:
  - `includePrimaryTarget`
  - `includeAttacker`
  - `maxTargets`
  - `fullDamageRadius`
  - `minimumScale`
  - `falloff: none | linear | smoothstep`

### 11. Action delivery model was introduced
- New shared delivery type in `game/interactions/ActionSpecs.ts`:
  - `projectile`
  - `deploy`
  - `summon`
- `game/interactions/ActionBundleRules.ts` composes:
  - weapon projectile action
  - compatible gem actions
- One input can now produce:
  - a projectile
  - extra deploy actions
  - extra summon actions

### 12. Deployables can inherit the owner attack
- `deploy` is now a real runtime, not only a placeholder.
- Deployables are fixed world objects with duration and periodic attacks.
- Current deploy inheritance behavior:
  - can copy the owner projectile action
  - copied damage is scaled down
  - additional active deployables apply further penalty
- Main related files:
  - `game/interactions/DeployActionBuilder.ts`
  - `game/interactions/DeployableDefinitions.ts`
  - `game/interactions/DeployableRuntime.ts`
  - `game/world/DeployableActors.ts`

### 13. Summons can inherit the owner attack
- `summon` is now a real runtime layer.
- Summons are independent support actors, not fixed installations.
- Current summon behavior:
  - spawn near player facing direction
  - orbit around the owner
  - periodically fire inherited projectile attacks at nearby monsters
  - inherited damage is weakened by base scale and per-active penalty
- Main related files:
  - `game/interactions/SummonDefinitions.ts`
  - `game/interactions/SummonRuntime.ts`
  - `game/world/SummonActors.ts`

### 14. Action execution runtime started moving out of GameScene
- `game/interactions/ActionExecutionRuntime.ts` now owns:
  - action bundle execution
  - facing-based projectile launch
  - deploy creation
  - summon creation
  - deploy auto-attacks
  - summon auto-attacks
- Equipped action bundle composition moved to:
  - `game/interactions/EquippedActionBundleRules.ts`
- `GameScene` still owns projectile lifecycle event application, but the action launch side is now split out.

## Current Testable Examples
- Equipped ranged weapon + `gem_poison_shard`
  - combined projectile adds poison support
- Equipped ranged weapon + `gem_totem_shard`
  - combined attack also installs a totem
- Equipped ranged weapon + `gem_familiar_shard`
  - combined attack also summons a familiar
- Equipped ranged weapon + `gem_split_shard`
  - projectile expiration can spawn follow-up projectiles

## Key Files

### Effect runtime
- `game/interactions/EffectRuntimeClient.ts`
- `game/interactions/EffectRuntimeWorker.ts`
- `game/interactions/EffectRuntimeProtocol.ts`
- `game/interactions/EffectRuntimeRules.ts`
- `game/interactions/EffectDebuffRules.ts`
- `game/interactions/EffectDefinitions.ts`

### Character and combat foundation
- `game/characters/Character.ts`
- `game/characters/CharacterUnit.ts`
- `game/characters/CharacterController.ts`
- `game/characters/PlayerCharacter.ts`
- `game/characters/MonsterCharacter.ts`
- `game/interactions/CombatTargetRules.ts`

### Items and loadout
- `game/items/ItemCatalog.ts`
- `game/items/CharacterEquipmentLoadout.ts`

### Action delivery
- `game/interactions/ActionSpecs.ts`
- `game/interactions/ActionBundleRules.ts`
- `game/interactions/ActionExecutionRuntime.ts`
- `game/interactions/EquippedActionBundleRules.ts`
- `game/interactions/ProjectileActionRules.ts`
- `game/interactions/ProjectileAreaDamageRules.ts`
- `game/interactions/WeaponProjectileAttackBuilder.ts`
- `game/interactions/SkillActionBuilder.ts`
- `game/interactions/ProjectileDefinitions.ts`
- `game/interactions/DeployableDefinitions.ts`
- `game/interactions/SummonDefinitions.ts`

### World actors
- `game/world/MonsterActors.ts`
- `game/world/ProjectileActors.ts`
- `game/world/DeployableActors.ts`
- `game/world/SummonActors.ts`

### UI
- `game/ui/EffectHudManager.ts`
- `game/ui/InventoryPanel.ts`
- `game/ui/EquipmentPanel.ts`
- `game/ui/FacingCaret.ts`

## Current Input Policy
- `Shift + LMB`
  - face target cell
  - execute combined equipped attack
- `F`
  - fire combined equipped attack for debug
- `V`
  - deploy debug totem directly

## Known Gaps
- Projectile lifecycle event execution still lives partly in `GameScene`.
- Equipment panel drag UX does not yet show dedicated drag previews for equipped items.
- Unequip to belt is not supported.
- Equipment panel still uses simple text rows rather than icon slots.
- Summons do not yet use full character/effect runtime integration.
- `GameScene` still owns too much runtime wiring overall.

## Verification
- `npx tsc --noEmit`
- `npm run lint`

## Recommended Next Focus
1. Move projectile lifecycle event application out of `GameScene` into dedicated runtime helpers.
2. Add richer equipment drag UX:
   - equipped-item drag preview
   - drop highlight on inventory cells
   - better slot tooltip detail
3. Extend lifecycle events with:
   - spawn deployable
   - spawn summon
   - event-carried secondary debuffs
4. Decide whether summons should become full `Character`-backed actors with effects and stats.
