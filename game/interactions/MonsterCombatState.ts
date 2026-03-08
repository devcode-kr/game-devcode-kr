export const MONSTER_COMBAT_STATES = {
  idle: 'idle',
  chase: 'chase',
  attack: 'attack',
  return: 'return',
} as const

export type MonsterCombatState =
  (typeof MONSTER_COMBAT_STATES)[keyof typeof MONSTER_COMBAT_STATES]
