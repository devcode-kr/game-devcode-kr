import type { ProjectileAreaDamageEvent } from './ActionSpecs'

export interface ProjectileAreaDamageCandidate {
  targetId: string
  distanceFromCenter: number
}

export interface ProjectileAreaDamageResolvedHit {
  targetId: string
  damage: number
  distanceFromCenter: number
  damageScale: number
}

export function resolveProjectileAreaDamageHits(params: {
  event: ProjectileAreaDamageEvent
  candidates: ProjectileAreaDamageCandidate[]
}): ProjectileAreaDamageResolvedHit[] {
  const sortedCandidates = [...params.candidates].sort(
    (left, right) => left.distanceFromCenter - right.distanceFromCenter
  )
  const limitedCandidates = typeof params.event.maxTargets === 'number'
    ? sortedCandidates.slice(0, Math.max(0, params.event.maxTargets))
    : sortedCandidates

  return limitedCandidates
    .map(candidate => {
      const damageScale = resolveProjectileAreaDamageScale({
        event: params.event,
        distanceFromCenter: candidate.distanceFromCenter,
      })

      return {
        targetId: candidate.targetId,
        damage: Math.max(1, Math.round(params.event.amount * damageScale)),
        distanceFromCenter: candidate.distanceFromCenter,
        damageScale,
      }
    })
    .filter(hit => hit.damage > 0)
}

export function resolveProjectileAreaDamageScale(params: {
  event: ProjectileAreaDamageEvent
  distanceFromCenter: number
}): number {
  const radius = Math.max(0.0001, params.event.radius)
  const fullDamageRadius = Math.min(radius, Math.max(0, params.event.fullDamageRadius ?? 0))
  const minimumScale = PhaserMathClamp(params.event.minimumScale ?? 0, 0, 1)
  const falloff = params.event.falloff ?? 'none'

  if (falloff === 'none' || params.distanceFromCenter <= fullDamageRadius) {
    return 1
  }

  const effectiveDistance = Math.min(radius, Math.max(fullDamageRadius, params.distanceFromCenter))
  const range = Math.max(0.0001, radius - fullDamageRadius)
  const normalized = PhaserMathClamp((effectiveDistance - fullDamageRadius) / range, 0, 1)
  const baseScale = falloff === 'smoothstep'
    ? 1 - (normalized * normalized * (3 - (2 * normalized)))
    : 1 - normalized

  return minimumScale + ((1 - minimumScale) * PhaserMathClamp(baseScale, 0, 1))
}

function PhaserMathClamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
