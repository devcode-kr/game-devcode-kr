import * as Phaser from 'phaser'
import { getInventoryStackViews, type InventoryState } from '../items/Inventory'

const INVENTORY_CELL_SIZE = 34
const INVENTORY_PANEL_PADDING = 16

export class InventoryPanel {
  private readonly panel: Phaser.GameObjects.Rectangle
  private readonly graphics: Phaser.GameObjects.Graphics
  private readonly titleText: Phaser.GameObjects.Text
  private readonly metaText: Phaser.GameObjects.Text
  private itemTexts: Phaser.GameObjects.Text[] = []
  private open = false

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

  toggle(): void {
    this.open = !this.open
  }

  render(viewportWidth: number, inventory: InventoryState): void {
    if (!this.open) {
      this.hide()
      return
    }

    const panelWidth = inventory.cols * INVENTORY_CELL_SIZE + INVENTORY_PANEL_PADDING * 2 + 140
    const panelHeight = inventory.rows * INVENTORY_CELL_SIZE + INVENTORY_PANEL_PADDING * 2 + 52
    const panelX = viewportWidth - panelWidth - 16
    const panelY = 16
    const gridX = panelX + INVENTORY_PANEL_PADDING
    const gridY = panelY + INVENTORY_PANEL_PADDING + 28
    const stacks = getInventoryStackViews(inventory)

    this.panel.setVisible(true)
    this.panel.setPosition(panelX, panelY)
    this.panel.setSize(panelWidth, panelHeight)

    this.titleText.setVisible(true)
    this.titleText.setPosition(panelX + INVENTORY_PANEL_PADDING, panelY + 10)
    this.titleText.setText('Inventory')

    this.metaText.setVisible(true)
    this.metaText.setPosition(gridX + inventory.cols * INVENTORY_CELL_SIZE + 16, gridY)
    this.metaText.setText([
      `grid: ${inventory.cols}x${inventory.rows}`,
      `stacks: ${stacks.length}`,
      `items: ${inventory.itemInstances.length}`,
      '',
      'stacking:',
      '- grouped by item id',
      '- each item keeps unique id',
      '',
      '[I] close',
    ])

    this.graphics.clear()
    this.clearItemTexts()

    for (let row = 0; row < inventory.rows; row++) {
      for (let col = 0; col < inventory.cols; col++) {
        const x = gridX + col * INVENTORY_CELL_SIZE
        const y = gridY + row * INVENTORY_CELL_SIZE
        this.graphics.fillStyle(0x111827, 0.85)
        this.graphics.fillRect(x, y, INVENTORY_CELL_SIZE - 2, INVENTORY_CELL_SIZE - 2)
        this.graphics.lineStyle(1, 0x334155, 0.95)
        this.graphics.strokeRect(x, y, INVENTORY_CELL_SIZE - 2, INVENTORY_CELL_SIZE - 2)
      }
    }

    for (const stack of stacks) {
      const color = this.getItemColor(stack.itemDefinitionId)
      const itemX = gridX + stack.x * INVENTORY_CELL_SIZE
      const itemY = gridY + stack.y * INVENTORY_CELL_SIZE
      const itemWidth = stack.width * INVENTORY_CELL_SIZE - 2
      const itemHeight = stack.height * INVENTORY_CELL_SIZE - 2

      this.graphics.fillStyle(color, 0.95)
      this.graphics.fillRoundedRect(itemX, itemY, itemWidth, itemHeight, 6)
      this.graphics.lineStyle(2, 0xe2e8f0, 0.85)
      this.graphics.strokeRoundedRect(itemX, itemY, itemWidth, itemHeight, 6)

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
  }

  hide(): void {
    this.panel.setVisible(false)
    this.titleText.setVisible(false)
    this.metaText.setVisible(false)
    this.graphics.clear()
    this.clearItemTexts()
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

    if (itemDefinitionId === 'utility_key') {
      return 0xa16207
    }

    return 0x475569
  }
}
