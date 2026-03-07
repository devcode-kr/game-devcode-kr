import * as Phaser from 'phaser'

export interface DialoguePanelState {
  speaker: string
  line: string
}

export class DialoguePanel {
  private readonly box: Phaser.GameObjects.Rectangle
  private readonly text: Phaser.GameObjects.Text

  constructor(private readonly scene: Phaser.Scene) {
    this.box = scene.add.rectangle(0, 0, 0, 0, 0x020617, 0.9)
    this.box.setOrigin(0)
    this.box.setStrokeStyle(2, 0xcbd5e1, 0.9)
    this.box.setDepth(10001)
    this.box.setScrollFactor(0)
    this.box.setVisible(false)

    this.text = scene.add.text(0, 0, '', {
      color: '#e2e8f0',
      fontSize: '18px',
      fontFamily: 'monospace',
      wordWrap: { width: 0 },
      lineSpacing: 6,
    })
    this.text.setDepth(10002)
    this.text.setScrollFactor(0)
    this.text.setVisible(false)
  }

  render(width: number, height: number, state: DialoguePanelState | null): void {
    if (!state) {
      this.hide()
      return
    }

    const padding = 20
    const boxWidth = Math.min(640, width - 32)
    const boxHeight = 132
    const x = 16
    const y = height - boxHeight - 16

    this.box.setVisible(true)
    this.box.setPosition(x, y)
    this.box.setSize(boxWidth, boxHeight)

    this.text.setVisible(true)
    this.text.setPosition(x + padding, y + padding)
    this.text.setWordWrapWidth(boxWidth - padding * 2)
    this.text.setText([
      state.speaker,
      '',
      state.line,
      '',
      '[E] next',
    ])
  }

  hide(): void {
    this.box.setVisible(false)
    this.text.setVisible(false)
  }
}
