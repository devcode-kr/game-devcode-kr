import * as Phaser from 'phaser'
import type { Character } from './Character'
import type { MovementMode, MovementSnapshot } from '../movement/MovementController'

export interface CharacterMover {
  getMapPosition(): Phaser.Math.Vector2
  step(deltaMs: number, inputDirection: Phaser.Math.Vector2): MovementSnapshot
  commitMapPosition(x: number, y: number): void
  clearDestination(): void
  hasDestination(): boolean
}

export interface CharacterMovementRuntimeResult {
  movement: MovementSnapshot
  appliedPosition: Phaser.Math.Vector2
  input: Phaser.Math.Vector2
  isMoving: boolean
  blockedClickMove: boolean
}

export function updateCharacterMovement(params: {
  character: Character
  mover: CharacterMover
  deltaMs: number
  inputDirection: Phaser.Math.Vector2
  canOccupy: (x: number, y: number) => boolean
}): CharacterMovementRuntimeResult {
  const input = params.character.canMove()
    ? params.inputDirection
    : new Phaser.Math.Vector2()
  const movement = params.mover.step(params.deltaMs, input)
  const current = params.mover.getMapPosition()
  let nextX = current.x
  let nextY = current.y
  let blockedClickMove = false

  if (movement.velocity.lengthSq() > 0) {
    if (params.canOccupy(movement.nextPosition.x, current.y)) {
      nextX = movement.nextPosition.x
    }
    if (params.canOccupy(nextX, movement.nextPosition.y)) {
      nextY = movement.nextPosition.y
    }

    blockedClickMove = nextX === current.x &&
      nextY === current.y &&
      movement.mode === 'click-move'
  }

  params.mover.commitMapPosition(nextX, nextY)

  return {
    movement,
    appliedPosition: new Phaser.Math.Vector2(nextX, nextY),
    input,
    isMoving: movement.velocity.lengthSq() > 0,
    blockedClickMove,
  }
}

export function isCharacterMovementArrived(
  movementMode: MovementMode,
  hasDestination: boolean
): boolean {
  return movementMode === 'click-move' && !hasDestination
}
