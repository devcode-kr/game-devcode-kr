export const SKILL_ACTION_IDS = {
  debugPoisonShot: 'debug_poison_shot',
  debugSplitShot: 'debug_split_shot',
  debugTotemDrop: 'debug_totem_drop',
  debugFamiliarSummon: 'debug_familiar_summon',
} as const

export type SkillActionId =
  (typeof SKILL_ACTION_IDS)[keyof typeof SKILL_ACTION_IDS]
