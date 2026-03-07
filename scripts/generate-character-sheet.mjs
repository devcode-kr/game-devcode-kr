import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const COMFY_BASE_URL = process.env.COMFYUI_URL ?? 'http://127.0.0.1:8188'
const OUTPUT_DIR = path.resolve('public/assets/characters/generated')
const WORKFLOW_DIR = path.resolve('scripts/workflows')

const DEFAULTS = {
  sourceModel: 'waiIllustriousSDXL_v160.safetensors',
  sourcePrompt:
    'full body fantasy action rpg character reference, sprite sheet source, single character, plain background, centered, readable silhouette, 2d game art',
  negativePrompt:
    'photorealistic, busy background, text, watermark, cropped, extra limbs, blurry',
  editPrompt:
    'turn this into a clean game sprite reference image, simplify background, improve silhouette readability, reduce noise, keep one centered character',
  width: 640,
  height: 640,
  seed: 0,
  sourceSteps: 12,
  sourceCfg: 6.5,
  sourceSampler: 'dpmpp_2m',
  sourceScheduler: 'karras',
  editSteps: 4,
  editCfg: 4,
  editSampler: 'euler',
  editScheduler: 'simple',
  qwenUnet: 'qwen_image_edit_2511_fp8mixed.safetensors',
  qwenClip: 'qwen_2.5_vl_7b_fp8_scaled.safetensors',
  qwenVae: 'qwen_image_vae.safetensors',
  sourcePrefix: 'character_sheet_source',
  editPrefix: 'character_sheet_qwen',
}

function parseArgs(argv) {
  const args = { ...DEFAULTS }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (!arg.startsWith('--')) {
      continue
    }

    const key = arg.slice(2)
    if (next === undefined || next.startsWith('--')) {
      args[key] = true
      continue
    }

    args[key] = next
    index += 1
  }

  return args
}

function applyTemplate(value, replacements) {
  if (typeof value === 'string') {
    if (Object.hasOwn(replacements, value)) {
      return replacements[value]
    }

    let next = value
    for (const [key, replacement] of Object.entries(replacements)) {
      next = next.split(key).join(String(replacement))
    }
    return next
  }

  if (Array.isArray(value)) {
    return value.map(entry => applyTemplate(entry, replacements))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, applyTemplate(entry, replacements)])
    )
  }

  return value
}

async function loadWorkflowTemplate(fileName, replacements) {
  const templatePath = path.join(WORKFLOW_DIR, fileName)
  const template = JSON.parse(await readFile(templatePath, 'utf8'))
  return applyTemplate(template, replacements)
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`POST ${url} failed: ${response.status} ${await response.text()}`)
  }

  return response.json()
}

