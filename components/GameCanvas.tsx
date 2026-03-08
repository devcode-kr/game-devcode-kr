'use client'

import { useEffect, useRef, useState } from 'react'
import type Phaser from 'phaser'

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [fatalDetails, setFatalDetails] = useState<string[]>([])

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
        import('../game/BootstrapDiagnostics')
          .then(({ diagnoseGameBootstrap }) => diagnoseGameBootstrap(error))
          .then(report => {
            const lines = [
              `root: ${report.error}`,
              `failed step: ${report.failedStep ?? 'unknown'}`,
              ...report.steps.map(step =>
                step.ok
                  ? `[ok] ${step.label}`
                  : `[fail] ${step.label}: ${step.error ?? 'unknown error'}`
              ),
            ]
            console.error('game bootstrap diagnostics', lines)
            setFatalDetails(lines)
          })
          .catch(diagnosticError => {
            const message = diagnosticError instanceof Error
              ? `${diagnosticError.name}: ${diagnosticError.message}`
              : String(diagnosticError)
            console.error('game bootstrap diagnostics failed', diagnosticError)
            setFatalDetails([
              `root: ${error instanceof Error ? error.message : String(error)}`,
              `diagnostics failed: ${message}`,
            ])
          })
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
            {fatalDetails.length > 0 ? (
              <pre className="mt-4 overflow-auto rounded bg-black/40 p-4 text-left text-xs text-[#cbd5e1]">
                {fatalDetails.join('\n')}
              </pre>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
