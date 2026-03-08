import * as Phaser from 'phaser'
import type { EffectDebuffRuntime } from '../interactions/EffectDebuffRules'
import {
  STATUS_EFFECT_IDS,
  getBuffEffectDefinition,
  getDebuffEffectDefinition,
  getStatusEffectDefinition,
} from '../interactions/EffectDefinitions'
import type { ActiveItemBuffRuntime } from '../items/ItemStatRules'
import { getItemDefinition } from '../items/ItemCatalog'

const PANEL_PADDING = 12
const PANEL_WIDTH = 360
const ROW_HEIGHT = 28
const ROW_GAP = 10
const LABEL_WIDTH = 62
const BADGE_WIDTH = 24
const BADGE_HEIGHT = 24
const BADGE_GAP = 6
const MAX_BADGES_PER_ROW = 8
const TOOLTIP_PADDING = 10

type EffectHudSectionKey = 'buff' | 'debuff' | 'status'

interface EffectHudBadgeDescriptor {
  id: string
  iconKey: string
  title: string
  lines: string[]
}

interface EffectHudBadgeView {
  icon: Phaser.GameObjects.Image
}

export class EffectHudManager {
  private readonly panel: Phaser.GameObjects.Rectangle
  private readonly rowLabels: Record<EffectHudSectionKey, Phaser.GameObjects.Text>
  private readonly emptyTexts: Record<EffectHudSectionKey, Phaser.GameObjects.Text>
  private readonly tooltipBox: Phaser.GameObjects.Rectangle
  private readonly tooltipText: Phaser.GameObjects.Text
  private readonly badgeViews: EffectHudBadgeView[] = []
  private badgeDescriptors: EffectHudBadgeDescriptor[] = []
  private hoveredBadgeId: string | null = null

  constructor(private readonly scene: Phaser.Scene) {
    this.panel = scene.add.rectangle(0, 0, PANEL_WIDTH, 0, 0x020617, 0.82)
    this.panel.setOrigin(0)
    this.panel.setStrokeStyle(1, 0x334155, 0.95)
    this.panel.setDepth(10007)
    this.panel.setScrollFactor(0)

    this.rowLabels = {
      buff: this.createRowLabel('Buff'),
      debuff: this.createRowLabel('Debuff'),
      status: this.createRowLabel('Status'),
    }
    this.emptyTexts = {
      buff: this.createEmptyText(),
      debuff: this.createEmptyText(),
      status: this.createEmptyText(),
    }

    this.tooltipBox = scene.add.rectangle(0, 0, 0, 0, 0x020617, 0.96)
    this.tooltipBox.setOrigin(0)
    this.tooltipBox.setStrokeStyle(1, 0x94a3b8, 0.95)
    this.tooltipBox.setDepth(10010)
    this.tooltipBox.setScrollFactor(0)
    this.tooltipBox.setVisible(false)

    this.tooltipText = scene.add.text(0, 0, '', {
      color: '#e2e8f0',
      fontSize: '12px',
      fontFamily: 'monospace',
      lineSpacing: 4,
    })
    this.tooltipText.setDepth(10011)
    this.tooltipText.setScrollFactor(0)
    this.tooltipText.setVisible(false)
  }

  render(
    viewportWidth: number,
    viewportHeight: number,
    pointer: { x: number; y: number },
    params: {
      nowMs: number
      activeItemBuffs: ActiveItemBuffRuntime[]
      activeDebuffs: EffectDebuffRuntime[]
      poisoned: boolean
      guardBuffRemainingMs: number
      dead: boolean
    }
  ): void {
    const sections = {
      buff: buildBuffDescriptors(params.activeItemBuffs, params.nowMs),
      debuff: buildDebuffDescriptors(params.activeDebuffs, params.nowMs),
      status: buildStatusDescriptors(params),
    }
    this.badgeDescriptors = [...sections.buff, ...sections.debuff, ...sections.status]

    const panelHeight = PANEL_PADDING * 2 + ROW_HEIGHT * 3 + ROW_GAP * 2
    const panelX = viewportWidth - PANEL_WIDTH - 16
    const panelY = 16
    this.panel.setPosition(panelX, panelY)
    this.panel.setSize(PANEL_WIDTH, panelHeight)

    this.renderRow('buff', sections.buff, panelX, panelY, 0)
    this.renderRow('debuff', sections.debuff, panelX, panelY, 1)
    this.renderRow('status', sections.status, panelX, panelY, 2)
    this.hideUnusedBadges(this.badgeDescriptors.length)
    this.renderTooltip(viewportWidth, viewportHeight, pointer)
  }

