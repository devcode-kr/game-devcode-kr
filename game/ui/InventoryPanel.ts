import * as Phaser from 'phaser'
import type { CharacterStatModifier } from '../characters/CharacterStatModifier'
import {
  getItemDefinition,
  getItemTypeLabel,
  isBeltCompatibleItemDefinition,
} from '../items/ItemCatalog'
import {
  canTransferInventoryStack,
  canMoveInventoryStack,
  getInventoryStackViews,
  type InventoryState,
  type InventoryStackView,
} from '../items/Inventory'

const INVENTORY_CELL_SIZE = 34
const INVENTORY_PANEL_PADDING = 16
const BELT_SECTION_GAP = 18

type InventoryKind = 'inventory' | 'belt'

interface InventoryPanelLayout {
  panelX: number
  panelY: number
  panelWidth: number
  panelHeight: number
  inventoryGridX: number
  inventoryGridY: number
  beltGridX: number
  beltGridY: number
}

interface LocatedStack {
  inventoryKind: InventoryKind
  stack: InventoryStackView
}

export interface InventoryPanelClickResult {
  consumed: boolean
  requestedUseItemDefinitionId?: string
  requestedMove?: {
    sourceInventoryKind: InventoryKind
    targetInventoryKind: InventoryKind
    stackId: string
    x: number
    y: number
  }
}

export class InventoryPanel {
  private readonly panel: Phaser.GameObjects.Rectangle
  private readonly graphics: Phaser.GameObjects.Graphics
  private readonly titleText: Phaser.GameObjects.Text
  private readonly metaText: Phaser.GameObjects.Text
  private itemTexts: Phaser.GameObjects.Text[] = []
  private open = false
  private selectedStackId: string | null = null
  private hoveredStackId: string | null = null
  private draggingStackId: string | null = null

  constructor(private readonly scene: Phaser.Scene) {
    this.panel = scene.add.rectangle(0, 0, 0, 0, 0x0f172a, 0.92)
    this.panel.setOrigin(0)
    this.panel.setStrokeStyle(2, 0x94a3b8, 0.9)
    this.panel.setDepth(10003)
    this.panel.setScrollFactor(0)
    this.panel.setVisible(false)

    this.graphics = scene.add.graphics()
    this.graphics.setDepth(10004)
    this.graphics.setScrollFactor(0)

    this.titleText = scene.add.text(0, 0, '', {
      color: '#f8fafc',
      fontSize: '18px',
      fontFamily: 'monospace',
    })
    this.titleText.setDepth(10005)
    this.titleText.setScrollFactor(0)
    this.titleText.setVisible(false)

    this.metaText = scene.add.text(0, 0, '', {
      color: '#cbd5e1',
      fontSize: '12px',
      fontFamily: 'monospace',
      lineSpacing: 4,
    })
    this.metaText.setDepth(10005)
    this.metaText.setScrollFactor(0)
    this.metaText.setVisible(false)
  }

  isOpen(): boolean {
    return this.open
  }

  getSelectedStackId(): string | null {
    return this.selectedStackId
  }

  getDraggingStackId(): string | null {
    return this.draggingStackId
  }

  clearDragging(): void {
    this.draggingStackId = null
  }

  getDropCellAt(
    screenX: number,
    screenY: number,
    viewportWidth: number,
    inventory: InventoryState,
    beltInventory: InventoryState
  ): { inventoryKind: InventoryKind; x: number; y: number } | null {
    if (!this.open) {
      return null
    }

    return this.getGridCellAt(screenX, screenY, viewportWidth, inventory, beltInventory)
  }

  toggle(): void {
    this.open = !this.open
    if (!this.open) {
      this.selectedStackId = null
      this.hoveredStackId = null
      this.draggingStackId = null
    }
  }

