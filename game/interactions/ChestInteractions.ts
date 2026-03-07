import { getItemDefinition } from '../items/ItemCatalog'
import { addInventoryItemBatch, getInventoryItemCount } from '../items/InventoryUtils'
import { getChestRewardItemDefinitionId } from '../loot/ChestRewards'
import type { AchievementState, JourneyLog } from '../progress/ProgressStore'
import { markChestOpened, markKeyCollected, markLockedChestOpened } from '../progress/ProgressionRules'
import type { InventoryState } from '../items/Inventory'
import type { ChestReward, Interactable } from '../world/WorldObjects'

export interface ChestOpenResult {
  status: string
  goldDelta: number
  unlocked: string[]
}

export function canOpenLockedChest(inventory: InventoryState): boolean {
  return getInventoryItemCount(inventory, 'utility_key') > 0
}

export function openChest(params: {
  interactable: Interactable
  inventory: InventoryState
  journeyLog: JourneyLog
  achievements: AchievementState
  consumeKey: () => void
}): ChestOpenResult {
  const { interactable, inventory, journeyLog, achievements, consumeKey } = params

  if (interactable.used) {
    return {
      status: 'chest already opened',
      goldDelta: 0,
      unlocked: [],
    }
  }

  if (interactable.kind === 'locked-chest' && !canOpenLockedChest(inventory)) {
    return {
      status: 'locked chest: need key',
      goldDelta: 0,
      unlocked: [],
    }
  }

  const unlocked: string[] = []
  if (interactable.kind === 'locked-chest') {
    consumeKey()
    unlocked.push(...markLockedChestOpened(journeyLog, achievements))
  }

  interactable.used = true
  unlocked.push(...markChestOpened(achievements))

  const rewardResult = applyChestReward(interactable.reward, inventory, journeyLog, achievements, interactable.kind === 'locked-chest')
  unlocked.push(...rewardResult.unlocked)

  return {
    status: rewardResult.status,
    goldDelta: rewardResult.goldDelta,
    unlocked,
  }
}

function applyChestReward(
  reward: ChestReward | undefined,
  inventory: InventoryState,
  journeyLog: JourneyLog,
  achievements: AchievementState,
  wasLocked: boolean
): ChestOpenResult {
  if (!reward) {
    return {
      status: wasLocked ? 'unlocked chest: empty' : 'opened empty chest',
      goldDelta: 0,
      unlocked: [],
    }
  }

  if (reward.kind === 'gold') {
    return {
      status: `${wasLocked ? 'unlocked chest' : 'opened chest'}: +${reward.amount} gold`,
      goldDelta: reward.amount,
      unlocked: [],
    }
  }

  const itemDefinitionId = getChestRewardItemDefinitionId(reward)
  if (!itemDefinitionId) {
    return {
      status: wasLocked ? 'unlocked chest: empty' : 'opened empty chest',
      goldDelta: 0,
      unlocked: [],
    }
  }

  const addedCount = addInventoryItemBatch(inventory, itemDefinitionId, reward.amount)
  const itemName = getItemDefinition(itemDefinitionId).name
  const unlocked = reward.kind === 'key'
    ? markKeyCollected(journeyLog, achievements, addedCount)
    : []

  if (addedCount === 0) {
    return {
      status: `inventory full: could not store ${itemName}`,
      goldDelta: 0,
      unlocked,
    }
  }

  const storedSuffix = addedCount < reward.amount ? ` (${addedCount}/${reward.amount} stored)` : ''
  return {
    status: `${wasLocked ? 'unlocked chest' : 'opened chest'}: +${addedCount} ${itemName}${storedSuffix}`,
    goldDelta: 0,
    unlocked,
  }
}
