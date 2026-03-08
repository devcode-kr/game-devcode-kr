import * as Phaser from 'phaser'

export class Summon extends Phaser.GameObjects.Container {
  private readonly shadow: Phaser.GameObjects.Ellipse
  private readonly bodyShape: Phaser.GameObjects.Ellipse
  private readonly core: Phaser.GameObjects.Ellipse

  constructor(scene: Phaser.Scene, fillColor: number, strokeColor: number) {
    super(scene, 0, 0)

    this.shadow = scene.add.ellipse(0, 10, 18, 10, 0x000000, 0.26)
    this.bodyShape = scene.add.ellipse(0, 0, 18, 20, fillColor, 0.95)
    this.bodyShape.setStrokeStyle(2, strokeColor, 0.95)
    this.core = scene.add.ellipse(0, -1, 7, 7, 0xf8fafc, 0.95)

    this.add([this.shadow, this.bodyShape, this.core])
    this.setDepth(8800)
    scene.add.existing(this)
  }

  syncScreenPosition(x: number, y: number, nowMs: number): void {
    const bob = Math.sin(nowMs * 0.006) * 2.2
    this.setPosition(x, y + bob)
  }
}
