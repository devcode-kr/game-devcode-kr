export interface BootstrapDiagnosticStepResult {
  label: string
  ok: boolean
  error?: string
}

export interface BootstrapDiagnosticReport {
  steps: BootstrapDiagnosticStepResult[]
  failedStep: string | null
  error: string
}

async function runStep(
  label: string,
  load: () => Promise<unknown>,
  steps: BootstrapDiagnosticStepResult[]
): Promise<boolean> {
  try {
    await load()
    steps.push({ label, ok: true })
    return true
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    steps.push({ label, ok: false, error: message })
    return false
  }
}

export async function diagnoseGameBootstrap(rootError: unknown): Promise<BootstrapDiagnosticReport> {
  const steps: BootstrapDiagnosticStepResult[] = []
  const pipeline: Array<{ label: string; load: () => Promise<unknown> }> = [
    { label: 'phaser core', load: () => import('phaser') },
    { label: 'main entry', load: () => import('./main') },
    { label: 'preload scene', load: () => import('./scenes/PreloadScene') },
    { label: 'game scene', load: () => import('./scenes/GameScene') },
    { label: 'scene combat runtime', load: () => import('./interactions/SceneCombatRuntime') },
    { label: 'effect definitions', load: () => import('./interactions/EffectDefinitions') },
    { label: 'item catalog', load: () => import('./items/ItemCatalog') },
    { label: 'inventory panel', load: () => import('./ui/InventoryPanel') },
    { label: 'world builder', load: () => import('./world/WorldBuilder') },
  ]

  let failedStep: string | null = null
  for (const step of pipeline) {
    const ok = await runStep(step.label, step.load, steps)
    if (!ok) {
      failedStep = step.label
      break
    }
  }

  return {
    steps,
    failedStep,
    error: rootError instanceof Error ? `${rootError.name}: ${rootError.message}` : String(rootError),
  }
}
