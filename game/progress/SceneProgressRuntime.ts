import { applyGameSceneProgressSnapshot, createGameSceneProgressSnapshot } from './GameSceneProgress'
import type { ProgressSnapshot, ProgressStore, AchievementState, JourneyLog } from './ProgressStore'
import type { PlayerCharacter } from '../characters/PlayerCharacter'
import { restoreEffectRuntimeCollections } from '../interactions/EffectRuntimeMutations'
import type { EffectRuntimeSceneState } from '../interactions/EffectRuntimeSceneBridge'
import { restoreEffectDebuffs, serializeEffectDebuffs } from '../interactions/EffectDebuffRules'
import { restoreItemCooldowns, serializeItemCooldowns } from '../items/ItemCooldownRules'
import { restoreActiveItemBuffs, serializeActiveItemBuffs } from '../items/ItemStatRules'

export interface SceneProgressRuntimeState {
  floorIndex: number
  gold: number
  journeyLog: JourneyLog
  achievements: AchievementState
}

export interface SceneProgressRuntimeCallbacks {
  getNowMs: () => number
  getEffectNowMs: () => number
  getDefaultHealth: () => number
  getDefaultMana: () => number
  syncPlayerState: () => void
}

export class SceneProgressRuntime {
  constructor(
    private readonly progressStore: ProgressStore,
    private readonly playerCharacter: PlayerCharacter,
    private readonly effectRuntimeSceneState: EffectRuntimeSceneState,
    private readonly callbacks: SceneProgressRuntimeCallbacks
  ) {}

  load(): ProgressSnapshot | null {
    return this.progressStore.load()
  }

  save(state: SceneProgressRuntimeState): void {
    this.progressStore.save(this.createSnapshot(state))
  }

  createSnapshot(state: SceneProgressRuntimeState): ProgressSnapshot {
    return createGameSceneProgressSnapshot({
      floorIndex: state.floorIndex,
      gold: state.gold,
      jobId: this.playerCharacter.getJobId(),
      health: this.playerCharacter.getHealth(),
      maxHealth: this.playerCharacter.getMaxHealth(),
      mana: this.playerCharacter.getMana(),
      maxMana: this.playerCharacter.getMaxMana(),
      poisoned: this.playerCharacter.isPoisoned(),
      guardBuffRemainingMs: this.playerCharacter.getGuardBuffRemainingMs(this.callbacks.getEffectNowMs()),
      effectRuntimeSceneState: this.effectRuntimeSceneState,
      inventory: this.playerCharacter.getInventory(),
      beltInventory: this.playerCharacter.getBeltInventory(),
      journeyLog: state.journeyLog,
      achievements: state.achievements,
      serialize: {
        activeItemBuffs: serializeActiveItemBuffs,
        itemCooldowns: serializeItemCooldowns,
        activeDebuffs: serializeEffectDebuffs,
      },
    })
  }

  applySnapshot(params: {
    snapshot: ProgressSnapshot
    state: SceneProgressRuntimeState
    inventoryCols: number
    inventoryRows: number
    beltCols: number
    beltRows: number
  }): SceneProgressRuntimeState {
    const loaded = applyGameSceneProgressSnapshot({
      snapshot: params.snapshot,
      defaultHealth: this.callbacks.getDefaultHealth(),
      defaultMana: this.callbacks.getDefaultMana(),
      inventoryCols: params.inventoryCols,
      inventoryRows: params.inventoryRows,
      beltCols: params.beltCols,
      beltRows: params.beltRows,
      nowMs: this.callbacks.getNowMs(),
      restore: {
        activeItemBuffs: restoreActiveItemBuffs,
        itemCooldowns: restoreItemCooldowns,
        activeDebuffs: restoreEffectDebuffs,
      },
    })

    restoreEffectRuntimeCollections({
      sceneState: this.effectRuntimeSceneState,
      nowMs: this.callbacks.getNowMs(),
      restoreActiveItemBuffs: () => loaded.effectRuntime.activeItemBuffs,
      restoreItemCooldowns: () => loaded.effectRuntime.itemCooldowns,
      restoreActiveDebuffs: () => loaded.effectRuntime.activeDebuffs,
    })
    this.playerCharacter.applyRuntimeSnapshot({
      jobId: loaded.jobId,
      health: loaded.health,
      mana: loaded.mana,
      poisoned: loaded.poisoned,
      guardBuffRemainingMs: loaded.guardBuffRemainingMs,
    }, this.callbacks.getNowMs())
    this.playerCharacter.setInventoryStates(loaded.inventory, loaded.beltInventory)
    this.callbacks.syncPlayerState()

    return {
      ...params.state,
      floorIndex: loaded.floorIndex,
      gold: loaded.gold,
      journeyLog: loaded.journeyLog,
      achievements: loaded.achievements,
    }
  }
}
