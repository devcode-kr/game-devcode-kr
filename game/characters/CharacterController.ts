import * as Phaser from 'phaser'
import type { Character } from './Character'
import { MovementController, type MovementMode, type MovementSnapshot } from '../movement/MovementController'

export interface AreaHitResult {
  hit: boolean
  distanceFromCenter: number
  distanceFromEdge: number
  overlapRadius: number
}

export class CharacterController {
  private readonly movement = new MovementController()

  constructor(
    private readonly character: Character,
    private readonly bodyRadius: number = 0.24
  ) {}

  getCharacter(): Character {
    return this.character
  }

  getBodyRadius(): number {
    return this.bodyRadius
  }

  setMapPosition(x: number, y: number): void {
    this.movement.setPosition(x, y)
  }

  commitMapPosition(x: number, y: number): void {
    this.movement.commitPosition(x, y)
  }

  getMapPosition(): Phaser.Math.Vector2 {
    return this.movement.getPosition()
  }

  getFacing(): Phaser.Math.Vector2 {
    return this.movement.getFacing()
  }

  setFacing(x: number, y: number): void {
    this.movement.setFacing(x, y)
  }

  getFacingLabel(): string {
    const facing = this.getFacing()
    const angle = Phaser.Math.Angle.Normalize(Math.atan2(facing.y, facing.x) + Math.PI / 2)
    const octant = Math.round(angle / (Math.PI / 4)) % 8
    const directions = [
      'north',
      'north-east',
      'east',
      'south-east',
      'south',
      'south-west',
      'west',
      'north-west',
    ] as const

    return directions[octant]
  }

  setDestination(x: number, y: number): void {
    this.movement.setDestination(x, y)
  }

  setPath(points: Array<{ x: number; y: number }>): void {
    this.movement.setPath(points)
  }

  clearDestination(): void {
    this.movement.clearDestination()
  }

  hasDestination(): boolean {
    return this.movement.hasDestination()
  }

  getMovementMode(): MovementMode {
    return this.movement.getMode()
  }

  getDestination(): Phaser.Math.Vector2 | null {
    return this.movement.getDestination()
  }

  getFinalDestination(): Phaser.Math.Vector2 | null {
    return this.movement.getFinalDestination()
  }

  getPathLength(): number {
    return this.movement.getPathLength()
  }

  getPathPoints(): Phaser.Math.Vector2[] {
    return this.movement.getPathPoints()
  }

  syncMoveSpeedFromCharacter(): void {
    this.movement.setMoveSpeed(this.character.getMoveDistance(1000))
  }

  evaluateAreaHit(centerX: number, centerY: number, radius: number): AreaHitResult {
    const position = this.getMapPosition()
    const distanceFromCenter = Phaser.Math.Distance.Between(centerX, centerY, position.x, position.y)
    const overlapRadius = Math.max(0, radius + this.bodyRadius - distanceFromCenter)

    return {
      hit: overlapRadius > 0,
      distanceFromCenter,
      distanceFromEdge: Math.max(0, distanceFromCenter - this.bodyRadius),
      overlapRadius,
    }
  }

  step(deltaMs: number, inputDirection: Phaser.Math.Vector2): MovementSnapshot {
    this.syncMoveSpeedFromCharacter()
    return this.movement.step(deltaMs, inputDirection)
  }
}
