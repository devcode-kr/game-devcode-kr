import type Phaser from 'phaser'
import { buildGameSceneHudText } from './GameSceneHudText'
import type { GameSceneHudTextParams } from './GameSceneHudText'

export class GameSceneHudRuntime {
  renderHudText(hudText: Phaser.GameObjects.Text, params: GameSceneHudTextParams): void {
    hudText.setText(buildGameSceneHudText(params))
  }
}
