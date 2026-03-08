export const DEPLOYABLE_DEFINITION_IDS = {
  debugTotem: 'debug_totem',
} as const

export type DeployableDefinitionId =
  (typeof DEPLOYABLE_DEFINITION_IDS)[keyof typeof DEPLOYABLE_DEFINITION_IDS]

export interface DeployablePresentation {
  fillColor: number
  strokeColor: number
  width: number
  height: number
}

export interface DeployableDefinition {
  id: DeployableDefinitionId
  label: string
  presentation: DeployablePresentation
}

const DEPLOYABLE_DEFINITIONS: Record<DeployableDefinitionId, DeployableDefinition> = {
  [DEPLOYABLE_DEFINITION_IDS.debugTotem]: {
    id: DEPLOYABLE_DEFINITION_IDS.debugTotem,
    label: 'Debug Totem',
    presentation: {
      fillColor: 0x0f766e,
      strokeColor: 0xccfbf1,
      width: 18,
      height: 24,
    },
  },
}

export function getDeployableDefinition(id: DeployableDefinitionId): DeployableDefinition {
  return DEPLOYABLE_DEFINITIONS[id]
}
