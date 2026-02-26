import * as Phaser from 'phaser'

const PORTAL_SIZE = 32

export class Portal extends Phaser.GameObjects.Container {
  private glow!: Phaser.GameObjects.Ellipse
  private base!: Phaser.GameObjects.Ellipse
  private particles: Phaser.GameObjects.Ellipse[] = []

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y)
    scene.add.existing(this)

    this.setDepth(100)

    // Glow effect (outer)
    this.glow = scene.add.ellipse(0, 0, PORTAL_SIZE + 16, PORTAL_SIZE + 8, 0x8800ff, 0.3)
    this.add(this.glow)

    // Base portal
    this.base = scene.add.ellipse(0, 0, PORTAL_SIZE, PORTAL_SIZE * 0.6, 0xaa00ff, 0.8)
    this.add(this.base)

    // Inner swirl
    const inner = scene.add.ellipse(0, 0, PORTAL_SIZE * 0.6, PORTAL_SIZE * 0.4, 0xdd00ff, 0.9)
    this.add(inner)

    // Floating particles
    for (let i = 0; i < 4; i++) {
      const p = scene.add.ellipse(
        (Math.random() - 0.5) * PORTAL_SIZE,
        (Math.random() - 0.5) * PORTAL_SIZE * 0.5,
        4,
        4,
        0xff88ff,
        0.8
      )
      this.particles.push(p)
      this.add(p)
    }

    // Animation tween
    scene.tweens.add({
      targets: this.glow,
      scaleX: 1.2,
      scaleY: 1.2,
      alpha: 0.5,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  update(time: number): void {
    // Rotate particles
    this.particles.forEach((p, i) => {
      const angle = (time / 1000 + i * (Math.PI / 2)) % (Math.PI * 2)
      const radius = PORTAL_SIZE * 0.3
      p.x = Math.cos(angle) * radius
      p.y = Math.sin(angle) * radius * 0.5
    })

    // Pulse inner
    const scale = 1 + Math.sin(time / 500) * 0.1
    this.base.setScale(scale, scale)
  }

  getCollisionBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.x - PORTAL_SIZE / 2,
      y: this.y - (PORTAL_SIZE * 0.6) / 2,
      width: PORTAL_SIZE,
      height: PORTAL_SIZE * 0.6,
    }
  }

  checkCollision(playerX: number, playerY: number): boolean {
    const bounds = this.getCollisionBounds()
    return (
      playerX >= bounds.x &&
      playerX <= bounds.x + bounds.width &&
      playerY >= bounds.y &&
      playerY <= bounds.y + bounds.height
    )
  }
}
