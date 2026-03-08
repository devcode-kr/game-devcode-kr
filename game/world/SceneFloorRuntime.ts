import type Phaser from 'phaser'
import { generateFloorState } from './FloorFlow'
import type { Interactable, Trap } from './WorldObjects'
import type { BSPDungeon } from '../map/BSPDungeon'
import {
  markEnteredDungeon,
  markReachedFloor,
} from '../progress/ProgressionRules'
import type { AchievementState, JourneyLog } from '../progress/ProgressStore'

export interface SceneFloorRuntimeState {
  dungeon: BSPDungeon
  spawnTile: { x: number; y: number }
  interactables: Interactable[]
  traps: Trap[]
  floorIndex: number
}

export interface SceneFloorRuntimeCallbacks {
  resetWorldForFloor: (monsterSpawns: ReturnType<typeof generateFloorState>['monsterSpawns']) => void
  setPlayerPosition: (x: number, y: number) => void
  refreshVisibility: () => void
  saveProgress: () => void
  applyUnlockedAchievements: (labels: string[]) => void
  setInteractionStatus: (status: string) => void
}

export class SceneFloorRuntime {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: SceneFloorRuntimeCallbacks
  ) {}

  generateFloor(params: {
    state: SceneFloorRuntimeState
    resetFloorIndex: boolean
    journeyLog: JourneyLog
    achievements: AchievementState
    trapRearmMs: number
    width: number
    height: number
  }): SceneFloorRuntimeState {
    const floor = generateFloorState({
      scene: this.scene,
      previousInteractables: params.state.interactables,
      previousTraps: params.state.traps,
      trapRearmMs: params.trapRearmMs,
      width: params.width,
      height: params.height,
    })

    this.callbacks.resetWorldForFloor(floor.monsterSpawns)
    this.callbacks.setPlayerPosition(floor.spawnPosition.x, floor.spawnPosition.y)
    this.callbacks.refreshVisibility()

    if (params.resetFloorIndex) {
      if (params.state.floorIndex <= 1) {
        params.state.floorIndex = 1
        markEnteredDungeon(params.journeyLog, params.achievements)
      }

      this.callbacks.saveProgress()
      this.callbacks.setInteractionStatus(`entered floor ${params.state.floorIndex}`)
      return {
        ...params.state,
        dungeon: floor.dungeon,
        spawnTile: floor.spawnTile,
        interactables: floor.interactables,
        traps: floor.traps,
      }
    }

    const nextFloorIndex = params.state.floorIndex + 1
    this.callbacks.applyUnlockedAchievements(
      markReachedFloor(params.journeyLog, params.achievements, nextFloorIndex)
    )
    this.callbacks.saveProgress()
    this.callbacks.setInteractionStatus(`entered floor ${nextFloorIndex}`)

    return {
      dungeon: floor.dungeon,
      spawnTile: floor.spawnTile,
      interactables: floor.interactables,
      traps: floor.traps,
      floorIndex: nextFloorIndex,
    }
  }
}
