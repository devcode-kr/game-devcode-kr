import * as Phaser from 'phaser'
import { PreloadScene } from './scenes/PreloadScene'
import { GameScene } from './scenes/GameScene'

export function createGame(parent: HTMLElement): Phaser.Game {
  const width = Math.max(parent.clientWidth, 1)
  const height = Math.max(parent.clientHeight, 1)

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