  destroy(): void {
    this.panel.destroy()
    Object.values(this.rowLabels).forEach(text => text.destroy())
    Object.values(this.emptyTexts).forEach(text => text.destroy())
    this.tooltipBox.destroy()
    this.tooltipText.destroy()
    this.badgeViews.forEach(view => view.icon.destroy())
  }

  private renderRow(
    section: EffectHudSectionKey,
    badges: EffectHudBadgeDescriptor[],
    panelX: number,
    panelY: number,
    rowIndex: number
  ): void {
    const rowY = panelY + PANEL_PADDING + rowIndex * (ROW_HEIGHT + ROW_GAP)
    const label = this.rowLabels[section]
    label.setPosition(panelX + PANEL_PADDING, rowY + 4)
    label.setVisible(true)

    const emptyText = this.emptyTexts[section]
    emptyText.setPosition(panelX + PANEL_PADDING + LABEL_WIDTH, rowY + 4)
    emptyText.setVisible(badges.length === 0)
    emptyText.setText('none')

    badges.slice(0, MAX_BADGES_PER_ROW).forEach((badge, index) => {
      const view = this.getBadgeView(index + this.getRowOffset(section))
      const badgeX = panelX + PANEL_PADDING + LABEL_WIDTH + index * (BADGE_WIDTH + BADGE_GAP)
      const badgeY = rowY + 2

      view.icon.setTexture(badge.iconKey)
      view.icon.setPosition(badgeX + BADGE_WIDTH / 2, badgeY + BADGE_HEIGHT / 2)
      view.icon.setDisplaySize(BADGE_WIDTH, BADGE_HEIGHT)
      view.icon.setVisible(true)
      view.icon.setData('badgeId', badge.id)
    })

    for (let index = badges.length; index < MAX_BADGES_PER_ROW; index++) {
      const view = this.getBadgeView(index + this.getRowOffset(section))
      view.icon.setVisible(false)
    }
  }

  private renderTooltip(
    viewportWidth: number,
    viewportHeight: number,
    pointer: { x: number; y: number }
  ): void {
    const hovered = this.hoveredBadgeId
      ? this.badgeDescriptors.find(descriptor => descriptor.id === this.hoveredBadgeId) ?? null
      : null

    if (!hovered) {
      this.tooltipBox.setVisible(false)
      this.tooltipText.setVisible(false)
      return
    }

    this.tooltipText.setText([hovered.title, ...hovered.lines])
    const boxWidth = Math.min(260, this.tooltipText.width + TOOLTIP_PADDING * 2)
    const boxHeight = this.tooltipText.height + TOOLTIP_PADDING * 2
    const x = Math.min(viewportWidth - boxWidth - 12, Math.max(12, pointer.x - boxWidth - 12))
    const y = Math.min(viewportHeight - boxHeight - 12, Math.max(12, pointer.y + 12))

    this.tooltipBox.setVisible(true)
    this.tooltipBox.setPosition(x, y)
    this.tooltipBox.setSize(boxWidth, boxHeight)

    this.tooltipText.setVisible(true)
    this.tooltipText.setPosition(x + TOOLTIP_PADDING, y + TOOLTIP_PADDING)
  }

  private getBadgeView(index: number): EffectHudBadgeView {
    for (let current = this.badgeViews.length; current <= index; current++) {
      const icon = this.scene.add.image(0, 0, '')
      icon.setOrigin(0.5)
      icon.setDepth(10008)
      icon.setScrollFactor(0)
      icon.setInteractive({ useHandCursor: true })
      icon.on('pointerover', () => {
        this.hoveredBadgeId = icon.getData('badgeId') as string
      })
      icon.on('pointerout', () => {
        if (this.hoveredBadgeId === icon.getData('badgeId')) {
          this.hoveredBadgeId = null
        }
      })

      this.badgeViews.push({ icon })
    }

    return this.badgeViews[index]
  }

