import * as Phaser from 'phaser'
import { CharacterController } from '../characters/CharacterController'
import { PlayerCharacter } from '../characters/PlayerCharacter'
import {
  isCharacterMovementArrived,
  updateCharacterMovement,
  type CharacterMovementRuntimeResult,
} from '../characters/CharacterMovementRuntime'
import { cellCenter } from '../iso'
import { TileType, type BSPDungeon } from '../map/BSPDungeon'
import {
  canOccupy,
  canOccupyCell,
  computeVisibleTiles,
  findPathToTile,
  getPathSearchBudget,
  pointerToTile,
} from './NavigationRules'

interface MonsterOccupant {
  id: string
  controller: CharacterController
}

export class SceneNavigationRuntime {
  private readonly inputVector = new Phaser.Math.Vector2()
  private visibleTiles = new Set<string>()
  private pathStatus = 'idle'

  constructor(
    private readonly playerCharacter: PlayerCharacter,
    private readonly playerController: CharacterController,
    private readonly getDungeon: () => BSPDungeon,
    private readonly getMonsters: () => MonsterOccupant[],
    private readonly config: {
      monsterBodyRadius: number
      pathSearchBudgetMultiplier: number
      minPathSearchBudget: number
    }
  ) {}

  getVisibleTilesCount(): number {
    return this.visibleTiles.size
  }

  getPathStatus(): string {
    return this.pathStatus
  }

  getPathSearchBudget(): number {
    return getPathSearchBudget(
      this.visibleTiles.size,
      this.config.pathSearchBudgetMultiplier,
      this.config.minPathSearchBudget
    )
  }

  getTileTexture(tile: TileType, gx: number, gy: number): string {
    if (tile === TileType.CORRIDOR) {
      return 'tile-corridor'
    }

    return (gx + gy) % 2 === 0 ? 'tile-a' : 'tile-b'
  }

  updateMovement(params: {
    deltaMs: number
    blocked: boolean
    wasd: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>
    cursors: Phaser.Types.Input.Keyboard.CursorKeys
  }): CharacterMovementRuntimeResult {
    const movementResult = updateCharacterMovement({
      character: this.playerCharacter,
      mover: this.playerController,
      deltaMs: params.deltaMs,
      inputDirection: params.blocked ? new Phaser.Math.Vector2() : this.readInputVector(params.wasd, params.cursors),
      canOccupy: (x, y) => this.canOccupy(x, y),
    })

    if (movementResult.blockedClickMove) {
      const repathed = this.repathToActiveGoal()
      if (!repathed) {
        this.playerController.clearDestination()
        this.pathStatus = 'path failed: repath unavailable'
      }
    }

    if (movementResult.input.lengthSq() > 0) {
      this.pathStatus = 'manual override'
    } else if (isCharacterMovementArrived(movementResult.movement.mode, this.playerController.hasDestination())) {
      this.pathStatus = 'arrived'
    }

    return movementResult
  }

  resolvePointerTile(params: {
    screenX: number
    screenY: number
    viewportWidth: number
    viewportHeight: number
  }): { x: number; y: number } | null {
    return pointerToTile({
      screenX: params.screenX,
      screenY: params.screenY,
      viewportWidth: params.viewportWidth,
      viewportHeight: params.viewportHeight,
      playerWorld: this.playerController.getMapPosition(),
      dungeon: this.getDungeon(),
    })
  }

  tryApplyClickMove(targetCell: { x: number; y: number }, successStatus: string): boolean {
    if (!this.canOccupyCell(targetCell.x, targetCell.y)) {
      this.playerController.clearDestination()
      this.pathStatus = 'path failed: blocked target'
      return false
    }

    return this.applyPathToTile(targetCell, successStatus)
  }

  handleOutOfBoundsClick(): void {
    this.playerController.clearDestination()
    this.pathStatus = 'path failed: out of bounds'
  }

  faceTowardCell(targetCell: { x: number; y: number }): void {
    const origin = this.playerController.getMapPosition()
    const target = cellCenter(targetCell.x, targetCell.y)
    const facing = new Phaser.Math.Vector2(target.x - origin.x, target.y - origin.y)
    if (facing.lengthSq() === 0) {
      return
    }

    this.playerController.setFacing(facing.x, facing.y)
    this.playerController.clearDestination()
  }

  canMonsterOccupy(monsterId: string, x: number, y: number): boolean {
    return canOccupy(this.getDungeon(), x, y, this.config.monsterBodyRadius) &&
      !this.isBlockedByPlayerActor(x, y, this.config.monsterBodyRadius) &&
      !this.isBlockedByOtherMonsters(monsterId, x, y, this.config.monsterBodyRadius)
  }

