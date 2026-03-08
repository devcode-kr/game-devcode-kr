import type { InventoryState } from '../items/Inventory'
import type { AchievementState, JourneyLog } from '../progress/ProgressStore'
import { openChest } from './ChestInteractions'
import { startNpcDialogue, type ActiveDialogue } from './DialogueFlow'
import type { Interactable } from '../world/WorldObjects'

export type SceneInteractionIntent =
  | {
      kind: 'idle'
      status: string
    }
  | {
      kind: 'blocked'
      status: string
    }
  | {
      kind: 'open-chest'
      status: string
      goldDelta: number
      unlocked: string[]
    }
  | {
      kind: 'start-dialogue'
      status: string
      dialogue: ActiveDialogue
      unlocked: string[]
    }
  | {
      kind: 'advance-floor'
    }

export function getNearbyInteractionStatus(interactable: Interactable | null): string {
  return interactable
    ? `press E: ${interactable.kind}${interactable.used ? ' (used)' : ''}`
    : 'none'
}

export function resolveSceneInteraction(params: {
  interactable: Interactable | null
  inventories: InventoryState[]
  journeyLog: JourneyLog
  achievements: AchievementState
  consumeKey: () => void
}): SceneInteractionIntent {
  const { interactable } = params

  if (!interactable) {
    return {
      kind: 'blocked',
      status: 'nothing to interact with',
    }
  }

  if (interactable.kind === 'chest' || interactable.kind === 'locked-chest') {
    const result = openChest({
      interactable,
      inventories: params.inventories,
      journeyLog: params.journeyLog,
      achievements: params.achievements,
      consumeKey: params.consumeKey,
    })

    return {
      kind: 'open-chest',
      status: result.status,
      goldDelta: result.goldDelta,
      unlocked: result.unlocked,
    }
  }

  if (interactable.kind === 'npc') {
    const result = startNpcDialogue(interactable, params.journeyLog, params.achievements)
    if (!result.dialogue) {
      return {
        kind: 'blocked',
        status: result.status,
      }
    }

    return {
      kind: 'start-dialogue',
      status: result.status,
      dialogue: result.dialogue,
      unlocked: result.unlocked,
    }
  }

  return {
    kind: 'advance-floor',
  }
}