  private hideUnusedBadges(usedCount: number): void {
    for (let index = usedCount; index < this.badgeViews.length; index++) {
      this.badgeViews[index].icon.setVisible(false)
    }
  }

  private getRowOffset(section: EffectHudSectionKey): number {
    if (section === 'buff') {
      return 0
    }
    if (section === 'debuff') {
      return MAX_BADGES_PER_ROW
    }
    return MAX_BADGES_PER_ROW * 2
  }

  private createRowLabel(text: string): Phaser.GameObjects.Text {
    const label = this.scene.add.text(0, 0, text, {
      color: '#94a3b8',
      fontSize: '11px',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    })
    label.setDepth(10008)
    label.setScrollFactor(0)
    return label
  }

  private createEmptyText(): Phaser.GameObjects.Text {
    const text = this.scene.add.text(0, 0, '', {
      color: '#64748b',
      fontSize: '11px',
      fontFamily: 'monospace',
    })
    text.setDepth(10008)
    text.setScrollFactor(0)
    return text
  }
}

function buildBuffDescriptors(
  activeBuffs: ActiveItemBuffRuntime[],
  nowMs: number
): EffectHudBadgeDescriptor[] {
  return activeBuffs
    .filter(buff => buff.expiresAt > nowMs)
    .map(buff => {
      const definition = getBuffEffectDefinition(buff.itemDefinitionId)
      const resolved = definition.describe({
        remainingMs: buff.expiresAt - nowMs,
        statModifiers: getItemDefinition(buff.itemDefinitionId).statModifiers,
      })
      return {
        id: `buff:${buff.itemDefinitionId}`,
        iconKey: resolved.iconKey,
        title: resolved.title,
        lines: resolved.tooltipLines,
      }
    })
}

function buildDebuffDescriptors(
  activeDebuffs: EffectDebuffRuntime[],
  nowMs: number
): EffectHudBadgeDescriptor[] {
  return activeDebuffs
    .filter(debuff => debuff.expiresAt > nowMs)
    .map(debuff => {
      const definition = getDebuffEffectDefinition(debuff.id)
      const resolved = definition.describe({
        remainingMs: debuff.expiresAt - nowMs,
        damagePerSecond: debuff.damagePerSecond,
        statModifiers: debuff.statModifiers,
      })
      return {
        id: `debuff:${debuff.id}`,
        iconKey: resolved.iconKey,
        title: resolved.title,
        lines: resolved.tooltipLines,
      }
    })
}

function buildStatusDescriptors(params: {
  poisoned: boolean
  guardBuffRemainingMs: number
  dead: boolean
}): EffectHudBadgeDescriptor[] {
  const statuses: EffectHudBadgeDescriptor[] = []

  if (params.poisoned) {
    const definition = getStatusEffectDefinition(STATUS_EFFECT_IDS.poisoned)
    const resolved = definition.describe({})
    statuses.push({
      id: `status:${STATUS_EFFECT_IDS.poisoned}`,
      iconKey: resolved.iconKey,
      title: resolved.title,
      lines: resolved.tooltipLines,
    })
  }

  if (params.guardBuffRemainingMs > 0) {
    const definition = getStatusEffectDefinition(STATUS_EFFECT_IDS.guard)
    const resolved = definition.describe({
      remainingMs: params.guardBuffRemainingMs,
    })
    statuses.push({
      id: `status:${STATUS_EFFECT_IDS.guard}`,
      iconKey: resolved.iconKey,
      title: resolved.title,
      lines: resolved.tooltipLines,
    })
  }

  if (params.dead) {
    const definition = getStatusEffectDefinition(STATUS_EFFECT_IDS.dead)
    const resolved = definition.describe({})
    statuses.push({
      id: `status:${STATUS_EFFECT_IDS.dead}`,
      iconKey: resolved.iconKey,
      title: resolved.title,
      lines: resolved.tooltipLines,
    })
  }

  return statuses
}
