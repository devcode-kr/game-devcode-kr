import type { CharacterStatModifier } from '../characters/CharacterStatRules'

export interface EffectDebuffRuntime {
  id: string
  displayName: string
  expiresAt: number
  statModifiers?: CharacterStatModifier
  damagePerSecond?: number
  damageRemainder: number
  blocksHealthRegen?: boolean
  guardMitigatesDamage?: boolean
}

export interface EffectDebuffSnapshot {
  id: string
  displayName: string
  remainingMs: number
  statModifiers?: CharacterStatModifier
  damagePerSecond?: number
  damageRemainder?: number
  blocksHealthRegen?: boolean
  guardMitigatesDamage?: boolean
}

export function pruneExpiredEffectDebuffs(
  debuffs: EffectDebuffRuntime[],
  nowMs: number
): EffectDebuffRuntime[] {
  return debuffs.filter(debuff => debuff.expiresAt > nowMs)
}

export function serializeEffectDebuffs(
  debuffs: EffectDebuffRuntime[],
  nowMs: number
): EffectDebuffSnapshot[] {
  return debuffs
    .filter(debuff => debuff.expiresAt > nowMs)
    .map(debuff => ({
      id: debuff.id,
      displayName: debuff.displayName,
      remainingMs: debuff.expiresAt - nowMs,
      statModifiers: debuff.statModifiers,
      damagePerSecond: debuff.damagePerSecond,
      damageRemainder: debuff.damageRemainder,
      blocksHealthRegen: debuff.blocksHealthRegen,
      guardMitigatesDamage: debuff.guardMitigatesDamage,
    }))
}

export function restoreEffectDebuffs(
  snapshots: EffectDebuffSnapshot[],
  nowMs: number
): EffectDebuffRuntime[] {
  return snapshots
    .filter(snapshot => snapshot.remainingMs > 0)
    .map(snapshot => ({
      id: snapshot.id,
      displayName: snapshot.displayName,
      expiresAt: nowMs + snapshot.remainingMs,
      statModifiers: snapshot.statModifiers,
      damagePerSecond: snapshot.damagePerSecond,
      damageRemainder: snapshot.damageRemainder ?? 0,
      blocksHealthRegen: snapshot.blocksHealthRegen,
      guardMitigatesDamage: snapshot.guardMitigatesDamage,
    }))
}

export function upsertEffectDebuff(params: {
  debuffs: EffectDebuffRuntime[]
  id: string
  displayName: string
  durationMs: number
  nowMs: number
  statModifiers?: CharacterStatModifier
  damagePerSecond?: number
  blocksHealthRegen?: boolean
  guardMitigatesDamage?: boolean
}): EffectDebuffRuntime[] {
  const existing = params.debuffs.find(debuff => (
    debuff.expiresAt > params.nowMs &&
    debuff.id === params.id
  ))
  const nextDebuffs = params.debuffs.filter(debuff => (
    debuff.expiresAt > params.nowMs &&
    debuff.id !== params.id
  ))

  nextDebuffs.push({
    id: params.id,
    displayName: params.displayName,
    expiresAt: Math.max(existing?.expiresAt ?? params.nowMs, params.nowMs) + params.durationMs,
    statModifiers: mergeStatModifiers(existing?.statModifiers, params.statModifiers),
    damagePerSecond: selectStrongerValue(existing?.damagePerSecond, params.damagePerSecond),
    damageRemainder: existing?.damageRemainder ?? 0,
    blocksHealthRegen: Boolean(existing?.blocksHealthRegen || params.blocksHealthRegen),
    guardMitigatesDamage: Boolean(existing?.guardMitigatesDamage || params.guardMitigatesDamage),
  })

  return nextDebuffs
}

export function clearEffectDebuffById(
  debuffs: EffectDebuffRuntime[],
  id: string,
  nowMs: number
): EffectDebuffRuntime[] {
  return debuffs.filter(debuff => debuff.expiresAt > nowMs && debuff.id !== id)
}

function mergeStatModifiers(
  existing: CharacterStatModifier | undefined,
  incoming: CharacterStatModifier | undefined
): CharacterStatModifier | undefined {
  if (!existing && !incoming) {
    return undefined
  }

  const merged: CharacterStatModifier = { ...(existing ?? {}) }
  for (const [key, value] of Object.entries(incoming ?? {})) {
    const previous = merged[key as keyof CharacterStatModifier]
    merged[key as keyof CharacterStatModifier] = selectStrongerValue(
      typeof previous === 'number' ? previous : undefined,
      value
    ) as never
  }

  return merged
}

function selectStrongerValue(
  existing: number | undefined,
  incoming: number | undefined
): number | undefined {
  if (typeof existing !== 'number') {
    return incoming
  }
  if (typeof incoming !== 'number') {
    return existing
  }

  return Math.abs(existing) > Math.abs(incoming) ? existing : incoming
}
