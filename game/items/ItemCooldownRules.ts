import type { ItemCooldownGroup } from './ItemCatalog'

export interface ItemCooldownRuntime {
  group: ItemCooldownGroup
  expiresAt: number
}

export interface ItemCooldownSnapshot {
  group: ItemCooldownGroup
  remainingMs: number
}

export function isItemCooldownActive(
  cooldowns: ItemCooldownRuntime[],
  group: ItemCooldownGroup,
  now: number
): boolean {
  return cooldowns.some(cooldown => cooldown.group === group && cooldown.expiresAt > now)
}

export function getItemCooldownRemainingMs(
  cooldowns: ItemCooldownRuntime[],
  group: ItemCooldownGroup,
  now: number
): number {
  const active = cooldowns.find(cooldown => cooldown.group === group && cooldown.expiresAt > now)
  return active ? active.expiresAt - now : 0
}

export function setItemCooldown(
  cooldowns: ItemCooldownRuntime[],
  group: ItemCooldownGroup,
  durationMs: number,
  now: number
): ItemCooldownRuntime[] {
  const next = cooldowns.filter(cooldown => cooldown.group !== group || cooldown.expiresAt <= now)
  next.push({
    group,
    expiresAt: now + durationMs,
  })
  return next
}

export function pruneExpiredItemCooldowns(
  cooldowns: ItemCooldownRuntime[],
  now: number
): ItemCooldownRuntime[] {
  return cooldowns.filter(cooldown => cooldown.expiresAt > now)
}

export function serializeItemCooldowns(
  cooldowns: ItemCooldownRuntime[],
  now: number
): ItemCooldownSnapshot[] {
  return cooldowns
    .filter(cooldown => cooldown.expiresAt > now)
    .map(cooldown => ({
      group: cooldown.group,
      remainingMs: cooldown.expiresAt - now,
    }))
}

export function restoreItemCooldowns(
  snapshots: ItemCooldownSnapshot[],
  now: number
): ItemCooldownRuntime[] {
  return snapshots
    .filter(snapshot => snapshot.remainingMs > 0)
    .map(snapshot => ({
      group: snapshot.group,
      expiresAt: now + snapshot.remainingMs,
    }))
}
