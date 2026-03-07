import type { AchievementState, JourneyLog } from './ProgressStore'

export function markEnteredDungeon(journeyLog: JourneyLog, achievements: AchievementState): void {
  journeyLog.steps.enteredDungeon = true
  journeyLog.currentChapter = 'Entered the dungeon'
  achievements.counters.floorsReached = 1
}

export function markReachedFloor(
  journeyLog: JourneyLog,
  achievements: AchievementState,
  floorIndex: number
): string[] {
  journeyLog.steps.reachedNextFloor = true
  journeyLog.currentChapter = `Reached floor ${floorIndex}`
  achievements.counters.floorsReached = Math.max(achievements.counters.floorsReached, floorIndex)

  const unlocked: string[] = []
  unlockAchievement(achievements, achievements.counters.floorsReached >= 2, 'First Descent', unlocked)
  return unlocked
}

export function markNpcDialogueStarted(
  journeyLog: JourneyLog,
  achievements: AchievementState,
  speaker: string
): string[] {
  journeyLog.steps.talkedToNpc = true
  journeyLog.currentChapter = `Spoke with ${speaker}`
  achievements.counters.npcTalks += 1

  const unlocked: string[] = []
  unlockAchievement(achievements, achievements.counters.npcTalks >= 1, 'First Conversation', unlocked)
  return unlocked
}

export function markChestOpened(achievements: AchievementState): string[] {
  achievements.counters.chestsOpened += 1

  const unlocked: string[] = []
  unlockAchievement(achievements, achievements.counters.chestsOpened >= 1, 'First Loot', unlocked)
  unlockAchievement(achievements, achievements.counters.chestsOpened >= 3, 'Treasure Hunter', unlocked)
  return unlocked
}

export function markLockedChestOpened(
  journeyLog: JourneyLog,
  achievements: AchievementState
): string[] {
  journeyLog.steps.openedLockedChest = true
  journeyLog.currentChapter = 'Opened a locked chest'
  achievements.counters.lockedChestsOpened += 1

  const unlocked: string[] = []
  unlockAchievement(achievements, achievements.counters.lockedChestsOpened >= 1, 'Lockbreaker', unlocked)
  return unlocked
}

export function markKeyCollected(
  journeyLog: JourneyLog,
  achievements: AchievementState,
  addedCount: number
): string[] {
  if (addedCount <= 0) {
    return []
  }

  journeyLog.steps.foundKey = true
  journeyLog.currentChapter = 'Found a key'
  achievements.counters.keysCollected += addedCount

  const unlocked: string[] = []
  unlockAchievement(achievements, achievements.counters.keysCollected >= 1, 'Key Bearer', unlocked)
  return unlocked
}

function unlockAchievement(
  achievements: AchievementState,
  condition: boolean,
  label: string,
  unlocked: string[]
): void {
  if (!condition || achievements.unlocked.includes(label)) {
    return
  }

  achievements.unlocked.push(label)
  unlocked.push(label)
}