  render(
    viewportWidth: number,
    inventory: InventoryState,
    beltInventory: InventoryState,
    pointer: { x: number; y: number }
  ): void {
    if (!this.open) {
      this.hide()
      return
    }

    const layout = this.getLayout(viewportWidth, inventory, beltInventory)
    const locatedStacks = this.getLocatedStacks(inventory, beltInventory)
    const selectedStack = this.selectedStackId
      ? locatedStacks.find(candidate => candidate.stack.stackId === this.selectedStackId) ?? null
      : null
    const draggingStack = this.draggingStackId
      ? locatedStacks.find(candidate => candidate.stack.stackId === this.draggingStackId) ?? null
      : null
    this.hoveredStackId = this.findStackAt(pointer.x, pointer.y, viewportWidth, inventory, beltInventory)?.stack.stackId ?? null

    this.panel.setVisible(true)
    this.panel.setPosition(layout.panelX, layout.panelY)
    this.panel.setSize(layout.panelWidth, layout.panelHeight)

    this.titleText.setVisible(true)
    this.titleText.setPosition(layout.panelX + INVENTORY_PANEL_PADDING, layout.panelY + 10)
    this.titleText.setText('Inventory')

    this.metaText.setVisible(true)
    this.metaText.setPosition(layout.inventoryGridX + inventory.cols * INVENTORY_CELL_SIZE + 16, layout.inventoryGridY)
    this.metaText.setText(this.buildMetaLines(inventory, beltInventory, locatedStacks.length, selectedStack))

    this.graphics.clear()
    this.clearItemTexts()
    this.drawGrid(layout.inventoryGridX, layout.inventoryGridY, inventory.cols, inventory.rows)
    this.drawGrid(layout.beltGridX, layout.beltGridY, beltInventory.cols, beltInventory.rows)

    const labelText = this.scene.add.text(layout.inventoryGridX, layout.beltGridY - 16, 'Belt', {
      color: '#94a3b8',
      fontSize: '11px',
      fontFamily: 'monospace',
    })
    labelText.setDepth(10006)
    labelText.setScrollFactor(0)
    this.itemTexts.push(labelText)

    for (const located of locatedStacks) {
      this.drawStack(layout, located)
    }

    if (draggingStack) {
      this.drawDragPreview(layout, viewportWidth, inventory, beltInventory, draggingStack, pointer.x, pointer.y)
    }
  }

  handlePointerDown(
    screenX: number,
    screenY: number,
    button: number,
    viewportWidth: number,
    inventory: InventoryState,
    beltInventory: InventoryState
  ): InventoryPanelClickResult {
    if (!this.open) {
      return { consumed: false }
    }

    const layout = this.getLayout(viewportWidth, inventory, beltInventory)
    if (!this.isInsidePanel(screenX, screenY, layout)) {
      return { consumed: true }
    }

    const clicked = this.findStackAt(screenX, screenY, viewportWidth, inventory, beltInventory)
    if (!clicked) {
      this.selectedStackId = null
      this.draggingStackId = null
      return { consumed: true }
    }

    this.selectedStackId = clicked.stack.stackId

    if (button === 2) {
      return {
        consumed: true,
        requestedUseItemDefinitionId: clicked.stack.itemDefinitionId,
      }
    }

    if (button === 0) {
      this.draggingStackId = clicked.stack.stackId
    }

    return { consumed: true }
  }

  handlePointerUp(
    screenX: number,
    screenY: number,
    viewportWidth: number,
    inventory: InventoryState,
    beltInventory: InventoryState
  ): InventoryPanelClickResult {
    if (!this.open) {
      return { consumed: false }
    }

    const dragging = this.draggingStackId
      ? this.getLocatedStacks(inventory, beltInventory).find(candidate => candidate.stack.stackId === this.draggingStackId) ?? null
      : null
    this.draggingStackId = null

    if (!dragging) {
      return {
        consumed: this.isInsidePanel(screenX, screenY, this.getLayout(viewportWidth, inventory, beltInventory)),
      }
    }

    const targetCell = this.getGridCellAt(screenX, screenY, viewportWidth, inventory, beltInventory)
    if (!targetCell) {
      return { consumed: true }
    }

    const targetInventory = targetCell.inventoryKind === 'belt' ? beltInventory : inventory
    const canMove = dragging.inventoryKind === targetCell.inventoryKind
      ? canMoveInventoryStack(targetInventory, dragging.stack.stackId, targetCell.x, targetCell.y)
      : this.canTransferToInventory(
          dragging.inventoryKind === 'belt' ? beltInventory : inventory,
          targetInventory,
          dragging.stack,
          targetCell.x,
          targetCell.y,
          targetCell.inventoryKind
        )

    if (!canMove) {
      return { consumed: true }
    }

    return {
      consumed: true,
      requestedMove: {
        sourceInventoryKind: dragging.inventoryKind,
        targetInventoryKind: targetCell.inventoryKind,
        stackId: dragging.stack.stackId,
        x: targetCell.x,
        y: targetCell.y,
      },
    }
  }

  hide(): void {
    this.panel.setVisible(false)
    this.titleText.setVisible(false)
    this.metaText.setVisible(false)
    this.graphics.clear()
    this.clearItemTexts()
  }

