import * as Phaser from 'phaser'

const SPEED = 200

export class Player extends Phaser.GameObjects.Rectangle {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: {
    up: Phaser.Input.Keyboard.Key
    down: Phaser.Input.Keyboard.Key
    left: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 32, 32, 0x00ff88)
    scene.add.existing(this)

    this.cursors = scene.input.keyboard!.createCursorKeys()
    this.wasd = {
      up: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }
  }

  update(delta: number) {
    const dt = delta / 1000
    let vx = 0
    let vy = 0

    if (this.wasd.left.isDown || this.cursors.left.isDown) vx -= SPEED
    if (this.wasd.right.isDown || this.cursors.right.isDown) vx += SPEED
    if (this.wasd.up.isDown || this.cursors.up.isDown) vy -= SPEED
    if (this.wasd.down.isDown || this.cursors.down.isDown) vy += SPEED

    // 대각선 이동 시 속도 정규화
    if (vx !== 0 && vy !== 0) {
      vx *= 0.707
      vy *= 0.707
    }

    this.x = Phaser.Math.Clamp(this.x + vx * dt, 0, this.scene.scale.width)
    this.y = Phaser.Math.Clamp(this.y + vy * dt, 0, this.scene.scale.height)

    // Y좌표 기반 perspective 스케일 (가까울수록 크게)
    const normalized = this.y / this.scene.scale.height
    const scale = 0.5 + normalized * 0.8
    this.setScale(scale)

    // depth sorting: Y가 클수록 앞에 그림
    this.setDepth(this.y)
  }
}
