export type ItemType = 'consumable' | 'utility' | 'equipment' | 'quest'

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
    healAmount: 35,
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
    guardDurationMs: 30000,
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
    manaAmount: 30,
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
  'potion_minor',
  'potion_mana',
  'potion_antidote',
  'potion_guard',
] as const

export function getItemDefinition(itemDefinitionId: string): ItemDefinition {
  const definition = ITEM_DEFINITIONS[itemDefinitionId]
  if (!definition) {
    throw new Error(`Unknown item definition: ${itemDefinitionId}`)
  }

  return definition
}
