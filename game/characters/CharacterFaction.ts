export const CHARACTER_FACTIONS = {
  player: 'player',
  monster: 'monster',
  npc: 'npc',
} as const

export type CharacterFaction = (typeof CHARACTER_FACTIONS)[keyof typeof CHARACTER_FACTIONS]
