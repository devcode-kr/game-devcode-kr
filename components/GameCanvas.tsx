'use client'

import { useEffect, useRef } from 'react'
import type Phaser from 'phaser'

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    import('../game/main').then(({ createGame }) => {
      if (!containerRef.current) return
      gameRef.current = createGame(containerRef.current)
    })

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: '600px' }}
    />
  )
}
