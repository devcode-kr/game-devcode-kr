import * as Phaser from 'phaser'
import type { ProjectilePresentation } from '../interactions/ProjectileDefinitions'

export class Projectile extends Phaser.GameObjects.Ellipse {
  constructor(scene: Phaser.Scene, presentation: ProjectilePresentation) {
    super(scene, 0, 0, presentation.width, presentation.height, presentation.fillColor, 1)
    this.setStrokeStyle(2, presentation.strokeColor, 0.95)
    this.setDepth(9200)
    scene.add.existing(this)
  }

  syncScreenPosition(x: number, y: number): void {
    this.setPosition(x, y)
  }
}
