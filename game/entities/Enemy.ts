import * as Phaser from 'phaser'
import { BSPDungeon } from '../map/BSPDungeon'

const SPEED = 80
const CHASE_RANGE = 200
const SIZE = 24

export class Enemy extends Phaser.GameObjects.Container {
  private bodyRect!: Phaser.GameObjects.Rectangle
  private eyes!: Phaser.GameObjects.Ellipse[]
  private dungeon!: BSPDungeon
  private tileW: number
  private tileH: number

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    dungeon: BSPDungeon,
    tileW: number,
    tileH: number
  ) {
    super(scene, x, y)
    scene.add.existing(this)

    this.dungeon = dungeon
    this.tileW = tileW
    this.tileH = tileH
    this.setDepth(5000)

    // Body
    this.bodyRect = scene.add.rectangle(0, 0, SIZE, SIZE, 0xff4444)
    this.add(this.bodyRect)

    // Eyes
    const leftEye = scene.add.ellipse(-6, -4, 6, 8, 0xffffff)
    const rightEye = scene.add.ellipse(6, -4, 6, 8, 0xffffff)
    const leftPupil = scene.add.ellipse(-6, -3, 3, 5, 0x000000)
    const rightPupil = scene.add.ellipse(6, -3, 3, 5, 0x000000)

    this.eyes = [leftEye, rightEye, leftPupil, rightPupil]
    this.eyes.forEach((eye) => this.add(eye))

    // Shadow
    const shadow = scene.add.ellipse(0, 10, SIZE, 8, 0x000000, 0.4)
    shadow.setDepth(-1)
    this.add(shadow)
  }

  update(delta: number, playerX: number, playerY: number): void {
    const dt = delta / 1000

    // Distance to player
    const dx = playerX - this.x
    const dy = playerY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < CHASE_RANGE && dist > 5) {
      // Chase player
      let vx = (dx / dist) * SPEED
      let vy = (dy / dist) * SPEED

      // Collision check
      const newX = this.x + vx * dt
      const newY = this.y + vy * dt

      const gx = Math.floor(newX / this.tileW)
      const gy = Math.floor(newY / this.tileH)

      if (this.dungeon.isWalkable(gx, this.y / this.tileH)) {
        this.x = newX
      }
      if (this.dungeon.isWalkable(this.x / this.tileW, gy)) {
        this.y = newY
      }

      // Face player
      this.eyes.forEach((eye) => {
        eye.x += (dx / dist) * 2
        eye.y += (dy / dist) * 2
      })
    }

    // Idle animation - slight bob
    this.bodyRect.y = Math.sin(this.scene.time.now / 300) * 2
    this.eyes.forEach((eye) => {
      eye.y = -4 + Math.sin(this.scene.time.now / 300) * 2
    })
  }

  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y }
  }
}