  refreshVisibility(): void {
    this.visibleTiles = computeVisibleTiles(
      this.getDungeon(),
      this.playerController.getMapPosition(),
      this.playerCharacter.getVisionRadius()
    )
  }

  private readInputVector(
    wasd: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>,
    cursors: Phaser.Types.Input.Keyboard.CursorKeys
  ): Phaser.Math.Vector2 {
    let screenX = 0
    let screenY = 0

    if (wasd.left.isDown || cursors.left.isDown) screenX -= 1
    if (wasd.right.isDown || cursors.right.isDown) screenX += 1
    if (wasd.up.isDown || cursors.up.isDown) screenY -= 1
    if (wasd.down.isDown || cursors.down.isDown) screenY += 1

    this.inputVector.set(screenX + screenY, screenY - screenX)

    if (this.inputVector.lengthSq() > 0) {
      this.inputVector.normalize()
    }

    return this.inputVector.clone()
  }

  private canOccupy(x: number, y: number): boolean {
    const radius = this.playerController.getBodyRadius()
    return canOccupy(this.getDungeon(), x, y, radius) &&
      !this.isBlockedByMonsterActors(x, y, radius)
  }

  private canOccupyCell(x: number, y: number): boolean {
    const radius = this.playerController.getBodyRadius()
    return canOccupyCell(this.getDungeon(), x, y, radius) &&
      !this.isBlockedByMonsterActors(cellCenter(x, y).x, cellCenter(x, y).y, radius)
  }

  private applyPathToTile(targetCell: { x: number; y: number }, successStatus: string): boolean {
    const result = this.findPathToTile(targetCell)
    if (!result.path) {
      this.playerController.clearDestination()
      this.pathStatus = result.exhaustedSearchBudget
        ? `path failed: search budget exceeded (${result.visitedNodes})`
        : 'path failed: no route'
      return false
    }

    if (result.path.length <= 1) {
      this.playerController.clearDestination()
      this.pathStatus = 'already at target'
      return false
    }

    this.playerController.setPath(result.path.slice(1).map(node => cellCenter(node.x, node.y)))
    this.pathStatus = `${successStatus} (${result.path.length - 1} nodes / budget ${this.getPathSearchBudget()})`
    return true
  }

  private repathToActiveGoal(): boolean {
    const goal = this.playerController.getFinalDestination()
    if (!goal) {
      return false
    }

    const dungeon = this.getDungeon()
    const goalTile = {
      x: Phaser.Math.Clamp(Math.floor(goal.x), 0, dungeon.width - 1),
      y: Phaser.Math.Clamp(Math.floor(goal.y), 0, dungeon.height - 1),
    }

    const repathed = this.applyPathToTile(goalTile, 'repath ready')
    if (repathed) {
      this.pathStatus = `${this.pathStatus} after blockage`
    }

    return repathed
  }

  private findPathToTile(targetCell: { x: number; y: number }) {
    return findPathToTile({
      dungeon: this.getDungeon(),
      current: this.playerController.getMapPosition(),
      targetCell,
      playerRadius: this.playerController.getBodyRadius(),
      maxVisitedNodes: this.getPathSearchBudget(),
      isCellBlocked: (x, y) =>
        this.isBlockedByMonsterActors(cellCenter(x, y).x, cellCenter(x, y).y, this.playerController.getBodyRadius()),
    })
  }

  private isBlockedByPlayerActor(x: number, y: number, radius: number): boolean {
    const playerPosition = this.playerController.getMapPosition()
    return Phaser.Math.Distance.Between(x, y, playerPosition.x, playerPosition.y) <
      radius + this.playerController.getBodyRadius()
  }

  private isBlockedByMonsterActors(x: number, y: number, radius: number): boolean {
    return this.getMonsters().some(monster => {
      const position = monster.controller.getMapPosition()
      return Phaser.Math.Distance.Between(x, y, position.x, position.y) <
        radius + monster.controller.getBodyRadius()
    })
  }

  private isBlockedByOtherMonsters(monsterId: string, x: number, y: number, radius: number): boolean {
    return this.getMonsters().some(monster => {
      if (monster.id === monsterId) {
        return false
      }

      const position = monster.controller.getMapPosition()
      return Phaser.Math.Distance.Between(x, y, position.x, position.y) <
        radius + monster.controller.getBodyRadius()
    })
  }
}
