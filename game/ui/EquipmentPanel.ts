import * as Phaser from 'phaser'
import type {
  CharacterEquipmentLoadout,
  EquipmentSlotTarget,
} from '../items/CharacterEquipmentLoadout'
import type { InventoryState } from '../items/Inventory'
import {
  getItemDefinition,
  isAccessoryItemDefinition,
  isArmorItemDefinition,
  isGemItem,
  isWeaponItemDefinition,
  type ItemDefinition,
} from '../items/ItemCatalog'

const PANEL_WIDTH = 280
const PANEL_PADDING = 14
const SLOT_HEIGHT = 28
const SOCKET_INDENT = 18

interface PanelSlotRegion {
  target: EquipmentSlotTarget
  x: number
  y: number
  width: number
  height: number
  hint: string
}

export interface EquipmentPanelClickResult {
  consumed: boolean
  target?: EquipmentSlotTarget
}

export class EquipmentPanel {
  private readonly panel: Phaser.GameObjects.Rectangle
  private readonly titleText: Phaser.GameObjects.Text
  private readonly helperText: Phaser.GameObjects.Text
  private itemObjects: Phaser.GameObjects.GameObject[] = []
  private slotRegions: PanelSlotRegion[] = []
  private visible = false
  private draggingTarget: EquipmentSlotTarget | null = null

  constructor(private readonly scene: Phaser.Scene) {
    this.panel = scene.add.rectangle(0, 0, PANEL_WIDTH, 0, 0x111827, 0.94)
    this.panel.setOrigin(0)
    this.panel.setStrokeStyle(2, 0x64748b, 0.9)
    this.panel.setDepth(10003)
    this.panel.setScrollFactor(0)
    this.panel.setVisible(false)

    this.titleText = scene.add.text(0, 0, '', {
      color: '#f8fafc',
      fontSize: '18px',
      fontFamily: 'monospace',
    })
    this.titleText.setDepth(10005)
    this.titleText.setScrollFactor(0)
    this.titleText.setVisible(false)

    this.helperText = scene.add.text(0, 0, '', {
      color: '#94a3b8',
      fontSize: '11px',
      fontFamily: 'monospace',
      lineSpacing: 4,
      wordWrap: { width: PANEL_WIDTH - PANEL_PADDING * 2 },
    })
    this.helperText.setDepth(10005)
    this.helperText.setScrollFactor(0)
    this.helperText.setVisible(false)
  }

  render(
    viewportWidth: number,
    loadout: CharacterEquipmentLoadout,
    inventory: InventoryState,
    visible: boolean,
    pointer: { x: number; y: number },
    selectedItemDefinitionId: string | null
  ): void {
    this.visible = visible
    if (!visible) {
      this.hide()
      return
    }

    const panelX = viewportWidth - PANEL_WIDTH - 16
    const panelY = 72
    const cursor = { x: panelX + PANEL_PADDING, y: panelY + 40 }

    this.panel.setVisible(true)
    this.panel.setPosition(panelX, panelY)
    this.titleText.setVisible(true)
    this.titleText.setPosition(panelX + PANEL_PADDING, panelY + 10)
    this.titleText.setText('Equipment')
    this.helperText.setVisible(true)
    this.helperText.setPosition(panelX + PANEL_PADDING, panelY + 0)
    this.helperText.setText('')

    this.slotRegions = []
    this.clearItemObjects()
    const selectedDefinition = selectedItemDefinitionId ? getItemDefinition(selectedItemDefinitionId) : null

    cursor.y = panelY + 42
    this.renderSlot({
      label: 'Weapon',
      value: this.resolveItemName(inventory, loadout.weaponInstanceId) ?? 'empty',
      target: { kind: 'weapon' },
      panelX,
      cursor,
      selected: Boolean(loadout.weaponInstanceId),
      pointer,
      selectedDefinition,
      loadout,
      inventory,
    })
    this.renderSlot({
      label: 'Armor',
      value: this.resolveItemName(inventory, loadout.armorInstanceId) ?? 'empty',
      target: { kind: 'armor' },
      panelX,
      cursor,
      selected: Boolean(loadout.armorInstanceId),
      pointer,
      selectedDefinition,
      loadout,
      inventory,
    })

    loadout.accessorySlots.forEach((slot, slotIndex) => {
      this.renderSlot({
        label: `Accessory ${slotIndex + 1}`,
        value: slot ? (this.resolveItemName(inventory, slot.accessoryInstanceId) ?? 'unknown') : 'empty',
        target: { kind: 'accessory', slotIndex },
        panelX,
        cursor,
        selected: Boolean(slot),
        pointer,
        selectedDefinition,
        loadout,
        inventory,
      })

      const socketCount = this.getAccessorySocketCount(inventory, slot?.accessoryInstanceId ?? null)
      for (let socketIndex = 0; socketIndex < socketCount; socketIndex++) {
        this.renderSlot({
          label: `Socket ${socketIndex + 1}`,
          value: this.resolveItemName(inventory, slot?.gemInstanceIds[socketIndex] ?? null) ?? 'empty',
          target: { kind: 'socket', accessorySlotIndex: slotIndex, socketIndex },
          panelX,
          cursor,
          selected: Boolean(slot?.gemInstanceIds[socketIndex]),
          indent: SOCKET_INDENT,
          pointer,
          selectedDefinition,
          loadout,
          inventory,
        })
      }
    })

    const panelHeight = cursor.y - panelY + 56
    this.panel.setSize(PANEL_WIDTH, panelHeight)
    const hoveredRegion = this.slotRegions.find(region =>
      pointer.x >= region.x &&
      pointer.x <= region.x + region.width &&
      pointer.y >= region.y &&
      pointer.y <= region.y + region.height
    )
    this.helperText.setText(
      hoveredRegion?.hint ??
      'left click slot: equip selected item\nleft click filled slot with no selection: clear'
    )
    this.helperText.setPosition(panelX + PANEL_PADDING, panelY + panelHeight - 38)
  }

