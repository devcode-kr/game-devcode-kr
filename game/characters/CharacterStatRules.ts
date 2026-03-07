import { DEFAULT_CHARACTER_STATS, type CharacterCombatStats } from './CharacterJobRules'

export type CharacterStatKey = keyof CharacterCombatStats
export type CharacterStatModifier = Partial<CharacterCombatStats>

export interface CharacterStatComputationInput {
  baseStats?: CharacterStatModifier
  userOverrides?: CharacterStatModifier
  equipmentBonuses?: CharacterStatModifier[]
  potionBonuses?: CharacterStatModifier[]
  temporaryBonuses?: CharacterStatModifier[]
}

const STAT_KEYS = Object.keys(DEFAULT_CHARACTER_STATS) as CharacterStatKey[]

export function createEmptyCharacterStatModifier(): CharacterStatModifier {
  return {}
}

export function resolveCharacterStats(input: CharacterStatComputationInput): CharacterCombatStats {
  const resolved = { ...DEFAULT_CHARACTER_STATS }
  const layers: CharacterStatModifier[] = [
    input.baseStats ?? {},
    input.userOverrides ?? {},
    ...(input.equipmentBonuses ?? []),
    ...(input.potionBonuses ?? []),
    ...(input.temporaryBonuses ?? []),
  ]

  for (const layer of layers) {
    for (const key of STAT_KEYS) {
      resolved[key] += layer[key] ?? 0
    }
  }

  resolved.maxHealth = Math.max(1, resolved.maxHealth)
  resolved.maxMana = Math.max(0, resolved.maxMana)
  resolved.healthRegen = Math.max(0, resolved.healthRegen)
  resolved.manaRegen = Math.max(0, resolved.manaRegen)
  resolved.moveSpeed = Math.max(0.1, resolved.moveSpeed)
  resolved.attackSpeed = Math.max(0.1, resolved.attackSpeed)
  resolved.magicAttackSpeed = Math.max(0.1, resolved.magicAttackSpeed)
  resolved.fullDefenseChance = Math.min(1, Math.max(0, resolved.fullDefenseChance))

  return resolved
}
