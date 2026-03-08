import type { EffectDebuffRuntime } from '../interactions/EffectDebuffRules'
import type { ActiveItemBuffRuntime } from '../items/ItemStatRules'
import type { InventoryState } from '../items/Inventory'
import type { CharacterFaction } from './CharacterFaction'
import type { CharacterRuntimeSnapshot } from './CharacterRuntimeSnapshot'

export interface Character {
  getKind(): string
  getFaction(): CharacterFaction
  getInventory(): InventoryState
  getBeltInventory(): InventoryState
  getActiveItemBuffs(): ActiveItemBuffRuntime[]
  getActiveDebuffs(): EffectDebuffRuntime[]
  getActiveStatusIds(now: number): string[]
  getVisionRadius(): number
  canMove(): boolean
  getMoveDistance(deltaMs: number): number
  computeMoveDelta(deltaMs: number, direction: { x: number; y: number }): { x: number; y: number }
  tickResources(deltaMs: number): void
  createRuntimeSnapshot(now: number): CharacterRuntimeSnapshot
}
