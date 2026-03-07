import * as Phaser from 'phaser'
import { PreloadScene } from './scenes/PreloadScene'
import { GameScene } from './scenes/GameScene'

const BASE_RENDER_HEIGHT = 600

export function getGameViewportSize(parent: HTMLElement): { width: number; height: number } {
  const width = Math.max(parent.clientWidth, 1)
  const height = Math.max(parent.clientHeight, 1)
  const aspectRatio = width / height

  return {
    width: Math.max(Math.round(BASE_RENDER_HEIGHT * aspectRatio), 1),
    height: BASE_RENDER_HEIGHT,
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
