import type { EffectRuntimeSceneState } from './EffectRuntimeSceneBridge'
import {
  applyTrapRuntimeEffects,
  clearEffectRuntimeDebuffs,
} from './EffectRuntimeMutations'
import {
  applyDebugDamage,
  getRespawnHealth,
  getRespawnPosition,
  triggerTrap,
} from './SurvivalRules'
import type { Trap } from '../world/WorldObjects'

export interface TrapResolution {
  triggered: boolean
  health: number
  poisoned: boolean
  status: string
}

export function resolveTrapSurvival(params: {
  trap: Trap | undefined
  nowMs: number
  trapRearmMs: number
  trapDamageAmount: number
  poisonDamagePerSecond: number
  health: number
  poisoned: boolean
  guardActive: boolean
  effectRuntimeSceneState: EffectRuntimeSceneState
}): TrapResolution {
  const result = triggerTrap({
    trap: params.trap,
    now: params.nowMs,
    trapRearmMs: params.trapRearmMs,
    trapDamageAmount: params.trapDamageAmount,
    health: params.health,
    poisoned: params.poisoned,
    guardActive: params.guardActive,
  })
  if (!result.triggered) {
    return {
      triggered: false,
      health: params.health,
      poisoned: params.poisoned,
      status: '',
    }
  }

  applyTrapRuntimeEffects({
    sceneState: params.effectRuntimeSceneState,
    nowMs: params.nowMs,
    poisonedDurationMs: result.poisonedDurationMs,
    poisonDamagePerSecond: params.poisonDamagePerSecond,
    slowDurationMs: result.slowDurationMs,
    slowStatModifiers: result.slowStatModifiers,
  })

  return {
    triggered: true,
    health: result.health,
    poisoned: result.poisoned,
    status: result.status,
  }
}

export function resolveDebugDamageSurvival(health: number, damageAmount: number): {
  health: number
  status: string
} {
  return applyDebugDamage(health, damageAmount)
}

export function resolveRespawnSurvival(params: {
  spawnTile: { x: number; y: number }
  maxHealth: number
  respawnHealthRatio: number
  floorIndex: number
  effectRuntimeSceneState: EffectRuntimeSceneState
}): {
  spawn: { x: number; y: number }
  health: number
  poisoned: boolean
  guardBuffRemainingMs: number
  status: string
} {
  clearEffectRuntimeDebuffs(params.effectRuntimeSceneState)

  return {
    spawn: getRespawnPosition(params.spawnTile),
    health: getRespawnHealth(params.maxHealth, params.respawnHealthRatio),
    poisoned: false,
    guardBuffRemainingMs: 0,
    status: `respawned on floor ${params.floorIndex}`,
  }
}
