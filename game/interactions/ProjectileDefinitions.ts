export const PROJECTILE_DEFINITION_IDS = {
  debugBolt: 'debug_bolt',
  debugPoisonBolt: 'debug_poison_bolt',
} as const

export type ProjectileDefinitionId =
  (typeof PROJECTILE_DEFINITION_IDS)[keyof typeof PROJECTILE_DEFINITION_IDS]

export interface ProjectilePresentation {
  fillColor: number
  strokeColor: number
  width: number
  height: number
}

export interface ProjectileDefinition {
  id: ProjectileDefinitionId
  label: string
  speed: number
  radius: number
  maxRange: number
  piercesTargets: boolean
  maxHits: number
  presentation: ProjectilePresentation
}

const PROJECTILE_DEFINITIONS: Record<ProjectileDefinitionId, ProjectileDefinition> = {
  [PROJECTILE_DEFINITION_IDS.debugBolt]: {
    id: PROJECTILE_DEFINITION_IDS.debugBolt,
    label: 'Debug Bolt',
    speed: 7.5,
    radius: 0.18,
    maxRange: 8,
    piercesTargets: false,
    maxHits: 1,
    presentation: {
      fillColor: 0xfbbf24,
      strokeColor: 0xfef3c7,
      width: 10,
      height: 10,
    },
  },
  [PROJECTILE_DEFINITION_IDS.debugPoisonBolt]: {
    id: PROJECTILE_DEFINITION_IDS.debugPoisonBolt,
    label: 'Debug Poison Bolt',
    speed: 6.8,
    radius: 0.18,
    maxRange: 7,
    piercesTargets: false,
    maxHits: 1,
    presentation: {
      fillColor: 0x22c55e,
      strokeColor: 0xdcfce7,
      width: 10,
      height: 10,
    },
  },
}

export function getProjectileDefinition(id: ProjectileDefinitionId): ProjectileDefinition {
  return PROJECTILE_DEFINITIONS[id]
}
