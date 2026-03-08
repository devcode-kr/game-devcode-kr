import type { CharacterStatModifier } from './CharacterStatRules'

export type CharacterJobId = 'warrior' | 'mage' | 'rogue'

export interface CharacterCombatStats {
  visionRadius: number
  maxHealth: number
  maxMana: number
  healthRegen: number
  manaRegen: number
  meleeAttack: number
  rangedAttack: number
  meleeMagicAttack: number
  rangedMagicAttack: number
  defense: number
  moveSpeed: number
  attackSpeed: number
  magicAttackSpeed: number
  fullDefenseChance: number
}

export interface CharacterJobDefinition {
  id: CharacterJobId
  label: string
  description: string
  statModifiers: CharacterStatModifier
}

export const DEFAULT_CHARACTER_STATS: CharacterCombatStats = {
  visionRadius: 12,
  maxHealth: 100,
  maxMana: 50,
  healthRegen: 1,
  manaRegen: 1.5,
  meleeAttack: 10,
  rangedAttack: 10,
  meleeMagicAttack: 8,
  rangedMagicAttack: 8,
  defense: 5,
  moveSpeed: 1,
  attackSpeed: 1,
  magicAttackSpeed: 1,
  fullDefenseChance: 0.03,
}

const CHARACTER_JOB_DEFINITIONS: Record<CharacterJobId, CharacterJobDefinition> = {
  warrior: {
    id: 'warrior',
    label: 'Warrior',
    description: 'High durability frontliner with stable physical damage.',
    statModifiers: {
      visionRadius: 11,
      maxHealth: 145,
      maxMana: 30,
      healthRegen: 1.4,
      manaRegen: 0.7,
      meleeAttack: 18,
      rangedAttack: 8,
      meleeMagicAttack: 4,
      rangedMagicAttack: 3,
      defense: 12,
      moveSpeed: 0.95,
      attackSpeed: 1.05,
      magicAttackSpeed: 0.8,
      fullDefenseChance: 0.1,
    },
  },
  mage: {
    id: 'mage',
    label: 'Mage',
    description: 'Fragile caster with a deep mana pool.',
    statModifiers: {
      visionRadius: 14,
      maxHealth: 80,
      maxMana: 130,
      healthRegen: 0.7,
      manaRegen: 2.4,
      meleeAttack: 5,
      rangedAttack: 7,
      meleeMagicAttack: 18,
      rangedMagicAttack: 24,
      defense: 3,
      moveSpeed: 1,
      attackSpeed: 0.9,
      magicAttackSpeed: 1.2,
      fullDefenseChance: 0.02,
    },
  },
  rogue: {
    id: 'rogue',
    label: 'Rogue',
    description: 'Mobile skirmisher with balanced survival and offense.',
    statModifiers: {
      visionRadius: 13,
      maxHealth: 100,
      maxMana: 50,
      healthRegen: 1,
      manaRegen: 1.2,
      meleeAttack: 14,
      rangedAttack: 18,
      meleeMagicAttack: 7,
      rangedMagicAttack: 9,
      defense: 7,
      moveSpeed: 1.12,
      attackSpeed: 1.18,
      magicAttackSpeed: 0.95,
      fullDefenseChance: 0.06,
    },
  },
}

export function getCharacterJobDefinition(jobId: CharacterJobId): CharacterJobDefinition {
  return CHARACTER_JOB_DEFINITIONS[jobId]
}

export function getDefaultCharacterJobId(): CharacterJobId {
  return 'warrior'
}
