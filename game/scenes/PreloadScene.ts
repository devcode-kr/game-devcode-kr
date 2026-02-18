import * as Phaser from 'phaser'

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' })
  }

  preload() {
    this.load.image('ground', '/assets/map/ground.png')
    this.load.image('sky', '/assets/map/sky.png')
  }

  create() {
    this.scene.start('GameScene')
  }
}
