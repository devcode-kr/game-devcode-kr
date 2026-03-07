'use client'

import { useEffect, useRef } from 'react'
import type Phaser from 'phaser'

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    import('../game/main').then(({ applyGameDisplaySize, createGame, getGameViewportSize }) => {
      if (!containerRef.current) return
      gameRef.current = createGame(containerRef.current)

      const resizeGame = () => {
        const game = gameRef.current
        const container = containerRef.current
        if (!game || !container) return

        const { width, height } = getGameViewportSize(container)
        game.scale.resize(width, height)
        applyGameDisplaySize(game)
      }

      resizeObserverRef.current = new ResizeObserver(() => {
        resizeGame()
      })

      resizeObserverRef.current.observe(containerRef.current)
      resizeGame()
    })

    return () => {
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden"
    />
  )
}
