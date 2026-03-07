import * as Phaser from 'phaser'
import {
  AnimationStateMachine,
  type AnimationState,
} from '../animation/AnimationStateMachine'
import { MovementController, type MovementMode } from '../movement/MovementController'

const IDLE_BOB_SPEED = 0.0022
const RUN_BOB_SPEED = 0.011
const IDLE_BOB_HEIGHT = 1.5
const RUN_BOB_HEIGHT = 4

const SHEET_TEXTURE_KEY = 'player-test-sheet'
const DIRECTION_COUNT = 8
const IDLE_FRAME_COUNT = 2
const IDLE_FRAME_DURATION_MS = 420
const RUN_FRAME_COUNT = 3
const RUN_FRAME_DURATION_MS = 90
const PLAYER_SCALE = 1.25
const PLAYER_RUN_SCALE_Y = 1.21
const PLAYER_BASE_Y = 2

type FacingDirection =
  | 'north'
  | 'north-east'
  | 'east'
  | 'south-east'
  | 'south'
  | 'south-west'
  | 'west'
  | 'north-west'

const DIRECTION_TO_COLUMN: Record<FacingDirection, number> = {
  north: 0,
  'north-east': 1,
  east: 2,
  'south-east': 3,
  south: 4,
  'south-west': 5,
  west: 6,
  'north-west': 7,
}

export class Player extends Phaser.GameObjects.Container {
  private readonly controller = new MovementController()
  private readonly animation = new AnimationStateMachine()
  private readonly shadow: Phaser.GameObjects.Ellipse
  private readonly selectionRing: Phaser.GameObjects.Ellipse
  private readonly sprite: Phaser.GameObjects.Sprite
  private animationState: AnimationState = 'idle'
  private facingDirection: FacingDirection = 'south'

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0)

    this.shadow = scene.add.ellipse(0, 14, 28, 14, 0x000000, 0.35)
    this.selectionRing = scene.add.ellipse(0, 10, 24, 12)
    this.selectionRing.setStrokeStyle(2, 0xe6d28a, 0.9)

    this.sprite = scene.add.sprite(0, PLAYER_BASE_Y, SHEET_TEXTURE_KEY, 0)
    this.sprite.setOrigin(0.5, 0.96)
    this.sprite.setScale(PLAYER_SCALE)
    this.applyFrame()

    this.add([this.shadow, this.selectionRing, this.sprite])
    this.setDepth(9999)
    scene.add.existing(this)
  }

  setMapPosition(x: number, y: number): void {
    this.controller.setPosition(x, y)
  }

  commitMapPosition(x: number, y: number): void {
    this.controller.commitPosition(x, y)
  }

  getMapPosition(): Phaser.Math.Vector2 {
    return this.controller.getPosition()
  }

  setDestination(x: number, y: number): void {
    this.controller.setDestination(x, y)
  }

  clearDestination(): void {
    this.controller.clearDestination()
  }

  hasDestination(): boolean {
    return this.controller.hasDestination()
  }

  getMovementMode(): MovementMode {
    return this.controller.getMode()
  }

  getDestination(): Phaser.Math.Vector2 | null {
    return this.controller.getDestination()
  }

  getAnimationState(): AnimationState {
    return this.animationState
  }

  step(deltaMs: number, inputDirection: Phaser.Math.Vector2) {
    return this.controller.step(deltaMs, inputDirection)
  }

  syncScreenPosition(x: number, y: number, isMoving: boolean, deltaMs: number): void {
    const facing = this.controller.getFacing()
    this.animationState = this.animation.update(deltaMs, isMoving)
    this.facingDirection = this.resolveFacingDirection(facing)

    const bobSpeed = this.animationState === 'run' ? RUN_BOB_SPEED : IDLE_BOB_SPEED
    const bobAmount = this.animationState === 'run' ? RUN_BOB_HEIGHT : IDLE_BOB_HEIGHT
    const bob = Math.sin(this.animation.getElapsed() * bobSpeed) * bobAmount

    this.setPosition(x, y + bob)
    this.selectionRing.setStrokeStyle(
      2,
      this.animationState === 'run' ? 0xf4e3a3 : 0xe6d28a,
      this.animationState === 'run' ? 1 : 0.45
    )
    this.shadow.setScale(
      this.animationState === 'run' ? 0.86 : 1,
      this.animationState === 'run' ? 0.8 : 1
    )
    this.shadow.setAlpha(this.animationState === 'run' ? 0.42 : 0.32)

    const runSwing = this.animationState === 'run'
      ? Math.sin(this.animation.getElapsed() * 0.025) * 0.03
      : 0

    this.applyFrame()
    this.sprite.setScale(PLAYER_SCALE, this.animationState === 'run' ? PLAYER_RUN_SCALE_Y : PLAYER_SCALE)
    this.sprite.setRotation(runSwing)
    this.sprite.setY(PLAYER_BASE_Y - bob * 0.15)
  }

  private applyFrame(): void {
    const column = DIRECTION_TO_COLUMN[this.facingDirection]
    const row = this.animationState === 'run'
      ? 2 + (Math.floor(this.animation.getElapsed() / RUN_FRAME_DURATION_MS) % RUN_FRAME_COUNT)
      : Math.floor(this.animation.getElapsed() / IDLE_FRAME_DURATION_MS) % IDLE_FRAME_COUNT
    this.sprite.setFrame(row * DIRECTION_COUNT + column)
  }

  private resolveFacingDirection(facing: Phaser.Math.Vector2): FacingDirection {
    const angle = Phaser.Math.Angle.Normalize(Math.atan2(facing.y, facing.x) + Math.PI / 2)
    const octant = Math.round(angle / (Math.PI / 4)) % 8
    const directions: FacingDirection[] = [
      'north',
      'north-east',
      'east',
      'south-east',
      'south',
      'south-west',
      'west',
      'north-west',
    ]

    return directions[octant]
  }
}
