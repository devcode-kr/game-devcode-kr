import { resolveNpcDialogue, type DialogueScript } from '../npc/NpcDialogue'
import type { AchievementState, JourneyLog } from '../progress/ProgressStore'
import { markNpcDialogueStarted } from '../progress/ProgressionRules'
import type { Interactable } from '../world/WorldObjects'

export interface ActiveDialogue {
  interactableId: string
  script: DialogueScript
  lineIndex: number
}

export function startNpcDialogue(
  interactable: Interactable,
  journeyLog: JourneyLog,
  achievements: AchievementState
): {
  dialogue: ActiveDialogue | null
  status: string
  unlocked: string[]
} {
  const profile = interactable.npcProfile
  if (!profile) {
    return {
      dialogue: null,
      status: 'npc has nothing to say',
      unlocked: [],
    }
  }

  const dialogue = resolveNpcDialogue(profile, {
    journeyLog,
    achievements,
  })
  if (!dialogue) {
    return {
      dialogue: null,
      status: 'npc has nothing to say',
      unlocked: [],
    }
  }

  return {
    dialogue: {
      interactableId: interactable.id,
      script: dialogue,
      lineIndex: 0,
    },
    status: `talking to ${dialogue.speaker}`,
    unlocked: markNpcDialogueStarted(journeyLog, achievements, dialogue.speaker),
  }
}

export function advanceDialogue(activeDialogue: ActiveDialogue): {
  dialogue: ActiveDialogue | null
  status: string
} {
  const nextIndex = activeDialogue.lineIndex + 1
  if (nextIndex >= activeDialogue.script.lines.length) {
    return {
      dialogue: null,
      status: `finished talking to ${activeDialogue.script.speaker}`,
    }
  }

  return {
    dialogue: {
      ...activeDialogue,
      lineIndex: nextIndex,
    },
    status: '',
  }
}

export function getDialoguePanelState(activeDialogue: ActiveDialogue | null): { speaker: string; line: string } | null {
  if (!activeDialogue) {
    return null
  }

  return {
    speaker: activeDialogue.script.speaker,
    line: activeDialogue.script.lines[activeDialogue.lineIndex] ?? '',
  }
}
