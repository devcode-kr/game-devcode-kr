import * as Phaser from 'phaser'
import type { Character } from './Character'
import type { CharacterCombatStats } from './CharacterCombatStats'
import type { CharacterFaction } from './CharacterFaction'
import type { CharacterRuntimeSnapshot } from './CharacterRuntimeSnapshot'
import type { CharacterStatModifier } from './CharacterStatModifier'
import {
  getCharacterJobDefinition,
  type CharacterJobDefinition,
  type CharacterJobId,
} from './CharacterJobRules'
import {
  createEmptyCharacterStatModifier,
  resolveCharacterStats,
} from './CharacterStatRules'
import { tickRegeneration } from './CharacterRegenRules'
import type { ActiveItemBuffRuntime } from '../items/ItemStatRules'
import type { EffectDebuffRuntime } from '../interactions/EffectDebuffRules'
import { createEmptyInventory, type InventoryState } from '../items/Inventory'
import {
  createEmptyCharacterEquipmentLoadout,
  type CharacterEquipmentLoadout,
} from '../items/CharacterEquipmentLoadout'
import { STATUS_EFFECT_IDS } from '../interactions/EffectDefinitions'

interface CharacterUnitConfig {
  id: string
  displayName: string
  jobId: CharacterJobId
  userStatOverrides?: CharacterStatModifier
  health?: number
  mana?: number
  poisoned?: boolean
  guardBuffRemainingMs?: number
  inventoryCols?: number
  inventoryRows?: number
  beltCols?: number
  beltRows?: number
}

export abstract class CharacterUnit implements Character {
  readonly id: string
  readonly displayName: string
  private jobId: CharacterJobId
  private userStatOverrides: CharacterStatModifier
  private equipmentBonuses: CharacterStatModifier[] = []
  private potionBonuses: CharacterStatModifier[] = []
  private temporaryBonuses: CharacterStatModifier[] = []
  private inventory: InventoryState
  private beltInventory: InventoryState
  private equipmentLoadout: CharacterEquipmentLoadout
  private activeItemBuffs: ActiveItemBuffRuntime[] = []
  private activeDebuffs: EffectDebuffRuntime[] = []
  private health: number
  private mana: number
  private poisoned: boolean
  private guardBuffUntil = 0
  private healthRegenRemainder = 0
  private manaRegenRemainder = 0

  protected constructor(config: CharacterUnitConfig) {
    this.id = config.id
    this.displayName = config.displayName
    this.jobId = config.jobId
    this.userStatOverrides = config.userStatOverrides ?? createEmptyCharacterStatModifier()

    const stats = this.getCombatStats()
    this.health = Phaser.Math.Clamp(config.health ?? stats.maxHealth, 0, stats.maxHealth)
    this.mana = Phaser.Math.Clamp(config.mana ?? stats.maxMana, 0, stats.maxMana)
    this.poisoned = config.poisoned ?? false
    this.guardBuffUntil = config.guardBuffRemainingMs ?? 0
    this.inventory = createEmptyInventory(config.inventoryCols ?? 0, config.inventoryRows ?? 0)
    this.beltInventory = createEmptyInventory(config.beltCols ?? 0, config.beltRows ?? 0)
    this.equipmentLoadout = createEmptyCharacterEquipmentLoadout()
  }

  abstract getKind(): string
  abstract getFaction(): CharacterFaction

  getJob(): CharacterJobDefinition {
    return getCharacterJobDefinition(this.jobId)
  }

  getJobId(): CharacterJobId {
    return this.jobId
  }

  setJob(jobId: CharacterJobId): void {
    this.jobId = jobId
    this.reconcileResourceCaps()
  }

  getCombatStats(): CharacterCombatStats {
    return resolveCharacterStats({
      baseStats: this.getJob().statModifiers,
      userOverrides: this.userStatOverrides,
      equipmentBonuses: this.equipmentBonuses,
      potionBonuses: this.potionBonuses,
      temporaryBonuses: this.temporaryBonuses,
    })
  }

  setUserStatOverrides(modifier: CharacterStatModifier): void {
    this.userStatOverrides = modifier
    this.reconcileResourceCaps()
  }

  setEquipmentBonuses(modifiers: CharacterStatModifier[]): void {
    this.equipmentBonuses = modifiers
    this.reconcileResourceCaps()
  }

  setPotionBonuses(modifiers: CharacterStatModifier[]): void {
    this.potionBonuses = modifiers
    this.reconcileResourceCaps()
  }

  setTemporaryBonuses(modifiers: CharacterStatModifier[]): void {
    this.temporaryBonuses = modifiers
    this.reconcileResourceCaps()
  }

  getInventory(): InventoryState {
    return this.inventory
  }

  getBeltInventory(): InventoryState {
    return this.beltInventory
  }

  setInventoryStates(inventory: InventoryState, beltInventory: InventoryState): void {
    this.inventory = inventory
    this.beltInventory = beltInventory
  }

  getEquipmentLoadout(): CharacterEquipmentLoadout {
    return this.equipmentLoadout
  }

  setEquipmentLoadout(equipmentLoadout: CharacterEquipmentLoadout): void {
    this.equipmentLoadout = equipmentLoadout
  }

  getActiveItemBuffs(): ActiveItemBuffRuntime[] {
    return this.activeItemBuffs
  }

  setActiveItemBuffs(activeItemBuffs: ActiveItemBuffRuntime[]): void {
    this.activeItemBuffs = activeItemBuffs
  }

