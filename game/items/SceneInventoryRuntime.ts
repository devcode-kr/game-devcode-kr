import type Phaser from 'phaser'
import { PlayerCharacter } from '../characters/PlayerCharacter'
import { EquipmentPanel } from '../ui/EquipmentPanel'
import { InventoryPanel } from '../ui/InventoryPanel'
import {
  assignItemToEquipmentTarget,
  clearEquipmentTarget,
  type EquipmentSlotTarget,
  getEquipmentTargetInstanceId,
} from './CharacterEquipmentLoadout'
import {
  getStackIdByItemInstanceId,
  getStackPrimaryItemInstanceId,
  moveInventoryStack,
  transferInventoryStack,
} from './Inventory'
import { addInventoryItems } from './InventoryUtils'
import { TEST_BELT_ITEM_DEFINITION_IDS, TEST_SHAPE_ITEM_DEFINITION_IDS } from './ItemCatalog'

export class SceneInventoryRuntime {
  constructor(
    private readonly playerCharacter: PlayerCharacter,
    private readonly inventoryPanel: InventoryPanel,
    private readonly equipmentPanel: EquipmentPanel,
    private readonly callbacks: {
      useInventoryItem: (itemDefinitionId: string) => void
      onInventoryChanged: () => void
      setInteractionStatus: (status: string) => void
    }
  ) {}

  isOpen(): boolean {
    return this.inventoryPanel.isOpen()
  }

  toggle(): void {
    this.inventoryPanel.toggle()
  }

  render(viewportWidth: number, pointer: { x: number; y: number }): void {
    this.inventoryPanel.render(
      viewportWidth,
      this.playerCharacter.getInventory(),
      this.playerCharacter.getBeltInventory(),
      pointer
    )
    this.equipmentPanel.render(
      viewportWidth,
      this.playerCharacter.getEquipmentLoadout(),
      this.playerCharacter.getInventory(),
      this.inventoryPanel.isOpen(),
      pointer,
      this.getSelectedInventoryItemDefinitionId()
    )
  }

  handlePointerDown(params: {
    pointer: Phaser.Input.Pointer
    viewportWidth: number
  }): boolean {
    if (!this.inventoryPanel.isOpen()) {
      return false
    }

    const { pointer, viewportWidth } = params
    const equipmentClick = this.equipmentPanel.handlePointerDown(pointer.x, pointer.y)
    if (equipmentClick.target) {
      if (this.getSelectedInventoryItemInstanceId()) {
        this.applyEquipmentPanelSelection(equipmentClick.target)
      } else if (pointer.button === 0 && this.isEquipmentTargetFilled(equipmentClick.target)) {
        this.equipmentPanel.startDragging(equipmentClick.target)
      }
    }
    if (equipmentClick.consumed) {
      return true
    }

    const inventoryClick = this.inventoryPanel.handlePointerDown(
      pointer.x,
      pointer.y,
      pointer.button,
      viewportWidth,
      this.playerCharacter.getInventory(),
      this.playerCharacter.getBeltInventory()
    )
    if (inventoryClick.requestedUseItemDefinitionId) {
      this.callbacks.useInventoryItem(inventoryClick.requestedUseItemDefinitionId)
    }

    return inventoryClick.consumed
  }

  handlePointerUp(params: {
    pointer: Phaser.Input.Pointer
    viewportWidth: number
  }): boolean {
    if (!this.inventoryPanel.isOpen()) {
      return false
    }

    const { pointer, viewportWidth } = params
    const draggingEquipmentTarget = this.equipmentPanel.getDraggingTarget()
    if (draggingEquipmentTarget) {
      const handled = this.tryDropDraggedEquipmentIntoInventory(
        draggingEquipmentTarget,
        pointer.x,
        pointer.y,
        viewportWidth
      )
      this.equipmentPanel.clearDragging()
      if (handled) {
        return true
      }
    }

    if (this.inventoryPanel.getDraggingStackId()) {
      const equipmentDrop = this.equipmentPanel.handlePointerUp(pointer.x, pointer.y)
      if (equipmentDrop.target) {
        this.applyEquipmentPanelSelection(equipmentDrop.target)
        this.inventoryPanel.clearDragging()
        return true
      }
    }

    const inventoryClick = this.inventoryPanel.handlePointerUp(
      pointer.x,
      pointer.y,
      viewportWidth,
      this.playerCharacter.getInventory(),
      this.playerCharacter.getBeltInventory()
    )
    if (!inventoryClick.requestedMove) {
      return inventoryClick.consumed
    }

    const sourceInventory = inventoryClick.requestedMove.sourceInventoryKind === 'belt'
      ? this.playerCharacter.getBeltInventory()
      : this.playerCharacter.getInventory()
    const targetInventory = inventoryClick.requestedMove.targetInventoryKind === 'belt'
      ? this.playerCharacter.getBeltInventory()
      : this.playerCharacter.getInventory()
    const moved = sourceInventory === targetInventory
      ? moveInventoryStack(
          targetInventory,
          inventoryClick.requestedMove.stackId,
          inventoryClick.requestedMove.x,
          inventoryClick.requestedMove.y
        )
      : transferInventoryStack(
          sourceInventory,
          targetInventory,
          inventoryClick.requestedMove.stackId,
          inventoryClick.requestedMove.x,
          inventoryClick.requestedMove.y
        )
    this.callbacks.setInteractionStatus(
      moved
        ? `${inventoryClick.requestedMove.sourceInventoryKind} -> ${inventoryClick.requestedMove.targetInventoryKind} ${inventoryClick.requestedMove.x},${inventoryClick.requestedMove.y}`
        : 'cannot move item there'
    )
    if (moved) {
      this.callbacks.onInventoryChanged()
    }

    return true
  }

