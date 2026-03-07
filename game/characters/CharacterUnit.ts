import * as Phaser from 'phaser'
import {
  getCharacterJobDefinition,
  type CharacterCombatStats,
  type CharacterJobDefinition,
  type CharacterJobId,
} from './CharacterJobRules'
import {
  createEmptyCharacterStatModifier,
  resolveCharacterStats,
  type CharacterStatModifier,
} from './CharacterStatRules'

export interface CharacterRuntimeSnapshot {
  jobId: CharacterJobId
  health: number
  mana: number
  poisoned: boolean
  guardBuffRemainingMs: number
}

interface CharacterUnitConfig {
  id: string
  displayName: string
  jobId: CharacterJobId
  userStatOverrides?: CharacterStatModifier
  health?: number
  mana?: number
  poisoned?: boolean
  guardBuffRemainingMs?: number
}

export abstract class CharacterUnit {
  readonly id: string
  readonly displayName: string
  private jobId: CharacterJobId
  private userStatOverrides: CharacterStatModifier
  private equipmentBonuses: CharacterStatModifier[] = []
  private potionBonuses: CharacterStatModifier[] = []
  private temporaryBonuses: CharacterStatModifier[] = []
  private health: number
  private mana: number
  private poisoned: boolean
  private guardBuffUntil = 0

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
  }

  abstract getKind(): string

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

  getHealth(): number {
    return this.health
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
    this.guardBuffUntil = Math.max(this.guardBuffUntil, now + Math.max(0, durationMs))
  }

  isDead(): boolean {
    return this.health <= 0
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