  getActiveDebuffs(): EffectDebuffRuntime[] {
    return this.activeDebuffs
  }

  setActiveDebuffs(activeDebuffs: EffectDebuffRuntime[]): void {
    this.activeDebuffs = activeDebuffs
  }

  getActiveStatusIds(now: number): string[] {
    const statuses: string[] = []
    if (this.poisoned) {
      statuses.push(STATUS_EFFECT_IDS.poisoned)
    }
    if (this.isGuardActive(now)) {
      statuses.push(STATUS_EFFECT_IDS.guard)
    }
    if (this.isDead()) {
      statuses.push(STATUS_EFFECT_IDS.dead)
    }
    return statuses
  }

  getHealth(): number {
    return this.health
  }

  getVisionRadius(): number {
    return this.getCombatStats().visionRadius
  }

  getMaxHealth(): number {
    return this.getCombatStats().maxHealth
  }

  getMana(): number {
    return this.mana
  }

  getMaxMana(): number {
    return this.getCombatStats().maxMana
  }

  getHealthRegen(): number {
    return this.getCombatStats().healthRegen
  }

  getManaRegen(): number {
    return this.getCombatStats().manaRegen
  }

  getMeleeAttack(): number {
    return this.getCombatStats().meleeAttack
  }

  getRangedAttack(): number {
    return this.getCombatStats().rangedAttack
  }

  getMeleeMagicAttack(): number {
    return this.getCombatStats().meleeMagicAttack
  }

  getRangedMagicAttack(): number {
    return this.getCombatStats().rangedMagicAttack
  }

  getDefense(): number {
    return this.getCombatStats().defense
  }

  getMoveSpeed(): number {
    return this.getCombatStats().moveSpeed
  }

  getAttackSpeed(): number {
    return this.getCombatStats().attackSpeed
  }

  getMagicAttackSpeed(): number {
    return this.getCombatStats().magicAttackSpeed
  }

  getFullDefenseChance(): number {
    return this.getCombatStats().fullDefenseChance
  }

  isPoisoned(): boolean {
    return this.poisoned
  }

  setHealth(health: number): void {
    this.health = Phaser.Math.Clamp(health, 0, this.getMaxHealth())
  }

  setMana(mana: number): void {
    this.mana = Phaser.Math.Clamp(mana, 0, this.getMaxMana())
  }

  setPoisoned(poisoned: boolean): void {
    this.poisoned = poisoned
  }

  tickResources(deltaMs: number): void {
    if (this.isDead()) {
      return
    }

    const healthTick = tickRegeneration({
      currentValue: this.health,
      maxValue: this.getMaxHealth(),
      regenPerSecond: this.poisoned ? 0 : this.getHealthRegen(),
      deltaMs,
      remainder: this.healthRegenRemainder,
    })
    this.health = healthTick.nextValue
    this.healthRegenRemainder = healthTick.remainder

    const manaTick = tickRegeneration({
      currentValue: this.mana,
      maxValue: this.getMaxMana(),
      regenPerSecond: this.getManaRegen(),
      deltaMs,
      remainder: this.manaRegenRemainder,
    })
    this.mana = manaTick.nextValue
    this.manaRegenRemainder = manaTick.remainder
  }

  applyRegeneration(deltaMs: number): void {
    this.tickResources(deltaMs)
  }

  private reconcileResourceCaps(): void {
    const stats = this.getCombatStats()
    this.health = Phaser.Math.Clamp(this.health, 0, stats.maxHealth)
    this.mana = Phaser.Math.Clamp(this.mana, 0, stats.maxMana)
  }

  isGuardActive(now: number): boolean {
    return this.guardBuffUntil > now
  }

  getGuardBuffRemainingMs(now: number): number {
    return Math.max(0, this.guardBuffUntil - now)
  }

  setGuardBuffRemainingMs(remainingMs: number, now: number): void {
    this.guardBuffUntil = now + Math.max(0, remainingMs)
  }

  extendGuardBuff(durationMs: number, now: number): void {
    this.guardBuffUntil = Math.max(this.guardBuffUntil, now) + Math.max(0, durationMs)
  }

  isDead(): boolean {
    return this.health <= 0
  }

  canMove(): boolean {
    return !this.isDead() && this.getMoveSpeed() > 0
  }

  getMoveDistance(deltaMs: number): number {
    if (!this.canMove() || deltaMs <= 0) {
      return 0
    }

    return (deltaMs / 1000) * this.getMoveSpeed()
  }

  computeMoveDelta(deltaMs: number, direction: { x: number; y: number }): { x: number; y: number } {
    const vector = new Phaser.Math.Vector2(direction.x, direction.y)
    if (!this.canMove() || vector.lengthSq() === 0) {
      return { x: 0, y: 0 }
    }

    vector.normalize().scale(this.getMoveDistance(deltaMs))
    return {
      x: vector.x,
      y: vector.y,
    }
  }

  applyRuntimeSnapshot(snapshot: CharacterRuntimeSnapshot, now: number): void {
    this.setJob(snapshot.jobId)
    this.setHealth(snapshot.health)
    this.setMana(snapshot.mana)
    this.setPoisoned(snapshot.poisoned)
    this.setGuardBuffRemainingMs(snapshot.guardBuffRemainingMs, now)
  }

  createRuntimeSnapshot(now: number): CharacterRuntimeSnapshot {
    return {
      jobId: this.jobId,
      health: this.health,
      mana: this.mana,
      poisoned: this.poisoned,
      guardBuffRemainingMs: this.getGuardBuffRemainingMs(now),
    }
  }
}
