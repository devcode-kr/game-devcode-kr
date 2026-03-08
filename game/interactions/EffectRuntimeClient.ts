import type { EffectRuntimeCommand, EffectRuntimeEvent, EffectRuntimeState } from './EffectRuntimeProtocol'

export class EffectRuntimeClient {
  private readonly worker: Worker
  private revision = 0
  private onState: (revision: number, state: EffectRuntimeState) => void

  constructor(params: { tickMs: number; initialState: EffectRuntimeState; onState: (revision: number, state: EffectRuntimeState) => void }) {
    this.onState = params.onState
    this.worker = new Worker(new URL('./EffectRuntimeWorker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (event: MessageEvent<EffectRuntimeEvent>) => {
      if (event.data.type !== 'state') {
        return
      }

      this.onState(event.data.revision, event.data.state)
    }

    this.post({
      type: 'init',
      revision: this.nextRevision(),
      tickMs: params.tickMs,
      state: params.initialState,
    })
  }

  advance(deltaMs: number): number {
    const revision = this.nextRevision()
    this.post({
      type: 'advance',
      revision,
      deltaMs,
    })
    return revision
  }

  syncState(state: EffectRuntimeState): number {
    const revision = this.nextRevision()
    this.post({
      type: 'sync-state',
      revision,
      state,
    })
    return revision
  }

  destroy(): void {
    this.worker.terminate()
  }

  getLatestRevision(): number {
    return this.revision
  }

  private nextRevision(): number {
    this.revision += 1
    return this.revision
  }

  private post(message: EffectRuntimeCommand): void {
    this.worker.postMessage(message)
  }
}
