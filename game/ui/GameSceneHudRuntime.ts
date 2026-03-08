import type Phaser from 'phaser'
import { buildGameSceneHudText } from './GameSceneHudText'
import type { GameSceneHudTextParams } from './GameSceneHudText'

export class GameSceneHudRuntime {
  private readonly lastHudText = new WeakMap<Phaser.GameObjects.Text, string>()

  renderHudText(hudText: Phaser.GameObjects.Text, params: GameSceneHudTextParams): void {
    const nextText = buildGameSceneHudText(params)
    const nextTextKey = nextText.join('\n')
    if (this.lastHudText.get(hudText) === nextTextKey) {
      return
    }

    this.lastHudText.set(hudText, nextTextKey)
    hudText.setText(nextText)
  }
}
