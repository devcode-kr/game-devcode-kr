import * as Phaser from 'phaser'

export type MovementMode = 'idle' | 'manual' | 'click-move'

export interface MovementSnapshot {
  nextPosition: Phaser.Math.Vector2
  velocity: Phaser.Math.Vector2
  mode: MovementMode
  hasDestination: boolean
}

interface MovementControllerConfig {
  moveSpeed: number
  arrivalThreshold: number
}

const DEFAULT_CONFIG: MovementControllerConfig = {
  moveSpeed: 3.2,
  arrivalThreshold: 0.06,
}

export class MovementController {
  private readonly position = new Phaser.Math.Vector2()
  private readonly facing = new Phaser.Math.Vector2(0, 1)
  private readonly velocity = new Phaser.Math.Vector2()
  private destination: Phaser.Math.Vector2 | null = null
  private mode: MovementMode = 'idle'
  private readonly config: MovementControllerConfig

  constructor(config?: Partial<MovementControllerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  setPosition(x: number, y: number): void {
    this.position.set(x, y)
  }

  getPosition(): Phaser.Math.Vector2 {
    return this.position.clone()
  }

  getFacing(): Phaser.Math.Vector2 {
    return this.facing.clone()
  }

  getMode(): MovementMode {
    return this.mode
  }

  hasDestination(): boolean {
    return this.destination !== null
  }

  getDestination(): Phaser.Math.Vector2 | null {
    return this.destination?.clone() ?? null
  }

  setDestination(x: number, y: number): void {
    this.destination = new Phaser.Math.Vector2(x, y)
    this.mode = 'click-move'
  }

  clearDestination(): void {
    this.destination = null
    if (this.mode === 'click-move') {
      this.mode = 'idle'
    }
  }

  step(deltaMs: number, manualDirection: Phaser.Math.Vector2): MovementSnapshot {
    this.velocity.set(0, 0)

    const direction = this.resolveDirection(manualDirection)
    if (direction.lengthSq() === 0) {
      this.mode = 'idle'
      return this.snapshot()
    }

    this.facing.copy(direction)
    this.velocity.copy(direction).scale((deltaMs / 1000) * this.config.moveSpeed)

    return {
      nextPosition: this.position.clone().add(this.velocity),
      velocity: this.velocity.clone(),
      mode: this.mode,
      hasDestination: this.destination !== null,
    }
  }

  commitPosition(x: number, y: number): void {
    this.position.set(x, y)

    if (!this.destination) {
      return
    }

    if (Phaser.Math.Distance.Between(x, y, this.destination.x, this.destination.y) <= this.config.arrivalThreshold) {
      this.position.copy(this.destination)
      this.destination = null
      this.velocity.set(0, 0)
      this.mode = 'idle'
    }
  }

  private resolveDirection(manualDirection: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const resolved = new Phaser.Math.Vector2()

    if (manualDirection.lengthSq() > 0) {
      resolved.copy(manualDirection).normalize()
      this.destination = null
      this.mode = 'manual'
      return resolved
    }

    if (!this.destination) {
      return resolved
    }

    const toDestination = this.destination.clone().subtract(this.position)
    if (toDestination.length() <= this.config.arrivalThreshold) {
      this.position.copy(this.destination)
      this.destination = null
      this.mode = 'idle'
      return resolved
    }

    this.mode = 'click-move'
    return toDestination.normalize()
  }

  private snapshot(): MovementSnapshot {
    return {
      nextPosition: this.position.clone(),
      velocity: this.velocity.clone(),
      mode: this.mode,
      hasDestination: this.destination !== null,
    }
  }
}
