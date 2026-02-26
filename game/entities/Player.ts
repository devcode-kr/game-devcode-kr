import * as Phaser from 'phaser'

const SPEED = 200

export class Player extends Phaser.GameObjects.Rectangle {
  private wasd!: {
    up: Phaser.Input.Keyboard.Key
    down: Phaser.Input.Keyboard.Key
    left: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
  }
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 32, 32, 0x00ff88)
    scene.add.existing(this)

    this.wasd = {
      up: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }
    this.cursors = scene.input.keyboard!.createCursorKeys()

    // 항상 고정 depth (화면 위에)
    this.setDepth(9999)
  }

  update(delta: number): { vx: number; vy: number } {
    const dt = delta / 1000
    let vx = 0
    let vy = 0

    if (this.wasd.left.isDown || this.cursors.left.isDown) vx -= SPEED
    if (this.wasd.right.isDown || this.cursors.right.isDown) vx += SPEED
    if (this.wasd.up.isDown || this.cursors.up.isDown) vy -= SPEED
    if (this.wasd.down.isDown || this.cursors.down.isDown) vy += SPEED

    // 대각선 정규화
    if (vx !== 0 && vy !== 0) {
      vx *= 0.707
      vy *= 0.707
    }

    return { vx: vx * dt, vy: vy * dt }
  }
}
