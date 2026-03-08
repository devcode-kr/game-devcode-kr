import * as Phaser from 'phaser'

export interface SceneDebugRuntimeCallbacks {
  isBlocked: () => boolean
  applyDebugDamage: () => void
  addDebugItems: () => void
  deployDebugTotem: () => void
}

export interface SceneDebugRuntimeKeys {
  debugDamageKey: Phaser.Input.Keyboard.Key
  inventoryTestItemsKey: Phaser.Input.Keyboard.Key
  deployActionKey: Phaser.Input.Keyboard.Key
}

export class SceneDebugRuntime {
  constructor(
    private readonly keys: SceneDebugRuntimeKeys,
    private readonly callbacks: SceneDebugRuntimeCallbacks
  ) {}

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.inventoryTestItemsKey)) {
      this.callbacks.addDebugItems()
    }

    if (this.callbacks.isBlocked()) {
      return
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.debugDamageKey)) {
      this.callbacks.applyDebugDamage()
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.deployActionKey)) {
      this.callbacks.deployDebugTotem()
    }
  }
}
