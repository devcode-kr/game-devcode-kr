import type { CharacterStatModifier } from '../characters/CharacterStatModifier'

export interface TimedModifierRuntime {
  id: string
  expiresAt: number
  modifiers: CharacterStatModifier
}

export interface TimedModifierSnapshot {
  id: string
  remainingMs: number
  modifiers: CharacterStatModifier
}

export function pruneExpiredTimedModifiers(
  modifiers: TimedModifierRuntime[],
  now: number
): TimedModifierRuntime[] {
  return modifiers.filter(modifier => modifier.expiresAt > now)
}

export function serializeTimedModifiers(
  modifiers: TimedModifierRuntime[],
  now: number
): TimedModifierSnapshot[] {
  return modifiers
    .filter(modifier => modifier.expiresAt > now)
    .map(modifier => ({
      id: modifier.id,
      remainingMs: modifier.expiresAt - now,
      modifiers: modifier.modifiers,
    }))
}

export function restoreTimedModifiers(
  snapshots: TimedModifierSnapshot[],
  now: number
): TimedModifierRuntime[] {
  return snapshots
    .filter(snapshot => snapshot.remainingMs > 0)
    .map(snapshot => ({
      id: snapshot.id,
      expiresAt: now + snapshot.remainingMs,
      modifiers: snapshot.modifiers,
    }))
}

export function upsertTimedModifier(params: {
  modifiers: TimedModifierRuntime[]
  id: string
  durationMs: number
  now: number
  statModifiers: CharacterStatModifier
}): TimedModifierRuntime[] {
  const next = params.modifiers.filter(modifier => (
    modifier.expiresAt > params.now &&
    modifier.id !== params.id
  ))

  next.push({
    id: params.id,
    expiresAt: params.now + params.durationMs,
    modifiers: params.statModifiers,
  })

  return next
}
