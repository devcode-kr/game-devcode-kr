import {
  buildAutomaticEquipmentLoadout,
  getEquipmentStatBonuses,
  isCharacterEquipmentLoadoutEmpty,
  reconcileCharacterEquipmentLoadout,
} from '../items/CharacterEquipmentLoadout'
import { getActiveItemBuffStatBonuses } from '../items/ItemStatRules'
import { runInventoryItemUseFlow } from '../interactions/InventoryItemUseFlow'
import { EffectRuntimeClient } from '../interactions/EffectRuntimeClient'
import type { EffectRuntimeState } from '../interactions/EffectRuntimeProtocol'
import {
  applyEffectRuntimeWorkerState,
  areEffectRuntimeStatesEqual,
  buildEffectRuntimeState,
  getActiveDebuffStatModifiers,
  type EffectRuntimeSceneState,
} from '../interactions/EffectRuntimeSceneBridge'
import { CharacterController } from './CharacterController'
import { PlayerCharacter } from './PlayerCharacter'

export class PlayerStateRuntime {
  private effectRuntimeClient: EffectRuntimeClient | null = null
  private latestEffectRuntimeRevision = 0
  private latestEffectRuntimeSyncRevision = 0

  constructor(
    private readonly playerCharacter: PlayerCharacter,
    private readonly playerController: CharacterController,
    private readonly effectRuntimeSceneState: EffectRuntimeSceneState
  ) {}

  destroy(): void {
    this.effectRuntimeClient?.destroy()
    this.effectRuntimeClient = null
  }

  advanceEffectRuntime(deltaMs: number): void {
    if (!this.effectRuntimeClient) {
      this.effectRuntimeSceneState.nowMs += deltaMs
      return
    }

    this.effectRuntimeClient.advance(deltaMs)
  }

  useInventoryItem(itemDefinitionId: string): { used: boolean; status: string } {
    const effectNowMs = this.getEffectRuntimeNowMs()
    const result = runInventoryItemUseFlow({
      beltInventory: this.playerCharacter.getBeltInventory(),
      inventory: this.playerCharacter.getInventory(),
      itemDefinitionId,
      health: this.playerCharacter.getHealth(),
      maxHealth: this.playerCharacter.getMaxHealth(),
      mana: this.playerCharacter.getMana(),
      maxMana: this.playerCharacter.getMaxMana(),
      poisoned: this.playerCharacter.isPoisoned(),
      effectNowMs,
      effectRuntimeSceneState: this.effectRuntimeSceneState,
    })

    this.playerCharacter.setHealth(result.health)
    this.playerCharacter.setMana(result.mana)
    this.playerCharacter.setPoisoned(result.poisoned)
    this.playerCharacter.extendGuardBuff(result.guardDurationMs, effectNowMs)
    this.refreshCharacterStatSources(effectNowMs)
    if (result.used) {
      this.syncEffectRuntimeState()
    }

    return {
      used: result.used,
      status: result.status,
    }
  }

  refreshCharacterStatSources(nowMs: number): void {
    const currentLoadout = reconcileCharacterEquipmentLoadout(
      this.playerCharacter.getInventory(),
      this.playerCharacter.getEquipmentLoadout()
    )
    this.playerCharacter.setEquipmentLoadout(
      isCharacterEquipmentLoadoutEmpty(currentLoadout)
        ? buildAutomaticEquipmentLoadout(this.playerCharacter.getInventory())
        : currentLoadout
    )
    this.playerCharacter.setEquipmentBonuses(
      getEquipmentStatBonuses(this.playerCharacter.getInventory(), this.playerCharacter.getEquipmentLoadout())
    )
    this.playerCharacter.setPotionBonuses(
      getActiveItemBuffStatBonuses(this.effectRuntimeSceneState.activeItemBuffs, nowMs)
    )
    this.playerCharacter.setTemporaryBonuses(getActiveDebuffStatModifiers(this.effectRuntimeSceneState))
    this.playerCharacter.setActiveItemBuffs(this.effectRuntimeSceneState.activeItemBuffs)
    this.playerCharacter.setActiveDebuffs(this.effectRuntimeSceneState.activeDebuffs)
    this.playerController.syncMoveSpeedFromCharacter()
  }

  getEffectRuntimeNowMs(): number {
    return this.effectRuntimeSceneState.nowMs
  }

  initializeEffectRuntimeWorker(tickMs: number): void {
    this.effectRuntimeClient?.destroy()
    this.latestEffectRuntimeRevision = 0
    this.effectRuntimeClient = null
    this.latestEffectRuntimeSyncRevision = 0

    if (typeof Worker === 'undefined') {
      return
    }

    try {
      this.effectRuntimeClient = new EffectRuntimeClient({
        tickMs,
        initialState: this.buildCurrentEffectRuntimeState(),
        onState: (revision, state) => {
          this.handleEffectRuntimeState(revision, state)
        },
      })
      this.latestEffectRuntimeSyncRevision = this.effectRuntimeClient.getLatestRevision()
    } catch (error) {
      console.error('effect runtime worker init failed; falling back to local timing only', error)
      this.effectRuntimeClient = null
    }
  }

  syncEffectRuntimeState(): void {
    const revision = this.effectRuntimeClient?.syncState(this.buildCurrentEffectRuntimeState())
    if (revision) {
      this.latestEffectRuntimeSyncRevision = revision
    }
  }

  private handleEffectRuntimeState(revision: number, state: EffectRuntimeState): void {
    if (
      revision < this.latestEffectRuntimeRevision ||
      revision < this.latestEffectRuntimeSyncRevision
    ) {
      return
    }

    this.latestEffectRuntimeRevision = revision
    applyEffectRuntimeWorkerState(this.effectRuntimeSceneState, state)
    this.refreshCharacterStatSources(state.currentTimeMs)
    this.playerCharacter.setHealth(state.health)
    this.playerCharacter.setMana(state.mana)
    this.playerCharacter.setPoisoned(state.poisoned)
    this.playerCharacter.setGuardBuffRemainingMs(state.guardBuffRemainingMs, state.currentTimeMs)

    const reconciledState = this.buildCurrentEffectRuntimeState(state.currentTimeMs)
    if (!areEffectRuntimeStatesEqual(state, reconciledState)) {
      const nextRevision = this.effectRuntimeClient?.syncState(reconciledState)
      if (nextRevision) {
        this.latestEffectRuntimeSyncRevision = nextRevision
      }
    }
  }

  private buildCurrentEffectRuntimeState(nowMs = this.getEffectRuntimeNowMs()): EffectRuntimeState {
    return buildEffectRuntimeState({
      sceneState: this.effectRuntimeSceneState,
      health: this.playerCharacter.getHealth(),
      maxHealth: this.playerCharacter.getMaxHealth(),
      healthRegen: this.playerCharacter.getHealthRegen(),
      mana: this.playerCharacter.getMana(),
      maxMana: this.playerCharacter.getMaxMana(),
      manaRegen: this.playerCharacter.getManaRegen(),
      poisoned: this.playerCharacter.isPoisoned(),
      guardBuffRemainingMs: this.playerCharacter.getGuardBuffRemainingMs(nowMs),
    })
  }
}
