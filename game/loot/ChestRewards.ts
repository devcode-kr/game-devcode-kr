import * as Phaser from 'phaser'
import type { ChestReward } from '../world/WorldObjects'

export function rollChestReward(): ChestReward {
  const roll = Math.random()
  if (roll < 0.55) {
    return {
      kind: 'gold',
      amount: Phaser.Math.Between(8, 22),
    }
  }

  if (roll < 0.85) {
    return {
      kind: 'potion',
      amount: 1,
    }
  }

  return {
    kind: 'key',
    amount: 1,
  }
}

export function getChestRewardItemDefinitionId(reward: ChestReward): string | null {
  if (reward.kind === 'potion') {
    return 'potion_minor'
  }

  if (reward.kind === 'key') {
    return 'utility_key'
  }

  return null
}
