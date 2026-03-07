export type ItemType = 'consumable' | 'utility' | 'equipment' | 'quest'

export interface ItemDefinition {
  id: string
  type: ItemType
  name: string
  width: number
  height: number
  stackable: boolean
  maxStack: number
  healAmount?: number
}

export const ITEM_DEFINITIONS: Record<string, ItemDefinition> = {
  potion_minor: {
    id: 'potion_minor',
    type: 'consumable',
    name: 'Minor Potion',
    width: 1,
    height: 2,
    stackable: true,
    maxStack: 4,
    healAmount: 35,
  },
  utility_key: {
    id: 'utility_key',
    type: 'utility',
    name: 'Rusty Key',
    width: 1,
    height: 1,
    stackable: true,
    maxStack: 12,
  },
} as const

export function getItemDefinition(itemDefinitionId: string): ItemDefinition {
  const definition = ITEM_DEFINITIONS[itemDefinitionId]
  if (!definition) {
    throw new Error(`Unknown item definition: ${itemDefinitionId}`)
  }

  return definition
}
