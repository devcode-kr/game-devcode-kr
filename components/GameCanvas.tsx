'use client'

import { useEffect, useRef, useState } from 'react'
import type Phaser from 'phaser'

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    import('../game/main')
      .then(({ applyGameDisplaySize, createGame, getGameViewportSize }) => {
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
      .catch(error => {
        console.error('game bootstrap failed', error)
        setFatalError(error instanceof Error ? error.message : 'unknown bootstrap error')
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
      className="relative w-full h-full overflow-hidden"
    >
      {fatalError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#140f19] text-[#f8fafc]">
          <div className="max-w-[720px] px-6 text-center">
            <h1 className="text-lg font-semibold">Game bootstrap failed</h1>
            <p className="mt-2 text-sm text-[#cbd5e1]">{fatalError}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
