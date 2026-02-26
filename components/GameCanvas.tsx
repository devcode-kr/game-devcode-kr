'use client'

import { useEffect, useRef, useState } from 'react'
import type Phaser from 'phaser'
import { Minimap } from './Minimap'
import { BSPDungeon } from '../game/map/BSPDungeon'

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const [dungeon, setDungeon] = useState<BSPDungeon | null>(null)
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    import('../game/main').then(({ createGame, getGameScene }) => {
      if (!containerRef.current) return
      gameRef.current = createGame(containerRef.current)

      // Poll for scene initialization
      const checkScene = setInterval(() => {
        const scene = getGameScene()
        if (scene) {
          const d = scene.getDungeon()
          if (d) {
            setDungeon(d)
            clearInterval(checkScene)
          }
          // Set up player move callback
          scene.setOnPlayerMove((x, y) => {
            setPlayerPos({ x, y })
          })
        }
      }, 100)
    })

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  return (
    <div className="relative w-full h-full" style={{ minHeight: '600px' }}>
      <div ref={containerRef} className="w-full h-full" />
      {dungeon && (
        <Minimap
          dungeon={dungeon}
          playerX={playerPos.x}
          playerY={playerPos.y}
        />
      )}
    </div>
  )
}
