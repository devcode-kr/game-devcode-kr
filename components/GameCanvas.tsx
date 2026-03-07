'use client'

import { useEffect, useRef } from 'react'
import type Phaser from 'phaser'

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    import('../game/main').then(({ createGame }) => {
      if (!containerRef.current) return
      gameRef.current = createGame(containerRef.current)

      resizeObserverRef.current = new ResizeObserver(entries => {
        const entry = entries[0]
        const game = gameRef.current
        if (!entry || !game) return

        const width = Math.max(Math.floor(entry.contentRect.width), 1)
        const height = Math.max(Math.floor(entry.contentRect.height), 1)
        game.scale.resize(width, height)
      })

      resizeObserverRef.current.observe(containerRef.current)
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
