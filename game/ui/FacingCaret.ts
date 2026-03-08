import * as Phaser from 'phaser'
import { worldToScreen } from '../iso'

const CARET_DISTANCE = 26
const CARET_LENGTH = 14

export class FacingCaret {
  private readonly stem: Phaser.GameObjects.Line
  private readonly head: Phaser.GameObjects.Triangle

  constructor(private readonly scene: Phaser.Scene) {
    this.stem = scene.add.line(0, 0, 0, 0, 0, -CARET_LENGTH, 0xfbbf24, 0.95)
    this.stem.setLineWidth(2, 2)
    this.stem.setDepth(10001)
    this.stem.setScrollFactor(0)

    this.head = scene.add.triangle(0, 0, 0, -8, 7, 6, -7, 6, 0xfbbf24, 0.98)
    this.head.setStrokeStyle(2, 0xfffbeb, 0.95)
    this.head.setDepth(10002)
    this.head.setScrollFactor(0)
  }

  render(centerX: number, centerY: number, facingX: number, facingY: number): void {
    const screenDirection = worldToScreen({ x: facingX, y: facingY })
    const direction = new Phaser.Math.Vector2(screenDirection.x, screenDirection.y)
    if (direction.lengthSq() === 0) {
      direction.set(0, 1)
    } else {
      direction.normalize()
    }

    const anchorX = centerX + direction.x * CARET_DISTANCE
   const anchorY = centerY + direction.y * CARET_DISTANCE
    const rotation = direction.angle() + Math.PI / 2

    this.stem.setPosition(anchorX, anchorY)
    this.stem.setTo(0, 0, direction.x * CARET_LENGTH, direction.y * CARET_LENGTH)
    this.head.setPosition(anchorX + direction.x * CARET_LENGTH, anchorY + direction.y * CARET_LENGTH)
    this.head.setRotation(rotation)
  }

  destroy(): void {
    this.stem.destroy()
    this.head.destroy()
  }
}