async function getJson(url) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${await response.text()}`)
  }

  return response.json()
}

async function submitWorkflow(workflow) {
  const result = await postJson(`${COMFY_BASE_URL}/prompt`, workflow)
  if (result.error) {
    throw new Error(`ComfyUI prompt error: ${JSON.stringify(result)}`)
  }
  return result.prompt_id
}

async function waitForHistory(promptId) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const history = await getJson(`${COMFY_BASE_URL}/history/${promptId}`)
    if (history[promptId]) {
      return history[promptId]
    }

    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  throw new Error(`Timed out waiting for prompt ${promptId}`)
}

function collectImages(historyEntry) {
  const images = []
  for (const output of Object.values(historyEntry.outputs ?? {})) {
    for (const image of output.images ?? []) {
      images.push(image)
    }
  }
  return images
}

async function downloadImage(image, destinationPath) {
  const url = new URL(`${COMFY_BASE_URL}/view`)
  url.searchParams.set('filename', image.filename)
  url.searchParams.set('subfolder', image.subfolder ?? '')
  url.searchParams.set('type', image.type ?? 'output')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${image.filename}: ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(destinationPath, buffer)
}

async function uploadInputImage(filePath, uploadName) {
  const buffer = await readFile(filePath)
  const form = new FormData()
  form.set('image', new File([buffer], uploadName, { type: 'image/png' }))
  form.set('type', 'input')

  const response = await fetch(`${COMFY_BASE_URL}/upload/image`, {
    method: 'POST',
    body: form,
  })

  if (!response.ok) {
    throw new Error(`Failed to upload input image: ${response.status} ${await response.text()}`)
  }

  return response.json()
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  await mkdir(OUTPUT_DIR, { recursive: true })

  const clientId = `codex-character-sheet-${Date.now()}`

  const sourceWorkflow = await loadWorkflowTemplate('character-sheet-source.json', {
    __SOURCE_MODEL__: options.sourceModel,
    __SOURCE_PROMPT__: options.sourcePrompt,
    __NEGATIVE_PROMPT__: options.negativePrompt,
    __WIDTH__: Number(options.width),
    __HEIGHT__: Number(options.height),
    __SEED__: Number(options.seed),
    __SOURCE_STEPS__: Number(options.sourceSteps),
    __SOURCE_CFG__: Number(options.sourceCfg),
    __SOURCE_SAMPLER__: options.sourceSampler,
    __SOURCE_SCHEDULER__: options.sourceScheduler,
    __SOURCE_PREFIX__: options.sourcePrefix,
    __CLIENT_ID__: `${clientId}-source`,
  })

  console.log('Submitting source workflow...')
  const sourcePromptId = await submitWorkflow(sourceWorkflow)
  const sourceHistory = await waitForHistory(sourcePromptId)
  const sourceImages = collectImages(sourceHistory)
  if (sourceImages.length === 0) {
    throw new Error('Source workflow produced no images')
  }

  const sourceImage = sourceImages[0]
  const sourceOutputPath = path.join(OUTPUT_DIR, 'source.png')
  await downloadImage(sourceImage, sourceOutputPath)
  console.log(`Saved source image to ${sourceOutputPath}`)

  const uploaded = await uploadInputImage(sourceOutputPath, 'source.png')
  console.log(`Uploaded source image as ${uploaded.name}`)

  const editWorkflow = await loadWorkflowTemplate('qwen-image-edit.json', {
    __QWEN_UNET__: options.qwenUnet,
    __QWEN_CLIP__: options.qwenClip,
    __QWEN_VAE__: options.qwenVae,
    __INPUT_IMAGE__: uploaded.name,
    __EDIT_PROMPT__: options.editPrompt,
    __WIDTH__: Number(options.width),
    __HEIGHT__: Number(options.height),
    __SEED__: Number(options.seed),
    __EDIT_STEPS__: Number(options.editSteps),
    __EDIT_CFG__: Number(options.editCfg),
    __EDIT_SAMPLER__: options.editSampler,
    __EDIT_SCHEDULER__: options.editScheduler,
    __EDIT_PREFIX__: options.editPrefix,
    __CLIENT_ID__: `${clientId}-edit`,
  })

  console.log('Submitting Qwen image edit workflow...')
  const editPromptId = await submitWorkflow(editWorkflow)
  const editHistory = await waitForHistory(editPromptId)
  const editImages = collectImages(editHistory)
  if (editImages.length === 0) {
    throw new Error('Qwen edit workflow produced no images')
  }

  const savedEditPaths = []
  for (let index = 0; index < editImages.length; index += 1) {
    const image = editImages[index]
    const filePath = path.join(OUTPUT_DIR, `edit-${String(index + 1).padStart(2, '0')}.png`)
    await downloadImage(image, filePath)
    savedEditPaths.push(filePath)
  }

  const metadata = {
    sourcePromptId,
    editPromptId,
    sourceImage,
    editImages,
    savedEditPaths,
    options,
  }
  await writeFile(
    path.join(OUTPUT_DIR, 'run-metadata.json'),
    JSON.stringify(metadata, null, 2)
  )

  console.log('Saved edited images:')
  for (const filePath of savedEditPaths) {
    console.log(`- ${filePath}`)
  }
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
