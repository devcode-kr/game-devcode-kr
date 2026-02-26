import * as Phaser from 'phaser'
import { PreloadScene } from './scenes/PreloadScene'
import { GameScene } from './scenes/GameScene'

let gameInstance: Phaser.Game | null = null

export function createGame(parent: HTMLElement): Phaser.Game {
  gameInstance = new Phaser.Game({
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#0a0a1a',
    parent,
    scene: [PreloadScene, GameScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
  })
  return gameInstance
}

export function getGameScene(): GameScene | null {
  if (!gameInstance) return null
  const scene = gameInstance.scene.getScene('GameScene') as GameScene
  return scene || null
}
