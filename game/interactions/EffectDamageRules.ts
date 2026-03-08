export interface DamageTickResult {
  nextValue: number
  remainder: number
  appliedDamage: number
}

export function tickDamageOverTime(params: {
  currentValue: number
  damagePerSecond: number
  deltaMs: number
  remainder: number
}): DamageTickResult {
  if (params.currentValue <= 0 || params.damagePerSecond <= 0 || params.deltaMs <= 0) {
    return {
      nextValue: params.currentValue,
      remainder: params.remainder,
      appliedDamage: 0,
    }
  }

  const totalDamage = params.remainder + (params.damagePerSecond * params.deltaMs) / 1000
  const wholeDamage = Math.floor(totalDamage)
  if (wholeDamage <= 0) {
    return {
      nextValue: params.currentValue,
      remainder: totalDamage,
      appliedDamage: 0,
    }
  }

  const nextValue = Math.max(0, params.currentValue - wholeDamage)
  const appliedDamage = params.currentValue - nextValue

  return {
    nextValue,
    remainder: totalDamage - appliedDamage,
    appliedDamage,
  }
}
