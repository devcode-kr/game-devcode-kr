/// <reference lib="webworker" />

import {
  type EffectRuntimeCommand,
  type EffectRuntimeEvent,
  type EffectRuntimeState,
} from './EffectRuntimeProtocol'
import { advanceEffectRuntimeByTick } from './EffectRuntimeRules'

let tickMs = 100
let state: EffectRuntimeState | null = null

function emitState(revision: number): void {
  if (!state) {
    return
  }

  const event: EffectRuntimeEvent = {
    type: 'state',
    revision,
    state,
  }
  self.postMessage(event)
}

function handleAdvance(revision: number, deltaMs: number): void {
  if (!state || deltaMs <= 0) {
    emitState(revision)
    return
  }

  let remainingMs = deltaMs
  while (remainingMs >= tickMs) {
    state = advanceEffectRuntimeByTick(state, tickMs)
    remainingMs -= tickMs
  }

  emitState(revision)
}

self.onmessage = (event: MessageEvent<EffectRuntimeCommand>) => {
  const message = event.data
  switch (message.type) {
    case 'init':
      tickMs = message.tickMs
      state = message.state
      emitState(message.revision)
      return
    case 'advance':
      handleAdvance(message.revision, message.deltaMs)
      return
    case 'sync-state':
      state = message.state
      emitState(message.revision)
      return
  }
}

export {}
