export type AnimationState = 'idle' | 'run'

export class AnimationStateMachine {
  private currentState: AnimationState = 'idle'
  private elapsed = 0

  update(deltaMs: number, isMoving: boolean): AnimationState {
    const nextState: AnimationState = isMoving ? 'run' : 'idle'

    if (nextState !== this.currentState) {
      this.currentState = nextState
      this.elapsed = 0
      return this.currentState
    }

    this.elapsed += deltaMs
    return this.currentState
  }

  getState(): AnimationState {
    return this.currentState
  }

  getElapsed(): number {
    return this.elapsed
  }
}