  private getLayout(
    viewportWidth: number,
    inventory: InventoryState,
    beltInventory: InventoryState
  ): InventoryPanelLayout {
    const panelWidth = inventory.cols * INVENTORY_CELL_SIZE + INVENTORY_PANEL_PADDING * 2 + 140
    const panelHeight = inventory.rows * INVENTORY_CELL_SIZE +
      beltInventory.rows * INVENTORY_CELL_SIZE +
      INVENTORY_PANEL_PADDING * 3 +
      BELT_SECTION_GAP +
      52
    const panelX = viewportWidth - panelWidth - 16
    const panelY = 16
    const inventoryGridX = panelX + INVENTORY_PANEL_PADDING
    const inventoryGridY = panelY + INVENTORY_PANEL_PADDING + 28
    const beltGridX = inventoryGridX
    const beltGridY = inventoryGridY + inventory.rows * INVENTORY_CELL_SIZE + INVENTORY_PANEL_PADDING + BELT_SECTION_GAP

    return {
      panelX,
      panelY,
      panelWidth,
      panelHeight,
      inventoryGridX,
      inventoryGridY,
      beltGridX,
      beltGridY,
    }
  }

  private buildMetaLines(
    inventory: InventoryState,
    beltInventory: InventoryState,
    stackCount: number,
    selectedStack: LocatedStack | null
  ): string[] {
    if (!selectedStack) {
      return [
        `bag: ${inventory.cols}x${inventory.rows}`,
        `belt: ${beltInventory.cols}x${beltInventory.rows}`,
        `stacks: ${stackCount}`,
        `items: ${inventory.itemInstances.length + beltInventory.itemInstances.length}`,
        '',
        'selection:',
        '- drag to move',
        '- right click: use',
        '- usable items prefer belt',
        '',
        '[I] close',
      ]
    }

    const definition = getItemDefinition(selectedStack.stack.itemDefinitionId)
    return [
      `bag: ${inventory.cols}x${inventory.rows}`,
      `belt: ${beltInventory.cols}x${beltInventory.rows}`,
      `stacks: ${stackCount}`,
      `items: ${inventory.itemInstances.length + beltInventory.itemInstances.length}`,
      '',
      `selected: ${definition.name}`,
      `slot: ${selectedStack.inventoryKind}`,
      `type: ${getItemTypeLabel(definition)}`,
      `size: ${definition.width}x${definition.height}`,
      `stack: ${selectedStack.stack.count}/${selectedStack.stack.maxStack}`,
      ...(definition.healAmount ? [`effect: heal ${definition.healAmount}`] : []),
      ...(definition.manaAmount ? [`effect: mana ${definition.manaAmount}`] : []),
      ...(definition.guardDurationMs ? [`effect: guard ${Math.floor(definition.guardDurationMs / 1000)}s`] : []),
      ...this.getStatModifierLines(definition.statModifiers),
      ...(definition.statBuffDurationMs ? [`buff duration: ${Math.floor(definition.statBuffDurationMs / 1000)}s`] : []),
      ...(definition.cooldownMs ? [`cooldown: ${Math.floor(definition.cooldownMs / 1000)}s (${definition.cooldownGroup ?? 'shared'})`] : []),
      '',
      'actions:',
      '- drag to move',
      '- right click: use',
      '[I] close',
    ]
  }

  private getLocatedStacks(
    inventory: InventoryState,
    beltInventory: InventoryState
  ): LocatedStack[] {
    return [
      ...getInventoryStackViews(beltInventory).map(stack => ({ inventoryKind: 'belt' as const, stack })),
      ...getInventoryStackViews(inventory).map(stack => ({ inventoryKind: 'inventory' as const, stack })),
    ]
  }

