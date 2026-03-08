import * as Phaser from 'phaser'
import {
  AnimationStateMachine,
  type AnimationState,
} from '../animation/AnimationStateMachine'

const IDLE_BOB_SPEED = 0.002
const WALK_BOB_SPEED = 0.01
const IDLE_BOB_HEIGHT = 1.2
const WALK_BOB_HEIGHT = 3.2

export class Monster extends Phaser.GameObjects.Container {
  private readonly animation = new AnimationStateMachine()
  private readonly shadow: Phaser.GameObjects.Ellipse
  private readonly bodyShape: Phaser.GameObjects.Ellipse
  private readonly eyeLeft: Phaser.GameObjects.Ellipse
  private readonly eyeRight: Phaser.GameObjects.Ellipse
  private animationState: AnimationState = 'idle'

  constructor(
    scene: Phaser.Scene,
    palette: { fillColor: number; strokeColor: number } = {
      fillColor: 0x9f1239,
      strokeColor: 0xfda4af,
    }
  ) {
    super(scene, 0, 0)

    this.shadow = scene.add.ellipse(0, 12, 24, 12, 0x000000, 0.3)
    this.bodyShape = scene.add.ellipse(0, 0, 22, 24, palette.fillColor, 1)
    this.bodyShape.setStrokeStyle(2, palette.strokeColor, 0.9)
    this.eyeLeft = scene.add.ellipse(-4, -3, 3, 4, 0xf8fafc, 0.95)
    this.eyeRight = scene.add.ellipse(4, -3, 3, 4, 0xf8fafc, 0.95)

    this.add([this.shadow, this.bodyShape, this.eyeLeft, this.eyeRight])
    this.setDepth(9000)
    scene.add.existing(this)
  }

  syncScreenPosition(x: number, y: number, isMoving: boolean, deltaMs: number): void {
    this.animationState = this.animation.update(deltaMs, isMoving)
    const bobSpeed = this.animationState === 'run' ? WALK_BOB_SPEED : IDLE_BOB_SPEED
    const bobAmount = this.animationState === 'run' ? WALK_BOB_HEIGHT : IDLE_BOB_HEIGHT
    const bob = Math.sin(this.animation.getElapsed() * bobSpeed) * bobAmount

    this.setPosition(x, y + bob)
    this.shadow.setAlpha(isMoving ? 0.38 : 0.28)
    this.bodyShape.setScale(1, isMoving ? 0.96 : 1)
  }
}
