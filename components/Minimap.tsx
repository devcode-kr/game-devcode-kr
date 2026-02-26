'use client'

import { useEffect, useRef } from 'react'
import { BSPDungeon, TileType } from '../game/map/BSPDungeon'

interface MinimapProps {
  dungeon: BSPDungeon
  playerX: number
  playerY: number
  tileSize?: number
}

const MINIMAP_SIZE = 150
const COLORS: Record<TileType, string> = {
  [TileType.WALL]: '#222',
  [TileType.FLOOR]: '#4a6',
  [TileType.CORRIDOR]: '#6a8',
}

export function Minimap({ dungeon, playerX, playerY, tileSize = 2 }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !dungeon) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)

    const grid = dungeon.getGrid()
    const offsetX = (MINIMAP_SIZE - dungeon.width * tileSize) / 2
    const offsetY = (MINIMAP_SIZE - dungeon.height * tileSize) / 2

    // Draw dungeon
    for (let y = 0; y < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        const tile = grid[y][x]
        if (tile !== TileType.WALL) {
          ctx.fillStyle = COLORS[tile]
          ctx.fillRect(
            offsetX + x * tileSize,
            offsetY + y * tileSize,
            tileSize,
            tileSize
          )
        }
      }
    }

    // Draw player
    const px = Math.floor(playerX / 96) // TILE_W = 96
    const py = Math.floor(playerY / 48) // TILE_H = 48 (approximate for minimap)
    ctx.fillStyle = '#0ff'
    ctx.beginPath()
    ctx.arc(
      offsetX + px * tileSize + tileSize / 2,
      offsetY + py * tileSize + tileSize / 2,
      Math.max(2, tileSize),
      0,
      Math.PI * 2
    )
    ctx.fill()
  }, [dungeon, playerX, playerY, tileSize])

  return (
    <canvas
      ref={canvasRef}
      width={MINIMAP_SIZE}
      height={MINIMAP_SIZE}
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        border: '2px solid #444',
        borderRadius: 4,
        background: '#111',
      }}
    />
  )
}