  private drawGrid(originX: number, originY: number, cols: number, rows: number): void {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = originX + col * INVENTORY_CELL_SIZE
        const y = originY + row * INVENTORY_CELL_SIZE
        this.graphics.fillStyle(0x111827, 0.85)
        this.graphics.fillRect(x, y, INVENTORY_CELL_SIZE - 2, INVENTORY_CELL_SIZE - 2)
        this.graphics.lineStyle(1, 0x334155, 0.95)
        this.graphics.strokeRect(x, y, INVENTORY_CELL_SIZE - 2, INVENTORY_CELL_SIZE - 2)
      }
    }
  }

  private drawStack(layout: InventoryPanelLayout, located: LocatedStack): void {
    const stack = located.stack
    const color = this.getItemColor(stack.itemDefinitionId)
    const originX = located.inventoryKind === 'belt' ? layout.beltGridX : layout.inventoryGridX
    const originY = located.inventoryKind === 'belt' ? layout.beltGridY : layout.inventoryGridY
    const itemX = originX + stack.x * INVENTORY_CELL_SIZE
    const itemY = originY + stack.y * INVENTORY_CELL_SIZE
    const itemWidth = stack.width * INVENTORY_CELL_SIZE - 2
    const itemHeight = stack.height * INVENTORY_CELL_SIZE - 2
    const isSelected = stack.stackId === this.selectedStackId
    const isHovered = stack.stackId === this.hoveredStackId

    this.drawFootprintShape(
      stack.footprint,
      itemX,
      itemY,
      color,
      isSelected ? 1 : 0.95,
      isSelected ? 0xf8fafc : isHovered ? 0xfcd34d : 0xe2e8f0,
      isSelected ? 1 : 0.85
    )

    this.graphics.lineStyle(1, 0x0f172a, 0.4)
    this.graphics.strokeLineShape(
      new Phaser.Geom.Line(itemX + 6, itemY + 16, itemX + itemWidth - 6, itemY + 16)
    )

    const label = this.scene.add.text(itemX + 6, itemY + 4, stack.name, {
      color: '#020617',
      fontSize: '10px',
      fontFamily: 'monospace',
    })
    label.setDepth(10006)
    label.setScrollFactor(0)
    this.itemTexts.push(label)

    const count = this.scene.add.text(itemX + itemWidth - 6, itemY + itemHeight - 14, `${stack.count}`, {
      color: '#f8fafc',
      fontSize: '12px',
      fontFamily: 'monospace',
    })
    count.setOrigin(1, 0)
    count.setDepth(10006)
    count.setScrollFactor(0)
    this.itemTexts.push(count)
  }

  private drawDragPreview(
    layout: InventoryPanelLayout,
    viewportWidth: number,
    inventory: InventoryState,
    beltInventory: InventoryState,
    dragging: LocatedStack,
    screenX: number,
    screenY: number
  ): void {
    const targetCell = this.getGridCellAt(
      screenX,
      screenY,
      viewportWidth,
      inventory,
      beltInventory
    )
    if (!targetCell) {
      return
    }

    const previewX = (targetCell.inventoryKind === 'belt' ? layout.beltGridX : layout.inventoryGridX) + targetCell.x * INVENTORY_CELL_SIZE
    const previewY = (targetCell.inventoryKind === 'belt' ? layout.beltGridY : layout.inventoryGridY) + targetCell.y * INVENTORY_CELL_SIZE
    const targetInventory = targetCell.inventoryKind === 'belt' ? beltInventory : inventory
    const valid = dragging.inventoryKind === targetCell.inventoryKind
      ? canMoveInventoryStack(targetInventory, dragging.stack.stackId, targetCell.x, targetCell.y)
      : this.canTransferToInventory(
          dragging.inventoryKind === 'belt' ? beltInventory : inventory,
          targetInventory,
          dragging.stack,
          targetCell.x,
          targetCell.y,
          targetCell.inventoryKind
        )

    this.drawFootprintShape(
      dragging.stack.footprint,
      previewX,
      previewY,
      valid ? 0x22c55e : 0xef4444,
      0.22,
      valid ? 0x86efac : 0xfca5a5,
      0.9
    )
  }

  private drawFootprintShape(
    footprint: number[][],
    originX: number,
    originY: number,
    fillColor: number,
    fillAlpha: number,
    strokeColor: number,
    strokeAlpha: number
  ): void {
    for (let row = 0; row < footprint.length; row++) {
      for (let col = 0; col < (footprint[row]?.length ?? 0); col++) {
        if (footprint[row]?.[col] !== 1) {
          continue
        }

        const x = originX + col * INVENTORY_CELL_SIZE
        const y = originY + row * INVENTORY_CELL_SIZE
        this.graphics.fillStyle(fillColor, fillAlpha)
        this.graphics.fillRoundedRect(x, y, INVENTORY_CELL_SIZE - 2, INVENTORY_CELL_SIZE - 2, 6)
        this.graphics.lineStyle(2, strokeColor, strokeAlpha)
        this.graphics.strokeRoundedRect(x, y, INVENTORY_CELL_SIZE - 2, INVENTORY_CELL_SIZE - 2, 6)
      }
    }
  }

  private findStackAt(
    screenX: number,
    screenY: number,
    viewportWidth: number,
    inventory: InventoryState,
    beltInventory: InventoryState
  ): LocatedStack | null {
    const layout = this.getLayout(viewportWidth, inventory, beltInventory)
    return this.getLocatedStacks(inventory, beltInventory).find(candidate => {
      const originX = candidate.inventoryKind === 'belt' ? layout.beltGridX : layout.inventoryGridX
      const originY = candidate.inventoryKind === 'belt' ? layout.beltGridY : layout.inventoryGridY
      return this.isPointInsideFootprint(screenX, screenY, originX, originY, candidate.stack)
    }) ?? null
  }

  private isPointInsideFootprint(
    screenX: number,
    screenY: number,
    originX: number,
    originY: number,
    stack: InventoryStackView
  ): boolean {
    const localX = screenX - (originX + stack.x * INVENTORY_CELL_SIZE)
    const localY = screenY - (originY + stack.y * INVENTORY_CELL_SIZE)
    if (localX < 0 || localY < 0) {
      return false
    }

    const footprintX = Math.floor(localX / INVENTORY_CELL_SIZE)
    const footprintY = Math.floor(localY / INVENTORY_CELL_SIZE)
    if (footprintX < 0 || footprintX >= stack.width || footprintY < 0 || footprintY >= stack.height) {
      return false
    }

    return stack.footprint[footprintY]?.[footprintX] === 1
  }

  private getGridCellAt(
    screenX: number,
    screenY: number,
    viewportWidth: number,
    inventory: InventoryState,
    beltInventory: InventoryState
  ): { inventoryKind: InventoryKind; x: number; y: number } | null {
    const layout = this.getLayout(viewportWidth, inventory, beltInventory)
    const beltCell = this.getCellInGrid(screenX, screenY, layout.beltGridX, layout.beltGridY, beltInventory)
    if (beltCell) {
      return { inventoryKind: 'belt', ...beltCell }
    }

    const inventoryCell = this.getCellInGrid(screenX, screenY, layout.inventoryGridX, layout.inventoryGridY, inventory)
    if (inventoryCell) {
      return { inventoryKind: 'inventory', ...inventoryCell }
    }

    return null
  }

  private getCellInGrid(
    screenX: number,
    screenY: number,
    gridX: number,
    gridY: number,
    inventory: InventoryState
  ): { x: number; y: number } | null {
    const localX = screenX - gridX
    const localY = screenY - gridY
    if (localX < 0 || localY < 0) {
      return null
    }

    const x = Math.floor(localX / INVENTORY_CELL_SIZE)
    const y = Math.floor(localY / INVENTORY_CELL_SIZE)
    if (x < 0 || x >= inventory.cols || y < 0 || y >= inventory.rows) {
      return null
    }

    return { x, y }
  }

  private isInsidePanel(screenX: number, screenY: number, layout: InventoryPanelLayout): boolean {
    return screenX >= layout.panelX &&
      screenX <= layout.panelX + layout.panelWidth &&
      screenY >= layout.panelY &&
      screenY <= layout.panelY + layout.panelHeight
  }

  private canTransferToInventory(
    sourceInventory: InventoryState,
    targetInventory: InventoryState,
    stack: InventoryStackView,
    x: number,
    y: number,
    targetInventoryKind: InventoryKind
  ): boolean {
    const definition = getItemDefinition(stack.itemDefinitionId)
    if (targetInventoryKind === 'belt' && !isBeltCompatibleItemDefinition(definition)) {
      return false
    }

    return canTransferInventoryStack(sourceInventory, targetInventory, stack.stackId, x, y)
  }

  private clearItemTexts(): void {
    for (const text of this.itemTexts) {
      text.destroy()
    }

    this.itemTexts = []
  }

  private getItemColor(itemDefinitionId: string): number {
    if (itemDefinitionId === 'potion_minor') {
      return 0x2563eb
    }

    if (itemDefinitionId === 'potion_guard') {
      return 0x7c3aed
    }

    if (itemDefinitionId === 'potion_berserk') {
      return 0xdc2626
    }

    if (itemDefinitionId === 'potion_haste') {
      return 0x0891b2
    }

    if (itemDefinitionId === 'utility_key') {
      return 0xa16207
    }

    return 0x475569
  }

  private getStatModifierLines(modifier: CharacterStatModifier | undefined): string[] {
    if (!modifier) {
      return []
    }

    const parts = Object.entries(modifier)
      .filter(([, value]) => value !== undefined && value !== 0)
      .map(([key, value]) => `${key} ${Number(value) > 0 ? '+' : ''}${Number(value)}`)

    return parts.length > 0 ? [`stats: ${parts.join(', ')}`] : []
  }
}
