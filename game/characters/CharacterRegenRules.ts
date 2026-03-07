export interface CharacterRegenTickResult {
  nextValue: number
  remainder: number
}

export function tickRegeneration(params: {
  currentValue: number
  maxValue: number
  regenPerSecond: number
  deltaMs: number
  remainder: number
}): CharacterRegenTickResult {
  if (params.currentValue >= params.maxValue || params.regenPerSecond <= 0 || params.deltaMs <= 0) {
    return {
      nextValue: params.currentValue,
      remainder: params.remainder,
    }
  }

  const totalRegen = params.remainder + (params.regenPerSecond * params.deltaMs) / 1000
  const wholeRegen = Math.floor(totalRegen)
  if (wholeRegen <= 0) {
    return {
      nextValue: params.currentValue,
      remainder: totalRegen,
    }
  }

  const nextValue = Math.min(params.maxValue, params.currentValue + wholeRegen)
  const appliedRegen = nextValue - params.currentValue

  return {
    nextValue,
    remainder: totalRegen - appliedRegen,
  }
}
