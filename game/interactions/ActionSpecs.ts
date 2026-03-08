import type { CharacterStatModifier } from '../characters/CharacterStatRules'
import type { DeployableDefinitionId } from './DeployableDefinitions'
import type { ProjectileDefinitionId } from './ProjectileDefinitions'
import type { SummonDefinitionId } from './SummonDefinitions'

export type ActionDeliveryType = 'projectile' | 'deploy' | 'summon'

export interface ProjectileOnHitDebuffApplication {
  id: string
  displayName: string
  durationMs: number
  statModifiers?: CharacterStatModifier
  damagePerSecond?: number
  blocksHealthRegen?: boolean
  guardMitigatesDamage?: boolean
}

export interface ProjectileDirectDamageEvent {
  type: 'direct_damage'
  amount: number
}

export interface ProjectileApplyDebuffEvent {
  type: 'apply_debuff'
  debuff: ProjectileOnHitDebuffApplication
}

export interface ProjectileAreaDamageEvent {
  type: 'area_damage'
  radius: number
  amount: number
  includePrimaryTarget?: boolean
  includeAttacker?: boolean
  maxTargets?: number
  fullDamageRadius?: number
  minimumScale?: number
  falloff?: 'none' | 'linear' | 'smoothstep'
}

export interface ProjectileSpawnProjectileEvent {
  type: 'spawn_projectile'
  projectile: ProjectileActionSpec
  count?: number
  spreadDegrees?: number
  angleOffsetDegrees?: number
}

export type ProjectileLifecycleEvent =
  | ProjectileDirectDamageEvent
  | ProjectileApplyDebuffEvent
  | ProjectileAreaDamageEvent
  | ProjectileSpawnProjectileEvent

export interface ProjectileActionSpec {
  deliveryType: 'projectile'
  definitionId: ProjectileDefinitionId
  onHitEvents: ProjectileLifecycleEvent[]
  onExpireEvents: ProjectileLifecycleEvent[]
}

export interface DeployActionSpec {
  deliveryType: 'deploy'
  deployableId: DeployableDefinitionId
  durationMs: number
  maxPlacedCount?: number
  inheritsOwnerProjectile?: boolean
  inheritedDamageScale?: number
  inheritedPerActivePenalty?: number
  attackIntervalMs?: number
  targetingRange?: number
}

export interface SummonActionSpec {
  deliveryType: 'summon'
  summonUnitId: SummonDefinitionId
  durationMs: number
  maxSummonCount?: number
  inheritsOwnerProjectile?: boolean
  inheritedDamageScale?: number
  inheritedPerActivePenalty?: number
}

export type ActionSpec =
  | ProjectileActionSpec
  | DeployActionSpec
  | SummonActionSpec

export function isProjectileActionSpec(actionSpec: ActionSpec): actionSpec is ProjectileActionSpec {
  return actionSpec.deliveryType === 'projectile'
}

export function isDeployActionSpec(actionSpec: ActionSpec): actionSpec is DeployActionSpec {
  return actionSpec.deliveryType === 'deploy'
}

export function isSummonActionSpec(actionSpec: ActionSpec): actionSpec is SummonActionSpec {
  return actionSpec.deliveryType === 'summon'
}
