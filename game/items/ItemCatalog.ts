export type ItemType = 'consumable' | 'utility' | 'equipment' | 'quest'
import type { CharacterStatModifier } from '../characters/CharacterStatRules'

export type ItemCooldownGroup =
  | 'health_recovery'
  | 'mana_recovery'
  | 'antidote'
  | 'attack_boost'
  | 'attack_speed_boost'
  | 'defense_boost'

const RECOVERY_POTION_EFFECT_DURATION_MS = 12000
const DEFENSE_POTION_EFFECT_DURATION_MS = 18000
const ATTACK_POTION_EFFECT_DURATION_MS = 18000
const ATTACK_SPEED_POTION_EFFECT_DURATION_MS = 15000

export interface ItemDefinition {
  id: string
  type: ItemType
  name: string
  width: number
  height: number
  footprint: number[][]
  stackable: boolean
  maxStack: number
  healAmount?: number
  manaAmount?: number
  curesPoison?: boolean
  guardDurationMs?: number
  statModifiers?: CharacterStatModifier
  statBuffDurationMs?: number
  cooldownGroup?: ItemCooldownGroup
  cooldownMs?: number
}

export const ITEM_DEFINITIONS: Record<string, ItemDefinition> = {
  potion_minor: {
    id: 'potion_minor',
    type: 'consumable',
    name: 'Minor Potion',
    width: 1,
    height: 1,
    footprint: [
      [1],
    ],
    stackable: true,
    maxStack: 8,
    statModifiers: {
      healthRegen: 2.5,
    },
    statBuffDurationMs: RECOVERY_POTION_EFFECT_DURATION_MS,
    cooldownGroup: 'health_recovery',
    cooldownMs: 12000,
  },
  potion_guard: {
    id: 'potion_guard',
    type: 'consumable',
    name: 'Guard Potion',
    width: 1,
    height: 2,
    footprint: [
      [1],
      [1],
    ],
    stackable: true,
    maxStack: 4,
    guardDurationMs: DEFENSE_POTION_EFFECT_DURATION_MS,
    statModifiers: {
      defense: 8,
      fullDefenseChance: 0.18,
    },
    statBuffDurationMs: DEFENSE_POTION_EFFECT_DURATION_MS,
    cooldownGroup: 'defense_boost',
    cooldownMs: 18000,
  },
  potion_mana: {
    id: 'potion_mana',
    type: 'consumable',
    name: 'Mana Potion',
    width: 1,
    height: 1,
    footprint: [
      [1],
    ],
    stackable: true,
    maxStack: 8,
    statModifiers: {
      manaRegen: 3.5,
    },
    statBuffDurationMs: RECOVERY_POTION_EFFECT_DURATION_MS,
    cooldownGroup: 'mana_recovery',
    cooldownMs: 12000,
  },
  potion_antidote: {
    id: 'potion_antidote',
    type: 'consumable',
    name: 'Antidote',
    width: 1,
    height: 1,
    footprint: [
      [1],
    ],
    stackable: true,
    maxStack: 8,
    curesPoison: true,
    cooldownGroup: 'antidote',
    cooldownMs: 8000,
  },
  potion_berserk: {
    id: 'potion_berserk',
    type: 'consumable',
    name: 'Berserk Potion',
    width: 1,
    height: 2,
    footprint: [
      [1],
      [1],
    ],
    stackable: true,
    maxStack: 4,
    statModifiers: {
      meleeAttack: 6,
      rangedAttack: 6,
      meleeMagicAttack: 3,
      rangedMagicAttack: 3,
    },
    statBuffDurationMs: ATTACK_POTION_EFFECT_DURATION_MS,
    cooldownGroup: 'attack_boost',
    cooldownMs: 16000,
  },
  potion_haste: {
    id: 'potion_haste',
    type: 'consumable',
    name: 'Haste Potion',
    width: 1,
    height: 2,
    footprint: [
      [1],
      [1],
    ],
    stackable: true,
    maxStack: 4,
    statModifiers: {
      attackSpeed: 0.22,
      magicAttackSpeed: 0.22,
      moveSpeed: 0.08,
    },
    statBuffDurationMs: ATTACK_SPEED_POTION_EFFECT_DURATION_MS,
    cooldownGroup: 'attack_speed_boost',
    cooldownMs: 16000,
  },
  utility_key: {
    id: 'utility_key',
    type: 'utility',
    name: 'Rusty Key',
    width: 1,
    height: 1,
    footprint: [
      [1],
    ],
    stackable: true,
    maxStack: 12,
  },
  test_shape_giyeok: {
    id: 'test_shape_giyeok',
    type: 'equipment',
    name: 'Test Shape ㄱ',
    width: 3,
    height: 3,
    footprint: [
      [1, 0, 0],
      [1, 0, 0],
      [1, 1, 1],
    ],
    stackable: false,
    maxStack: 1,
    statModifiers: {
      maxHealth: 12,
      defense: 2,
    },
  },
  test_shape_nieun: {
    id: 'test_shape_nieun',
    type: 'equipment',
    name: 'Test Shape ㄴ',
    width: 3,
    height: 3,
    footprint: [
      [1, 1, 1],
      [1, 0, 0],
      [1, 0, 0],
    ],
    stackable: false,
    maxStack: 1,
    statModifiers: {
      meleeAttack: 4,
      attackSpeed: 0.05,
    },
  },
  test_shape_a: {
    id: 'test_shape_a',
    type: 'equipment',
    name: 'Test Shape ㅏ',
    width: 3,
    height: 3,
    footprint: [
      [0, 1, 0],
      [0, 1, 1],
      [0, 1, 0],
    ],
    stackable: false,
    maxStack: 1,
    statModifiers: {
      manaRegen: 0.8,
      meleeMagicAttack: 3,
    },
  },
  test_shape_eo: {
    id: 'test_shape_eo',
    type: 'equipment',
    name: 'Test Shape ㅓ',
    width: 3,
    height: 3,
    footprint: [
      [0, 1, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
    stackable: false,
    maxStack: 1,
    statModifiers: {
      rangedMagicAttack: 4,
      maxMana: 10,
    },
  },
  test_shape_ring_cross: {
    id: 'test_shape_ring_cross',
    type: 'equipment',
    name: 'Test Shape 101/010/101',
    width: 3,
    height: 3,
    footprint: [
      [1, 0, 1],
      [0, 1, 0],
      [1, 0, 1],
    ],
    stackable: false,
    maxStack: 1,
    statModifiers: {
      fullDefenseChance: 0.04,
      defense: 1,
    },
  },
  test_shape_plateau_l: {
    id: 'test_shape_plateau_l',
    type: 'equipment',
    name: 'Test Shape 111/100/000',
    width: 3,
    height: 3,
    footprint: [
      [1, 1, 1],
      [1, 0, 0],
      [0, 0, 0],
    ],
    stackable: false,
    maxStack: 1,
    statModifiers: {
      healthRegen: 0.8,
      maxHealth: 8,
    },
  },
  test_shape_block_hook: {
    id: 'test_shape_block_hook',
    type: 'equipment',
    name: 'Test Shape 111/110/110',
    width: 3,
    height: 3,
    footprint: [
      [1, 1, 1],
      [1, 1, 0],
      [1, 1, 0],
    ],
    stackable: false,
    maxStack: 1,
    statModifiers: {
      meleeAttack: 2,
      rangedAttack: 2,
      moveSpeed: 0.04,
    },
  },
  test_shape_standard_hook: {
    id: 'test_shape_standard_hook',
    type: 'equipment',
    name: 'Test Shape 000/111/001',
    width: 3,
    height: 3,
    footprint: [
      [0, 0, 0],
      [1, 1, 1],
      [0, 0, 1],
    ],
    stackable: false,
    maxStack: 1,
    statModifiers: {
      rangedAttack: 5,
      moveSpeed: 0.08,
    },
  },
} as const

export const TEST_SHAPE_ITEM_DEFINITION_IDS = [
  'test_shape_giyeok',
  'test_shape_nieun',
  'test_shape_a',
  'test_shape_eo',
  'test_shape_ring_cross',
  'test_shape_plateau_l',
  'test_shape_block_hook',
  'test_shape_standard_hook',
] as const

export const TEST_BELT_ITEM_DEFINITION_IDS = [
  'potion_minor',
  'potion_mana',
  'potion_antidote',
  'potion_guard',
  'potion_berserk',
  'potion_haste',
] as const

export function getItemDefinition(itemDefinitionId: string): ItemDefinition {
  const definition = ITEM_DEFINITIONS[itemDefinitionId]
  if (!definition) {
    throw new Error(`Unknown item definition: ${itemDefinitionId}`)
  }

  return definition
}
