import type { AchievementState, JourneyLog } from '../progress/ProgressStore'

export interface DialogueScript {
  speaker: string
  lines: string[]
}

export interface NpcProfile {
  speaker: string
}

interface DialogueContext {
  journeyLog: JourneyLog
  achievements: AchievementState
}

export function resolveNpcDialogue(
  profile: NpcProfile,
  context: DialogueContext
): DialogueScript {
  const { journeyLog, achievements } = context
  const speaker = profile.speaker

  if (journeyLog.steps.reachedNextFloor) {
    return {
      speaker,
      lines: [
        'You made it deeper already.',
        'The path below will only get stranger from here.',
        'What matters now is what you choose to carry forward.',
      ],
    }
  }

  if (journeyLog.steps.openedLockedChest) {
    return {
      speaker,
      lines: [
        'So you opened the locked chest.',
        'Keys matter because they change which risks you can cash in.',
        'Remember that when the dungeon asks you to choose between speed and reward.',
      ],
    }
  }

  if (journeyLog.steps.foundKey || achievements.unlocked.includes('Key Bearer')) {
    return {
      speaker,
      lines: [
        'You found a key.',
        'That means the locked chest is no longer just decoration.',
        'Use it when you think the extra reward is worth the delay.',
      ],
    }
  }

  if (achievements.unlocked.includes('First Loot')) {
    return {
      speaker,
      lines: [
        'Good. You started searching the rooms.',
        'One chest gives supplies, another asks for a key.',
        'The dungeon rarely gives you everything at once.',
      ],
    }
  }

  if (achievements.counters.npcTalks > 0 || journeyLog.steps.talkedToNpc) {
    return {
      speaker,
      lines: [
        'We already spoke once.',
        'Search nearby, open what you can, and come back when your choices have changed something.',
      ],
    }
  }

  return {
    speaker,
    lines: [
      'You are still learning this place. Do not trust the shortest road.',
      'Open the chests if you want supplies. The locked one needs a key.',
      'When you are ready, take the stairs and keep moving downward.',
    ],
  }
}
