import * as Phaser from 'phaser'

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' })
  }

  preload() {
    this.load.image('ground', '/assets/map/ground.png')
    this.load.image('sky', '/assets/map/sky.png')
    this.load.image('floor-stone', '/assets/tiles/floor_stone.png')
    this.load.image('floor-stone-dark', '/assets/tiles/floor_stone_dark.png')
    this.load.image('wall-stone', '/assets/tiles/wall_stone.png')
  }

  create() {
    this.scene.start('GameScene')
  }
}