  handlePointerDown(screenX: number, screenY: number): EquipmentPanelClickResult {
    return this.getClickResult(screenX, screenY)
  }

  handlePointerUp(screenX: number, screenY: number): EquipmentPanelClickResult {
    return this.getClickResult(screenX, screenY)
  }

  getDraggingTarget(): EquipmentSlotTarget | null {
    return this.draggingTarget
  }

  startDragging(target: EquipmentSlotTarget): void {
    this.draggingTarget = target
  }

  clearDragging(): void {
    this.draggingTarget = null
  }

  private getClickResult(screenX: number, screenY: number): EquipmentPanelClickResult {
    if (!this.visible) {
      return { consumed: false }
    }

    if (!this.isInsidePanel(screenX, screenY)) {
      return { consumed: false }
    }

    const hit = this.slotRegions.find(region =>
      screenX >= region.x &&
      screenX <= region.x + region.width &&
      screenY >= region.y &&
      screenY <= region.y + region.height
    )
    return {
      consumed: true,
      target: hit?.target,
    }
  }

  destroy(): void {
    this.clearItemObjects()
    this.panel.destroy()
    this.titleText.destroy()
    this.helperText.destroy()
  }

  private renderSlot(params: {
    label: string
    value: string
    target: EquipmentSlotTarget
    panelX: number
    cursor: { x: number; y: number }
    selected: boolean
    indent?: number
    pointer: { x: number; y: number }
    selectedDefinition: ItemDefinition | null
    loadout: CharacterEquipmentLoadout
    inventory: InventoryState
  }): void {
    const x = params.panelX + PANEL_PADDING + (params.indent ?? 0)
    const y = params.cursor.y
    const width = PANEL_WIDTH - PANEL_PADDING * 2 - (params.indent ?? 0)
    const hovered = params.pointer.x >= x &&
      params.pointer.x <= x + width &&
      params.pointer.y >= y &&
      params.pointer.y <= y + SLOT_HEIGHT
    const interaction = this.getSlotInteractionState(
      params.target,
      params.selectedDefinition,
      params.loadout,
      params.inventory
    )
    const palette = this.getSlotPalette(params.selected, hovered, interaction.allowed, interaction.clearable)

    const bg = this.scene.add.rectangle(x, y, width, SLOT_HEIGHT, palette.fillColor, palette.fillAlpha)
    bg.setOrigin(0)
    bg.setStrokeStyle(1, palette.strokeColor, palette.strokeAlpha)
    bg.setDepth(10005)
    bg.setScrollFactor(0)
    this.itemObjects.push(bg)

    const text = this.scene.add.text(x + 8, y + 6, `${params.label}: ${params.value}`, {
      color: palette.textColor,
      fontSize: '12px',
      fontFamily: 'monospace',
    })
    text.setDepth(10006)
    text.setScrollFactor(0)
    this.itemObjects.push(text)

    this.slotRegions.push({
      target: params.target,
      x,
      y,
      width,
      height: SLOT_HEIGHT,
      hint: interaction.hint,
    })
    params.cursor.y += SLOT_HEIGHT + 8
  }

  private getAccessorySocketCount(inventory: InventoryState, accessoryInstanceId: string | null): number {
    if (!accessoryInstanceId) {
      return 0
    }

    const instance = inventory.itemInstances.find(candidate => candidate.instanceId === accessoryInstanceId)
    if (!instance) {
      return 0
    }

    const definition = getItemDefinition(instance.itemDefinitionId)
    return 'accessorySocketCount' in definition ? definition.accessorySocketCount ?? 0 : 0
  }

  private resolveItemName(inventory: InventoryState, instanceId: string | null): string | null {
    if (!instanceId) {
      return null
    }

    const instance = inventory.itemInstances.find(candidate => candidate.instanceId === instanceId)
    return instance ? getItemDefinition(instance.itemDefinitionId).name : null
  }

