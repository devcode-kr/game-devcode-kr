import * as Phaser from 'phaser'
import {
  getEffectDefinitionsByKind,
  type EffectDefinition,
  type EffectIconPattern,
} from '../interactions/EffectDefinitions'

const ICON_SIZE = 28
const INNER_SIZE = 24
const CENTER = ICON_SIZE / 2

export function bakeEffectIconTextures(scene: Phaser.Scene): void {
  const definitions = [
    ...getEffectDefinitionsByKind('buff'),
    ...getEffectDefinitionsByKind('debuff'),
    ...getEffectDefinitionsByKind('status'),
  ]

  const baked = new Set<string>()
  for (const definition of definitions) {
    const { iconKey } = definition.getPresentation()
    if (baked.has(iconKey)) {
      continue
    }

    bakeEffectIconTexture(scene, definition)
    baked.add(iconKey)
  }
}

function bakeEffectIconTexture(scene: Phaser.Scene, definition: EffectDefinition): void {
  const { iconKey, fillColor, strokeColor, textColor, iconPattern } = definition.getPresentation()
  if (scene.textures.exists(iconKey)) {
    scene.textures.remove(iconKey)
  }

  const graphics = scene.make.graphics({ x: 0, y: 0 }, false)
  graphics.fillStyle(fillColor, 0.98)
  graphics.lineStyle(2, strokeColor, 1)
  graphics.fillRoundedRect(2, 2, INNER_SIZE, INNER_SIZE, 8)
  graphics.strokeRoundedRect(2, 2, INNER_SIZE, INNER_SIZE, 8)
  graphics.lineStyle(2.5, Phaser.Display.Color.HexStringToColor(textColor).color, 1)
  graphics.fillStyle(Phaser.Display.Color.HexStringToColor(textColor).color, 1)

  drawIconPattern(graphics, iconPattern)
  graphics.generateTexture(iconKey, ICON_SIZE, ICON_SIZE)
  graphics.destroy()
}

function drawIconPattern(graphics: Phaser.GameObjects.Graphics, pattern: EffectIconPattern): void {
  if (pattern === 'cross') {
    graphics.fillRect(CENTER - 2, 7, 4, 14)
    graphics.fillRect(7, CENTER - 2, 14, 4)
    return
  }

  if (pattern === 'drop') {
    graphics.fillTriangle(CENTER, 6, 8, 15, 20, 15)
    graphics.fillCircle(CENTER, 16.5, 5)
    return
  }

  if (pattern === 'shield') {
    graphics.beginPath()
    graphics.moveTo(CENTER, 6)
    graphics.lineTo(20, 9)
    graphics.lineTo(18, 17)
    graphics.lineTo(CENTER, 22)
    graphics.lineTo(10, 17)
    graphics.lineTo(8, 9)
    graphics.closePath()
    graphics.fillPath()
    return
  }

  if (pattern === 'spark') {
    graphics.fillTriangle(CENTER, 5, 16, 12, 12, 12)
    graphics.fillTriangle(12, 12, 19, 12, 10, 23)
    return
  }

  if (pattern === 'wing') {
    graphics.beginPath()
    graphics.moveTo(7, 16)
    graphics.lineTo(12, 8)
    graphics.lineTo(16, 11)
    graphics.lineTo(21, 7)
    graphics.lineTo(18, 17)
    graphics.lineTo(11, 20)
    graphics.closePath()
    graphics.fillPath()
    return
  }

  if (pattern === 'skull') {
    graphics.fillCircle(CENTER, 11, 6)
    graphics.fillRect(10, 15, 8, 5)
    graphics.fillStyle(0x020617, 1)
    graphics.fillCircle(11.5, 10.5, 1.4)
    graphics.fillCircle(16.5, 10.5, 1.4)
    graphics.fillTriangle(CENTER, 13, 12.5, 15.5, 15.5, 15.5)
    return
  }

  if (pattern === 'snare') {
    graphics.strokeCircle(CENTER, CENTER, 7)
    graphics.lineBetween(8, 8, 20, 20)
    graphics.lineBetween(20, 8, 8, 20)
    return
  }

  graphics.fillTriangle(CENTER, 6, 21, 20, 7, 20)
  graphics.fillStyle(0x020617, 1)
  graphics.fillCircle(CENTER, 18, 1.6)
}
