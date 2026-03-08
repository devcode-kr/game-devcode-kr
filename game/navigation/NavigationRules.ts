import * as Phaser from 'phaser'
import { cellCenter, screenToWorld, type IsoPoint } from '../iso'
import type { BSPDungeon } from '../map/BSPDungeon'
import { findAStarPath } from '../pathfinding/AStar'

export function tileKey(x: number, y: number): string {
  return `${x},${y}`
}

export function sampleWalkable(dungeon: BSPDungeon, x: number, y: number): boolean {
  return dungeon.isWalkable(Math.floor(x), Math.floor(y))
}

export function canOccupy(
  dungeon: BSPDungeon,
  x: number,
  y: number,
  playerRadius: number
): boolean {
  return sampleWalkable(dungeon, x, y) &&
    sampleWalkable(dungeon, x + playerRadius, y) &&
    sampleWalkable(dungeon, x - playerRadius, y) &&
    sampleWalkable(dungeon, x, y + playerRadius) &&
    sampleWalkable(dungeon, x, y - playerRadius)
}

export function canOccupyCell(
  dungeon: BSPDungeon,
  x: number,
  y: number,
  playerRadius: number
): boolean {
  const center = cellCenter(x, y)
  return canOccupy(dungeon, center.x, center.y, playerRadius)
}

export function findPathToTile(params: {
  dungeon: BSPDungeon
  current: IsoPoint
  targetCell: { x: number; y: number }
  playerRadius: number
  maxVisitedNodes: number
  isCellBlocked?: (x: number, y: number) => boolean
}) {
  const startTile = {
    x: Phaser.Math.Clamp(Math.floor(params.current.x), 0, params.dungeon.width - 1),
    y: Phaser.Math.Clamp(Math.floor(params.current.y), 0, params.dungeon.height - 1),
  }

  return findAStarPath(startTile, params.targetCell, {
    width: params.dungeon.width,
    height: params.dungeon.height,
    isWalkable: (x, y) => canOccupyCell(params.dungeon, x, y, params.playerRadius) && !params.isCellBlocked?.(x, y),
    maxVisitedNodes: params.maxVisitedNodes,
  })
}

export function getPathSearchBudget(
  visibleTileCount: number,
  multiplier: number,
  minimumBudget: number
): number {
  return Math.max(Math.ceil(visibleTileCount * multiplier), minimumBudget)
}

export function computeVisibleTiles(
  dungeon: BSPDungeon,
  current: IsoPoint,
  visibilityRadius: number
): Set<string> {
  const originX = Phaser.Math.Clamp(Math.floor(current.x), 0, dungeon.width - 1)
  const originY = Phaser.Math.Clamp(Math.floor(current.y), 0, dungeon.height - 1)
  const visibleTiles = new Set<string>()

  for (let y = originY - visibilityRadius; y <= originY + visibilityRadius; y++) {
    for (let x = originX - visibilityRadius; x <= originX + visibilityRadius; x++) {
      if (x < 0 || x >= dungeon.width || y < 0 || y >= dungeon.height) {
        continue
      }

      const distance = Phaser.Math.Distance.Between(originX, originY, x, y)
      if (distance > visibilityRadius) {
        continue
      }

      if (hasLineOfSight(dungeon, originX, originY, x, y)) {
        visibleTiles.add(tileKey(x, y))
      }
    }
  }

  visibleTiles.add(tileKey(originX, originY))
  return visibleTiles
}

export function pointerToTile(params: {
  screenX: number
  screenY: number
  viewportWidth: number
  viewportHeight: number
  playerWorld: IsoPoint
  dungeon: BSPDungeon
}): { x: number; y: number } | null {
  const localWorld = screenToWorld({
    x: params.screenX - params.viewportWidth / 2,
    y: params.screenY - params.viewportHeight / 2,
  })

  const tileX = Math.floor(params.playerWorld.x + localWorld.x)
  const tileY = Math.floor(params.playerWorld.y + localWorld.y)

  if (tileX < 0 || tileX >= params.dungeon.width || tileY < 0 || tileY >= params.dungeon.height) {
    return null
  }

  return { x: tileX, y: tileY }
}

function hasLineOfSight(
  dungeon: BSPDungeon,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): boolean {
  let x = fromX
  let y = fromY
  const dx = Math.abs(toX - fromX)
  const dy = Math.abs(toY - fromY)
  const stepX = fromX < toX ? 1 : -1
  const stepY = fromY < toY ? 1 : -1
  let error = dx - dy

  while (x !== toX || y !== toY) {
    if (!(x === fromX && y === fromY) && !dungeon.isWalkable(x, y)) {
      return false
    }

    const doubledError = error * 2
    if (doubledError > -dy) {
      error -= dy
      x += stepX
    }
    if (doubledError < dx) {
      error += dx
      y += stepY
    }
  }

  return dungeon.isWalkable(toX, toY)
}