  private getSlotInteractionState(
    target: EquipmentSlotTarget,
    selectedDefinition: ItemDefinition | null,
    loadout: CharacterEquipmentLoadout,
    inventory: InventoryState
  ): { allowed: boolean | null; clearable: boolean; hint: string } {
    if (!selectedDefinition) {
      const clearable = this.isTargetFilled(target, loadout)
      return {
        allowed: null,
        clearable,
        hint: clearable ? 'click: clear this slot' : 'select an inventory item first',
      }
    }

    if (target.kind === 'weapon') {
      return {
        allowed: isWeaponItemDefinition(selectedDefinition),
        clearable: false,
        hint: isWeaponItemDefinition(selectedDefinition) ? 'click: equip weapon' : 'weapon slot only accepts weapons',
      }
    }

    if (target.kind === 'armor') {
      return {
        allowed: isArmorItemDefinition(selectedDefinition),
        clearable: false,
        hint: isArmorItemDefinition(selectedDefinition) ? 'click: equip armor' : 'armor slot only accepts armor',
      }
    }

    if (target.kind === 'accessory') {
      return {
        allowed: isAccessoryItemDefinition(selectedDefinition),
        clearable: false,
        hint: isAccessoryItemDefinition(selectedDefinition)
          ? `click: equip accessory ${target.slotIndex + 1}`
          : 'accessory slot only accepts accessories',
      }
    }

    const accessorySlot = loadout.accessorySlots[target.accessorySlotIndex]
    if (!accessorySlot) {
      return {
        allowed: false,
        clearable: false,
        hint: 'socket requires an equipped accessory first',
      }
    }

    const socketCount = this.getAccessorySocketCount(inventory, accessorySlot.accessoryInstanceId)
    if (target.socketIndex >= socketCount) {
      return {
        allowed: false,
        clearable: false,
        hint: 'this accessory does not have that socket',
      }
    }

    return {
      allowed: isGemItem(selectedDefinition),
      clearable: false,
      hint: isGemItem(selectedDefinition) ? 'click: socket gem' : 'socket only accepts gems',
    }
  }

  private isTargetFilled(target: EquipmentSlotTarget, loadout: CharacterEquipmentLoadout): boolean {
    if (target.kind === 'weapon') {
      return Boolean(loadout.weaponInstanceId)
    }
    if (target.kind === 'armor') {
      return Boolean(loadout.armorInstanceId)
    }
    if (target.kind === 'accessory') {
      return Boolean(loadout.accessorySlots[target.slotIndex])
    }

    return Boolean(loadout.accessorySlots[target.accessorySlotIndex]?.gemInstanceIds[target.socketIndex])
  }

  private getSlotPalette(
    selected: boolean,
    hovered: boolean,
    allowed: boolean | null,
    clearable: boolean
  ): {
    fillColor: number
    fillAlpha: number
    strokeColor: number
    strokeAlpha: number
    textColor: string
  } {
    if (allowed === true) {
      return {
        fillColor: hovered ? 0x166534 : 0x14532d,
        fillAlpha: hovered ? 0.96 : 0.9,
        strokeColor: 0x86efac,
        strokeAlpha: 1,
        textColor: '#ecfdf5',
      }
    }

    if (allowed === false) {
      return {
        fillColor: hovered ? 0x7f1d1d : 0x450a0a,
        fillAlpha: hovered ? 0.96 : 0.9,
        strokeColor: 0xfca5a5,
        strokeAlpha: 1,
        textColor: '#fef2f2',
      }
    }

    if (clearable) {
      return {
        fillColor: hovered ? 0x1e3a8a : 0x1d4ed8,
        fillAlpha: hovered ? 0.96 : 0.88,
        strokeColor: 0xbfdbfe,
        strokeAlpha: 1,
        textColor: '#eff6ff',
      }
    }

    if (selected) {
      return {
        fillColor: hovered ? 0x1e40af : 0x1d4ed8,
        fillAlpha: hovered ? 0.96 : 0.88,
        strokeColor: 0xbfdbfe,
        strokeAlpha: 1,
        textColor: '#eff6ff',
      }
    }

    if (hovered) {
      return {
        fillColor: 0x1f2937,
        fillAlpha: 0.96,
        strokeColor: 0x93c5fd,
        strokeAlpha: 1,
        textColor: '#e2e8f0',
      }
    }

    return {
      fillColor: 0x0f172a,
      fillAlpha: 0.88,
      strokeColor: 0x334155,
      strokeAlpha: 0.95,
      textColor: '#cbd5e1',
    }
  }

  private hide(): void {
    this.panel.setVisible(false)
    this.titleText.setVisible(false)
    this.helperText.setVisible(false)
    this.slotRegions = []
    this.draggingTarget = null
    this.clearItemObjects()
  }

  private clearItemObjects(): void {
    for (const object of this.itemObjects) {
      object.destroy()
    }

    this.itemObjects = []
  }

  private isInsidePanel(screenX: number, screenY: number): boolean {
    return this.panel.visible &&
      screenX >= this.panel.x &&
      screenX <= this.panel.x + this.panel.width &&
      screenY >= this.panel.y &&
      screenY <= this.panel.y + this.panel.height
  }
}
