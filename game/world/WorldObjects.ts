import * as Phaser from 'phaser'
import type { DialogueScript, NpcProfile } from '../npc/NpcDialogue'

export type InteractableKind = 'chest' | 'locked-chest' | 'stairs' | 'npc'

export interface Interactable {
  id: string
  kind: InteractableKind
  tileX: number
  tileY: number
  image: Phaser.GameObjects.Image
  used: boolean
  reward?: ChestReward
  dialogue?: DialogueScript
  npcProfile?: NpcProfile
}

export type ChestRewardKind = 'gold' | 'potion' | 'key'

export interface ChestReward {
  kind: ChestRewardKind
  amount: number
}

export interface Trap {
  id: string
  tileX: number
  tileY: number
  image: Phaser.GameObjects.Image
  lastTriggeredAt: number
}
