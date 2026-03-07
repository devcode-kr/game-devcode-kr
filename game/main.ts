import * as Phaser from 'phaser'
import { PreloadScene } from './scenes/PreloadScene'
import { GameScene } from './scenes/GameScene'

function getViewportScale(): number {
  if (typeof window === 'undefined') {
    return 1
  }

  return window.visualViewport?.scale ?? 1
}

export function getGameViewportSize(parent: HTMLElement): { width: number; height: number } {
  const scale = getViewportScale()

  return {
    width: Math.max(Math.round(parent.clientWidth * scale), 1),
    height: Math.max(Math.round(parent.clientHeight * scale), 1),
  }
}

export function createGame(parent: HTMLElement): Phaser.Game {
  const { width, height } = getGameViewportSize(parent)

  return new Phaser.Game({
    type: Phaser.AUTO,
    width,
    height,
    backgroundColor: '#0a0a1a',
    parent,
    scene: [PreloadScene, GameScene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
  })
}
