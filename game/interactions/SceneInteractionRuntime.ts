import * as Phaser from 'phaser'
import {
  advanceDialogue,
  getDialoguePanelState,
  type ActiveDialogue,
} from './DialogueFlow'
import {
  getNearbyInteractionStatus,
  resolveSceneInteraction,
} from './SceneInteractionFlow'
import type { PlayerCharacter } from '../characters/PlayerCharacter'
import type { CharacterController } from '../characters/CharacterController'
import { removeSingleItemByDefinition } from '../items/Inventory'
import type { AchievementState, JourneyLog } from '../progress/ProgressStore'
import type { Interactable } from '../world/WorldObjects'

export interface SceneInteractionRuntimeCallbacks {
  isDead: () => boolean
  saveProgress: () => void
  syncPlayerState: () => void
  onAdvanceFloor: () => void
  onGoldDelta: (amount: number) => void
  setInteractionStatus: (status: string) => void
  applyUnlockedAchievements: (labels: string[]) => void
}

export class SceneInteractionRuntime {
  private activeDialogue: ActiveDialogue | null = null

  constructor(
    private readonly playerCharacter: PlayerCharacter,
    private readonly playerController: CharacterController,
    private readonly callbacks: SceneInteractionRuntimeCallbacks
  ) {}

  getActiveDialogue(): ActiveDialogue | null {
    return this.activeDialogue
  }

  setActiveDialogue(dialogue: ActiveDialogue | null): void {
    this.activeDialogue = dialogue
  }

  getDialoguePanelState() {
    return getDialoguePanelState(this.activeDialogue)
  }

  tryInteract(params: {
    interactKey: Phaser.Input.Keyboard.Key
    interactable: Interactable | null
    journeyLog: JourneyLog
    achievements: AchievementState
  }): void {
    if (this.callbacks.isDead()) {
      if (Phaser.Input.Keyboard.JustDown(params.interactKey)) {
        this.callbacks.setInteractionStatus('cannot interact while dead')
      }
      return
    }

    if (this.activeDialogue) {
      if (Phaser.Input.Keyboard.JustDown(params.interactKey)) {
        this.advanceDialogue()
      }
      return
    }

    if (!Phaser.Input.Keyboard.JustDown(params.interactKey)) {
      this.callbacks.setInteractionStatus(getNearbyInteractionStatus(params.interactable))
      return
    }

    const result = resolveSceneInteraction({
      interactable: params.interactable,
      inventories: [this.playerCharacter.getBeltInventory(), this.playerCharacter.getInventory()],
      journeyLog: params.journeyLog,
      achievements: params.achievements,
      consumeKey: () => {
        const removedFromBelt = removeSingleItemByDefinition(this.playerCharacter.getBeltInventory(), 'utility_key')
        if (!removedFromBelt) {
          removeSingleItemByDefinition(this.playerCharacter.getInventory(), 'utility_key')
        }
      },
    })

    if (result.kind === 'blocked') {
      this.callbacks.setInteractionStatus(result.status)
      return
    }

    if (result.kind === 'open-chest') {
      this.callbacks.onGoldDelta(result.goldDelta)
      this.callbacks.applyUnlockedAchievements(result.unlocked)
      this.callbacks.setInteractionStatus(result.status)
      this.callbacks.syncPlayerState()
      this.callbacks.saveProgress()
      return
    }

    if (result.kind === 'start-dialogue') {
      this.playerController.clearDestination()
      this.activeDialogue = result.dialogue
      this.callbacks.applyUnlockedAchievements(result.unlocked)
      this.callbacks.saveProgress()
      this.callbacks.setInteractionStatus(result.status)
      return
    }

    this.callbacks.onAdvanceFloor()
  }

  private advanceDialogue(): void {
    if (!this.activeDialogue) {
      return
    }

    const result = advanceDialogue(this.activeDialogue)
    this.activeDialogue = result.dialogue
    if (result.status) {
      this.callbacks.setInteractionStatus(result.status)
    }
  }
}
