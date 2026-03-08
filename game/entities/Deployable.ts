import * as Phaser from 'phaser'
import type { DeployablePresentation } from '../interactions/DeployableDefinitions'

export class Deployable extends Phaser.GameObjects.Container {
  private readonly shadow: Phaser.GameObjects.Ellipse
  private readonly bodyShape: Phaser.GameObjects.Ellipse

  constructor(scene: Phaser.Scene, presentation: DeployablePresentation) {
    super(scene, 0, 0)

    this.shadow = scene.add.ellipse(0, 8, presentation.width, 10, 0x000000, 0.28)
    this.bodyShape = scene.add.ellipse(0, -2, presentation.width, presentation.height, presentation.fillColor, 1)
    this.bodyShape.setStrokeStyle(2, presentation.strokeColor, 0.95)

    this.add([this.shadow, this.bodyShape])
    this.setDepth(8500)
    scene.add.existing(this)
  }

  syncScreenPosition(x: number, y: number, timeLeftRatio: number): void {
    this.setPosition(x, y)
    this.bodyShape.setAlpha(0.65 + timeLeftRatio * 0.35)
    this.shadow.setAlpha(0.16 + timeLeftRatio * 0.18)
  }
}