  addDebugItems(): void {
    const result = addInventoryItems(this.playerCharacter.getInventory(), TEST_SHAPE_ITEM_DEFINITION_IDS)
    const beltResult = addInventoryItems(this.playerCharacter.getBeltInventory(), TEST_BELT_ITEM_DEFINITION_IDS)
    this.callbacks.setInteractionStatus(
      `added shape items ${result.addedCount}, belt usable items ${beltResult.addedCount}` +
      ((result.failedItemDefinitionIds.length + beltResult.failedItemDefinitionIds.length) > 0
        ? `, failed ${result.failedItemDefinitionIds.length + beltResult.failedItemDefinitionIds.length}`
        : '')
    )
    if (result.addedCount > 0 || beltResult.addedCount > 0) {
      this.callbacks.onInventoryChanged()
    }
  }

  private applyEquipmentPanelSelection(target: EquipmentSlotTarget): void {
    const selectedItemInstanceId = this.getSelectedInventoryItemInstanceId()
    const nextLoadout = selectedItemInstanceId
      ? assignItemToEquipmentTarget({
          inventory: this.playerCharacter.getInventory(),
          loadout: this.playerCharacter.getEquipmentLoadout(),
          itemInstanceId: selectedItemInstanceId,
          target,
        })
      : clearEquipmentTarget(this.playerCharacter.getEquipmentLoadout(), target)

    if (!nextLoadout) {
      this.callbacks.setInteractionStatus('cannot equip item there')
      return
    }

    this.playerCharacter.setEquipmentLoadout(nextLoadout)
    this.callbacks.onInventoryChanged()
    this.callbacks.setInteractionStatus(selectedItemInstanceId ? 'equipment updated' : 'equipment cleared')
  }

  private tryDropDraggedEquipmentIntoInventory(
    target: EquipmentSlotTarget,
    screenX: number,
    screenY: number,
    viewportWidth: number
  ): boolean {
    const inventory = this.playerCharacter.getInventory()
    const beltInventory = this.playerCharacter.getBeltInventory()
    const instanceId = getEquipmentTargetInstanceId(this.playerCharacter.getEquipmentLoadout(), target)
    if (!instanceId) {
      return false
    }

    const stackId = getStackIdByItemInstanceId(inventory, instanceId)
    if (!stackId) {
      return false
    }

    const dropCell = this.inventoryPanel.getDropCellAt(
      screenX,
      screenY,
      viewportWidth,
      inventory,
      beltInventory
    )
    if (dropCell?.inventoryKind === 'inventory') {
      const moved = moveInventoryStack(inventory, stackId, dropCell.x, dropCell.y)
      if (!moved) {
        this.callbacks.setInteractionStatus('cannot place equipped item there')
        return true
      }
    } else {
      const equipmentDrop = this.equipmentPanel.handlePointerUp(screenX, screenY)
      if (!equipmentDrop.target) {
        return false
      }
    }

    this.playerCharacter.setEquipmentLoadout(
      clearEquipmentTarget(this.playerCharacter.getEquipmentLoadout(), target)
    )
    this.callbacks.onInventoryChanged()
    this.callbacks.setInteractionStatus('equipment removed')
    return true
  }

  private isEquipmentTargetFilled(target: EquipmentSlotTarget): boolean {
    return Boolean(getEquipmentTargetInstanceId(this.playerCharacter.getEquipmentLoadout(), target))
  }

  private getSelectedInventoryItemInstanceId(): string | null {
    const selectedStackId = this.inventoryPanel.getSelectedStackId()
    if (!selectedStackId) {
      return null
    }

    return getStackPrimaryItemInstanceId(this.playerCharacter.getInventory(), selectedStackId) ??
      getStackPrimaryItemInstanceId(this.playerCharacter.getBeltInventory(), selectedStackId)
  }

  private getSelectedInventoryItemDefinitionId(): string | null {
    const instanceId = this.getSelectedInventoryItemInstanceId()
    if (!instanceId) {
      return null
    }

    return this.playerCharacter.getInventory().itemInstances.find(item => item.instanceId === instanceId)?.itemDefinitionId ??
      this.playerCharacter.getBeltInventory().itemInstances.find(item => item.instanceId === instanceId)?.itemDefinitionId ??
      null
  }
}
