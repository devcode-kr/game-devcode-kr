import type { CharacterStatModifier } from '../characters/CharacterStatRules'
import type { SkillActionId } from '../interactions/SkillActionBuilder'
import { SKILL_ACTION_IDS } from '../interactions/SkillActionBuilder'
import type { WeaponProjectileAttackId } from '../interactions/WeaponProjectileAttackBuilder'
import { WEAPON_PROJECTILE_ATTACK_IDS } from '../interactions/WeaponProjectileAttackBuilder'

export type UsableItemKind = 'potion'
export type EquipmentSlot = 'weapon' | 'armor' | 'accessory'
export type GeneralItemKind = 'quest' | 'key'
export type GemItemKind = 'skill-gem'
export type AttackStyle = 'melee' | 'ranged'

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

interface BaseItemDefinition {
  id: string
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

export interface UsableItemDefinition extends BaseItemDefinition {
  category: 'usable'
  usableKind: UsableItemKind
}

export interface EquippableItemDefinition extends BaseItemDefinition {
  category: 'equippable'
  equipmentSlot: EquipmentSlot
  weaponProjectileAttackId?: WeaponProjectileAttackId
  weaponAttackStyle?: AttackStyle
  accessorySocketCount?: number
}

export interface GeneralItemDefinition extends BaseItemDefinition {
  category: 'general'
  generalKind: GeneralItemKind
}

export interface GemItemDefinition extends BaseItemDefinition {
  category: 'gem'
  gemKind: GemItemKind
  compatibleAttackStyle: AttackStyle
  grantedSkillActionId: SkillActionId
}

export type ItemDefinition =
  | UsableItemDefinition
  | EquippableItemDefinition
  | GeneralItemDefinition
  | GemItemDefinition

export const ITEM_DEFINITIONS: Record<string, ItemDefinition> = {
  potion_minor: {
    id: 'potion_minor',
    name: 'Minor Potion',
    width: 1,
    height: 1,
    footprint: [[1]],
    stackable: true,
    maxStack: 8,
    category: 'usable',
    usableKind: 'potion',
    statModifiers: {
      healthRegen: 2.5,
    },
    statBuffDurationMs: RECOVERY_POTION_EFFECT_DURATION_MS,
    cooldownGroup: 'health_recovery',
    cooldownMs: 12000,
  },
  potion_guard: {
    id: 'potion_guard',
    name: 'Guard Potion',
    width: 1,
    height: 2,
    footprint: [[1], [1]],
    stackable: true,
    maxStack: 4,
    category: 'usable',
    usableKind: 'potion',
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
    name: 'Mana Potion',
    width: 1,
    height: 1,
    footprint: [[1]],
    stackable: true,
    maxStack: 8,
    category: 'usable',
    usableKind: 'potion',
    statModifiers: {
      manaRegen: 3.5,
    },
    statBuffDurationMs: RECOVERY_POTION_EFFECT_DURATION_MS,
    cooldownGroup: 'mana_recovery',
    cooldownMs: 12000,
  },
  potion_antidote: {
    id: 'potion_antidote',
    name: 'Antidote',
    width: 1,
    height: 1,
    footprint: [[1]],
    stackable: true,
    maxStack: 8,
    category: 'usable',
    usableKind: 'potion',
    curesPoison: true,
    cooldownGroup: 'antidote',
    cooldownMs: 8000,
  },
  potion_berserk: {
    id: 'potion_berserk',
    name: 'Berserk Potion',
    width: 1,
    height: 2,
    footprint: [[1], [1]],
    stackable: true,
    maxStack: 4,
    category: 'usable',
    usableKind: 'potion',
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
    name: 'Haste Potion',
    width: 1,
    height: 2,
    footprint: [[1], [1]],
    stackable: true,
    maxStack: 4,
    category: 'usable',
    usableKind: 'potion',
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
    name: 'Rusty Key',
    width: 1,
    height: 1,
    footprint: [[1]],
    stackable: true,
    maxStack: 12,
    category: 'general',
    generalKind: 'key',
  },
  gem_poison_shard: {
    id: 'gem_poison_shard',
    name: 'Poison Shard',
    width: 1,
    height: 1,
    footprint: [[1]],
    stackable: true,
    maxStack: 6,
    category: 'gem',
    gemKind: 'skill-gem',
    compatibleAttackStyle: 'ranged',
    grantedSkillActionId: SKILL_ACTION_IDS.debugPoisonShot,
    statModifiers: {
      rangedMagicAttack: 1,
    },
  },
  gem_totem_shard: {
    id: 'gem_totem_shard',
    name: 'Totem Shard',
    width: 1,
    height: 1,
    footprint: [[1]],
    stackable: true,
    maxStack: 6,
    category: 'gem',
    gemKind: 'skill-gem',
    compatibleAttackStyle: 'ranged',
    grantedSkillActionId: SKILL_ACTION_IDS.debugTotemDrop,
    statModifiers: {
      rangedMagicAttack: 1,
      manaRegen: 0.4,
    },
  },
  gem_split_shard: {
    id: 'gem_split_shard',
    name: 'Split Shard',
    width: 1,
    height: 1,
    footprint: [[1]],
    stackable: true,
    maxStack: 6,
    category: 'gem',
    gemKind: 'skill-gem',
    compatibleAttackStyle: 'ranged',
    grantedSkillActionId: SKILL_ACTION_IDS.debugSplitShot,
    statModifiers: {
      rangedAttack: 1,
      attackSpeed: 0.04,
    },
  },
  gem_familiar_shard: {
    id: 'gem_familiar_shard',
    name: 'Familiar Shard',
    width: 1,
    height: 1,
    footprint: [[1]],
    stackable: true,
    maxStack: 6,
    category: 'gem',
    gemKind: 'skill-gem',
    compatibleAttackStyle: 'ranged',
    grantedSkillActionId: SKILL_ACTION_IDS.debugFamiliarSummon,
    statModifiers: {
      rangedMagicAttack: 1,
      manaRegen: 0.2,
    },
  },
  test_shape_giyeok: {
    id: 'test_shape_giyeok',
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
    category: 'equippable',
    equipmentSlot: 'armor',
    statModifiers: {
      maxHealth: 12,
      defense: 2,
    },
  },
  test_shape_nieun: {
    id: 'test_shape_nieun',
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
    category: 'equippable',
    equipmentSlot: 'weapon',
    weaponProjectileAttackId: WEAPON_PROJECTILE_ATTACK_IDS.debugWand,
    weaponAttackStyle: 'melee',
    statModifiers: {
      meleeAttack: 4,
      attackSpeed: 0.05,
    },
  },
  test_shape_a: {
    id: 'test_shape_a',
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
    category: 'equippable',
    equipmentSlot: 'accessory',
    accessorySocketCount: 1,
    statModifiers: {
      manaRegen: 0.8,
      meleeMagicAttack: 3,
    },
  },
  test_shape_eo: {
    id: 'test_shape_eo',
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
    category: 'equippable',
    equipmentSlot: 'accessory',
    accessorySocketCount: 2,
    statModifiers: {
      rangedMagicAttack: 4,
      maxMana: 10,
    },
  },
  test_shape_ring_cross: {
    id: 'test_shape_ring_cross',
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
    category: 'equippable',
    equipmentSlot: 'armor',
    statModifiers: {
      fullDefenseChance: 0.04,
      defense: 1,
    },
  },
  test_shape_plateau_l: {
    id: 'test_shape_plateau_l',
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
    category: 'equippable',
    equipmentSlot: 'armor',
    statModifiers: {
      healthRegen: 0.8,
      maxHealth: 8,
    },
  },
  test_shape_block_hook: {
    id: 'test_shape_block_hook',
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
    category: 'equippable',
    equipmentSlot: 'weapon',
    weaponProjectileAttackId: WEAPON_PROJECTILE_ATTACK_IDS.debugWand,
    weaponAttackStyle: 'melee',
    statModifiers: {
      meleeAttack: 2,
      rangedAttack: 2,
      moveSpeed: 0.04,
    },
  },
  test_shape_standard_hook: {
    id: 'test_shape_standard_hook',
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
    category: 'equippable',
    equipmentSlot: 'weapon',
    weaponProjectileAttackId: WEAPON_PROJECTILE_ATTACK_IDS.debugWand,
    weaponAttackStyle: 'ranged',
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
  'gem_poison_shard',
  'gem_totem_shard',
  'gem_split_shard',
  'gem_familiar_shard',
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
    throw new Error(`Unknown item definition id: ${itemDefinitionId}`)
  }

  return definition
}

export function isUsableItemDefinition(definition: ItemDefinition): boolean {
  return definition.category === 'usable'
}

export function isUsableItem(
  definition: ItemDefinition
): definition is UsableItemDefinition {
  return definition.category === 'usable'
}

export function isEquippableItemDefinition(definition: ItemDefinition): boolean {
  return definition.category === 'equippable'
}

export function isEquippableItem(
  definition: ItemDefinition
): definition is EquippableItemDefinition {
  return definition.category === 'equippable'
}

export function isWeaponItemDefinition(
  definition: ItemDefinition
): definition is EquippableItemDefinition {
  return isEquippableItem(definition) && definition.equipmentSlot === 'weapon'
}

export function isArmorItemDefinition(
  definition: ItemDefinition
): definition is EquippableItemDefinition {
  return isEquippableItem(definition) && definition.equipmentSlot === 'armor'
}

export function isAccessoryItemDefinition(
  definition: ItemDefinition
): definition is EquippableItemDefinition {
  return isEquippableItem(definition) && definition.equipmentSlot === 'accessory'
}

export function isGeneralItemDefinition(definition: ItemDefinition): boolean {
  return definition.category === 'general'
}

export function isGeneralItem(
  definition: ItemDefinition
): definition is GeneralItemDefinition {
  return definition.category === 'general'
}

export function isGemItemDefinition(definition: ItemDefinition): boolean {
  return definition.category === 'gem'
}

export function isGemItem(
  definition: ItemDefinition
): definition is GemItemDefinition {
  return definition.category === 'gem'
}

export function isBeltCompatibleItemDefinition(definition: ItemDefinition): boolean {
  return isUsableItem(definition)
}

export function getItemTypeLabel(definition: ItemDefinition): string {
  if (isUsableItem(definition)) {
    return `${definition.category}:${definition.usableKind}`
  }
  if (isEquippableItem(definition)) {
    return `${definition.category}:${definition.equipmentSlot}`
  }
  if (isGeneralItem(definition)) {
    return `${definition.category}:${definition.generalKind}`
  }

  return `${definition.category}:${definition.gemKind}`
}
