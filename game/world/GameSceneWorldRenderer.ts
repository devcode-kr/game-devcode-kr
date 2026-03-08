import * as Phaser from 'phaser'
import {
  HALF_TILE_HEIGHT,
  HALF_TILE_WIDTH,
  cellCenter,
  type IsoPoint,
  worldToScreen,
} from '../iso'
import { TileType, type BSPDungeon } from '../map/BSPDungeon'
import type { Interactable, Trap } from './WorldObjects'

export class GameSceneWorldRenderer {
  drawTiles(params: {
    dungeon: BSPDungeon
    tilePool: Phaser.GameObjects.Image[]
    playerScreen: IsoPoint
    width: number
    height: number
    getTileTexture: (tile: TileType, gx: number, gy: number) => string
  }): void {
    const grid = params.dungeon.getGrid()
    let poolIdx = 0

    for (let gy = 0; gy < params.dungeon.height; gy++) {
      for (let gx = 0; gx < params.dungeon.width; gx++) {
        const tile = grid[gy][gx]
        if (tile === TileType.WALL) continue

        const screen = worldToScreen(cellCenter(gx, gy))
        const sx = screen.x - params.playerScreen.x + params.width / 2
        const sy = screen.y - params.playerScreen.y + params.height / 2

        if (sx + HALF_TILE_WIDTH < 0 || sx - HALF_TILE_WIDTH > params.width) continue
        if (sy + HALF_TILE_HEIGHT < 0 || sy - HALF_TILE_HEIGHT > params.height) continue

        if (poolIdx < params.tilePool.length) {
          const image = params.tilePool[poolIdx++]
          image.setPosition(sx, sy)
          image.setDepth(100 + gx + gy)
          image.setTexture(params.getTileTexture(tile, gx, gy))
        }
      }
    }

    for (; poolIdx < params.tilePool.length; poolIdx++) {
      params.tilePool[poolIdx].setPosition(-9999, -9999)
    }
  }

  drawInteractables(params: {
    interactables: Interactable[]
    nearbyInteractableId: string | null
    playerScreen: IsoPoint
    width: number
    height: number
  }): void {
    for (const interactable of params.interactables) {
      const screen = worldToScreen(cellCenter(interactable.tileX, interactable.tileY))
      const sx = screen.x - params.playerScreen.x + params.width / 2
      const sy = screen.y - params.playerScreen.y + params.height / 2 - 18

      interactable.image.setVisible(true)
      interactable.image.setPosition(sx, sy)
      interactable.image.setDepth(500 + interactable.tileX + interactable.tileY)
      interactable.image.setAlpha(interactable.used ? 0.45 : 1)
      interactable.image.setScale(params.nearbyInteractableId === interactable.id ? 1.08 : 1)
    }
  }

  drawTraps(params: {
    traps: Trap[]
    nowMs: number
    trapRearmMs: number
    playerScreen: IsoPoint
    width: number
    height: number
  }): void {
    for (const trap of params.traps) {
      const screen = worldToScreen(cellCenter(trap.tileX, trap.tileY))
      const sx = screen.x - params.playerScreen.x + params.width / 2
      const sy = screen.y - params.playerScreen.y + params.height / 2 - 6
      const cooldownProgress = Phaser.Math.Clamp(
        (params.nowMs - trap.lastTriggeredAt) / params.trapRearmMs,
        0.25,
        1
      )

      trap.image.setVisible(true)
      trap.image.setPosition(sx, sy)
      trap.image.setDepth(210 + trap.tileX + trap.tileY)
      trap.image.setAlpha(cooldownProgress)
      trap.image.setScale(0.8 + cooldownProgress * 0.25)
    }
  }

  drawHoverMarker(params: {
    hoverMarker: Phaser.GameObjects.Ellipse
    hoveredTile: { x: number; y: number } | null
    dungeon: BSPDungeon
    playerScreen: IsoPoint
    width: number
    height: number
  }): void {
    if (params.hoveredTile && params.dungeon.isWalkable(params.hoveredTile.x, params.hoveredTile.y)) {
      const marker = worldToScreen(cellCenter(params.hoveredTile.x, params.hoveredTile.y))
      params.hoverMarker.setVisible(true)
      params.hoverMarker.setPosition(
        marker.x - params.playerScreen.x + params.width / 2,
        marker.y - params.playerScreen.y + params.height / 2
      )
      return
    }

    params.hoverMarker.setVisible(false)
  }

  drawPath(params: {
    pathGraphics: Phaser.GameObjects.Graphics
    playerWorld: IsoPoint
    pathPoints: IsoPoint[]
    playerScreen: IsoPoint
    width: number
    height: number
  }): void {
    params.pathGraphics.clear()

    if (params.pathPoints.length === 0) {
      return
    }

    const projected = [params.playerWorld, ...params.pathPoints].map(point => {
      const screen = worldToScreen(point)
      return new Phaser.Math.Vector2(
        screen.x - params.playerScreen.x + params.width / 2,
        screen.y - params.playerScreen.y + params.height / 2
      )
    })

    params.pathGraphics.lineStyle(2, 0xfbbf24, 0.9)
    params.pathGraphics.beginPath()
    params.pathGraphics.moveTo(projected[0].x, projected[0].y)

    for (let index = 1; index < projected.length; index++) {
      params.pathGraphics.lineTo(projected[index].x, projected[index].y)
    }

    params.pathGraphics.strokePath()

    for (let index = 1; index < projected.length; index++) {
      const point = projected[index]
      params.pathGraphics.fillStyle(index === projected.length - 1 ? 0xf97316 : 0xf8fafc, 0.95)
      params.pathGraphics.fillCircle(point.x, point.y, index === projected.length - 1 ? 5 : 4)
      params.pathGraphics.lineStyle(1, 0x111827, 0.8)
      params.pathGraphics.strokeCircle(point.x, point.y, index === projected.length - 1 ? 5 : 4)
    }
  }
}
