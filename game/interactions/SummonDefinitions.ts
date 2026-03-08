export const SUMMON_DEFINITION_IDS = {
  debugFamiliar: 'debug_familiar',
} as const

export type SummonDefinitionId =
  (typeof SUMMON_DEFINITION_IDS)[keyof typeof SUMMON_DEFINITION_IDS]

export interface SummonDefinition {
  id: SummonDefinitionId
  label: string
  orbitRadius: number
  moveSpeed: number
  bodyRadius: number
  fillColor: number
  strokeColor: number
}

const SUMMON_DEFINITIONS: Record<SummonDefinitionId, SummonDefinition> = {
  [SUMMON_DEFINITION_IDS.debugFamiliar]: {
    id: SUMMON_DEFINITION_IDS.debugFamiliar,
    label: 'Debug Familiar',
    orbitRadius: 1.25,
    moveSpeed: 2.5,
    bodyRadius: 0.2,
    fillColor: 0x1d4ed8,
    strokeColor: 0xbfdbfe,
  },
}

export function getSummonDefinition(id: SummonDefinitionId): SummonDefinition {
  return SUMMON_DEFINITIONS[id]
}
