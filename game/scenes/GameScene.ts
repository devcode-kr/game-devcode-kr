import * as Phaser from 'phaser'
import { CharacterController } from '../characters/CharacterController'
import { PlayerStateRuntime } from '../characters/PlayerStateRuntime'
import { SceneDebugRuntime } from '../debug/SceneDebugRuntime'
import { Player } from '../entities/Player'
import { PlayerCharacter } from '../characters/PlayerCharacter'
import {
  getInventorySummaryText as summarizeInventory,
  getItemCountAcrossInventories,
} from '../items/InventoryUtils'
import { SceneNavigationRuntime } from '../navigation/SceneNavigationRuntime'
import {
  isDead,
} from '../interactions/SurvivalRules'
import {
  updateDeployableAttacks as updateRuntimeDeployableAttacks,
  updateSummonActions,
} from '../interactions/ActionExecutionRuntime'
import { ProjectileLifecycleRuntime } from '../interactions/ProjectileLifecycleRuntime'
import { SceneCombatRuntime } from '../interactions/SceneCombatRuntime'
import { SceneInteractionRuntime } from '../interactions/SceneInteractionRuntime'
import { PlayerSurvivalRuntime } from '../interactions/PlayerSurvivalRuntime'
import {
  createInitialEffectRuntimeSceneState,
} from '../interactions/EffectRuntimeSceneBridge'
import { BSPDungeon } from '../map/BSPDungeon'
import {
  createLocalStorageProgressStore,
  type AchievementState,
  type JourneyLog,
  type ProgressSnapshot,
  type ProgressStore,
} from '../progress/ProgressStore'
import { SceneProgressRuntime } from '../progress/SceneProgressRuntime'
import {
  HALF_TILE_HEIGHT,
  HALF_TILE_WIDTH,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../iso'
import { DialoguePanel } from '../ui/DialoguePanel'
import { EffectHudManager } from '../ui/EffectHudManager'
import { bakeEffectIconTextures } from '../ui/EffectIconTextures'
import { FacingCaret } from '../ui/FacingCaret'
import { EquipmentPanel } from '../ui/EquipmentPanel'
import { GameSceneHudRuntime } from '../ui/GameSceneHudRuntime'
import { InventoryPanel } from '../ui/InventoryPanel'
import { GameSceneRenderRuntime } from '../ui/GameSceneRenderRuntime'
import { type Interactable, type Trap } from '../world/WorldObjects'
import { GameSceneWorldRenderer } from '../world/GameSceneWorldRenderer'
import { GameWorldRuntime } from '../world/GameWorldRuntime'
import { SceneFloorRuntime } from '../world/SceneFloorRuntime'
import {
  bakeWorldTextures,
  findNearbyInteractable,
} from '../world/WorldBuilder'
import { SceneInventoryRuntime } from '../items/SceneInventoryRuntime'

const POOL_SIZE = 1000
const PLAYER_BODY_RADIUS = 0.24
const MONSTER_BODY_RADIUS = 0.24
const PATH_SEARCH_BUDGET_MULTIPLIER = 1.5
const MIN_PATH_SEARCH_BUDGET = 8
const INTERACTION_RANGE = 1.1
const PROGRESS_STORAGE_KEY = 'game-devcode-kr/progress'
const INVENTORY_COLS = 6
const INVENTORY_ROWS = 8
const BELT_COLS = 5
const BELT_ROWS = 1
const DEBUG_DAMAGE_AMOUNT = 25
const TRAP_DAMAGE_AMOUNT = 20
const TRAP_REARM_MS = 1600
const RESPAWN_HEALTH_RATIO = 0.5
const EFFECT_TICK_MS = 100
const POISON_DOT_DAMAGE_PER_SECOND = 3

export class GameScene extends Phaser.Scene {
  private fatalSceneError = false
  private fatalSceneErrorText: Phaser.GameObjects.Text | null = null
  private player!: Player
  private readonly playerCharacter = new PlayerCharacter({
    inventoryCols: INVENTORY_COLS,
    inventoryRows: INVENTORY_ROWS,
    beltCols: BELT_COLS,
    beltRows: BELT_ROWS,
  })
  private readonly playerController = new CharacterController(this.playerCharacter, PLAYER_BODY_RADIUS)
  private dungeon!: BSPDungeon
  private tilePool: Phaser.GameObjects.Image[] = []
  private pathGraphics!: Phaser.GameObjects.Graphics
  private interactables: Interactable[] = []
  private traps: Trap[] = []
  private readonly worldRuntime = new GameWorldRuntime()
  private hoverMarker!: Phaser.GameObjects.Ellipse
  private hudText!: Phaser.GameObjects.Text
  private effectHud!: EffectHudManager
  private facingCaret!: FacingCaret
  private dialoguePanel!: DialoguePanel
  private inventoryPanel!: InventoryPanel
  private equipmentPanel!: EquipmentPanel
  private inventoryRuntime!: SceneInventoryRuntime
  private interactionRuntime!: SceneInteractionRuntime
  private survivalRuntime!: PlayerSurvivalRuntime
  private floorRuntime!: SceneFloorRuntime
  private progressRuntime!: SceneProgressRuntime
  private debugRuntime!: SceneDebugRuntime
  private navigationRuntime!: SceneNavigationRuntime
  private combatRuntime!: SceneCombatRuntime
  private readonly worldRenderer = new GameSceneWorldRenderer()
  private readonly hudRuntime = new GameSceneHudRuntime()
  private readonly renderRuntime = new GameSceneRenderRuntime()
  private interactionStatus = 'none'
  private nearbyInteractable: Interactable | null = null
  private inventorySummaryText = 'belt: empty | bag: empty'
  private potionCount = 0
  private keyCount = 0
  private floorIndex = 1
  private gold = 0
  private spawnTile = { x: 0, y: 0 }
  private journeyLog: JourneyLog = {
    currentChapter: 'Entered the dungeon',
    steps: {
      enteredDungeon: false,
      talkedToNpc: false,
      foundKey: false,
      openedLockedChest: false,
      reachedNextFloor: false,
    },
  }
  private achievements: AchievementState = {
    counters: {
      npcTalks: 0,
      chestsOpened: 0,
      lockedChestsOpened: 0,
      keysCollected: 0,
      floorsReached: 1,
    },
    unlocked: [],
  }
  private readonly progressStore: ProgressStore = createLocalStorageProgressStore(PROGRESS_STORAGE_KEY)
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private interactKey!: Phaser.Input.Keyboard.Key
  private usePotionKey!: Phaser.Input.Keyboard.Key
  private debugDamageKey!: Phaser.Input.Keyboard.Key
  private fireProjectileKey!: Phaser.Input.Keyboard.Key
  private deployActionKey!: Phaser.Input.Keyboard.Key
  private attackModifierKey!: Phaser.Input.Keyboard.Key
  private respawnKey!: Phaser.Input.Keyboard.Key
  private inventoryKey!: Phaser.Input.Keyboard.Key
  private inventoryTestItemsKey!: Phaser.Input.Keyboard.Key
  private readonly effectRuntimeSceneState = createInitialEffectRuntimeSceneState(0)
  private readonly playerStateRuntime = new PlayerStateRuntime(
    this.playerCharacter,
    this.playerController,
    this.effectRuntimeSceneState
  )
  private readonly projectileLifecycleRuntime = new ProjectileLifecycleRuntime(
    this.worldRuntime,
    {
      id: this.playerCharacter.id,
      character: this.playerCharacter,
      controller: this.playerController,
    },
    this.effectRuntimeSceneState
  )
  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    try {
      this.cameras.main.setBackgroundColor(0x111111)
      this.effectRuntimeSceneState.nowMs = this.time.now

      this.bakeDiamonds()
      bakeEffectIconTextures(this)

      for (let i = 0; i < POOL_SIZE; i++) {
        this.tilePool.push(this.add.image(-9999, -9999, 'tile-a').setDepth(1))
      }

      this.pathGraphics = this.add.graphics()
      this.pathGraphics.setDepth(9996)

      this.player = new Player(this, this.playerController)

    this.hoverMarker = this.add.ellipse(0, 0, 28, 14)
    this.hoverMarker.setStrokeStyle(2, 0xf59e0b, 0.95)
    this.hoverMarker.setFillStyle(0x000000, 0)
    this.hoverMarker.setDepth(9997)

    this.hudText = this.add.text(16, 16, '', {
      color: '#f8fafc',
      fontSize: '14px',
      fontFamily: 'monospace',
      backgroundColor: '#00000066',
      padding: { x: 10, y: 8 },
    })
    this.hudText.setDepth(10000)
    this.hudText.setScrollFactor(0)

    this.effectHud = new EffectHudManager(this)
    this.facingCaret = new FacingCaret(this)
    this.dialoguePanel = new DialoguePanel(this)
    this.inventoryPanel = new InventoryPanel(this)
    this.equipmentPanel = new EquipmentPanel(this)
    this.inventoryRuntime = new SceneInventoryRuntime(
      this.playerCharacter,
      this.inventoryPanel,
      this.equipmentPanel,
      {
        useInventoryItem: itemDefinitionId => {
          this.useInventoryItem(itemDefinitionId)
        },
        onInventoryChanged: () => {
          this.handleInventoryChanged()
        },
        setInteractionStatus: status => {
          this.interactionStatus = status
        },
      }
    )
    this.interactionRuntime = new SceneInteractionRuntime(
      this.playerCharacter,
      this.playerController,
      {
        isDead: () => this.isDead(),
        saveProgress: () => this.saveProgress(),
        syncPlayerState: () => this.syncPlayerStateRuntime(),
        onAdvanceFloor: () => this.generateFloor(false),
        onGoldDelta: amount => {
          this.gold += amount
        },
        setInteractionStatus: status => {
          this.interactionStatus = status
        },
        applyUnlockedAchievements: labels => {
          this.applyUnlockedAchievements(labels)
        },
      }
    )
    this.survivalRuntime = new PlayerSurvivalRuntime(
      this.playerCharacter,
      this.playerController,
      this.effectRuntimeSceneState,
      {
        isDead: () => this.isDead(),
        getSpawnTile: () => this.spawnTile,
        getFloorIndex: () => this.floorIndex,
        getDungeonSize: () => ({ width: this.dungeon.width, height: this.dungeon.height }),
        getTrapAt: (tileX, tileY) => this.traps.find(candidate => candidate.tileX === tileX && candidate.tileY === tileY),
        getNowMs: () => this.time.now,
        getEffectNowMs: () => this.playerStateRuntime.getEffectRuntimeNowMs(),
        syncPlayerState: () => this.syncPlayerStateRuntime(),
        saveProgress: () => this.saveProgress(),
        setInteractionStatus: status => {
          this.interactionStatus = status
        },
      }
    )
    this.floorRuntime = new SceneFloorRuntime(this, {
      resetWorldForFloor: monsterSpawns => {
        this.worldRuntime.resetForFloor(this, monsterSpawns)
      },
      setPlayerPosition: (x, y) => {
        this.playerController.clearDestination()
        this.playerController.setMapPosition(x, y)
      },
      refreshVisibility: () => {
        this.navigationRuntime.refreshVisibility()
      },
      saveProgress: () => {
        this.saveProgress()
      },
      applyUnlockedAchievements: labels => {
        this.applyUnlockedAchievements(labels)
      },
      setInteractionStatus: status => {
        this.interactionStatus = status
      },
    })
    this.progressRuntime = new SceneProgressRuntime(
      this.progressStore,
      this.playerCharacter,
      this.effectRuntimeSceneState,
      {
        getNowMs: () => this.time.now,
        getEffectNowMs: () => this.playerStateRuntime.getEffectRuntimeNowMs(),
        getDefaultHealth: () => this.playerCharacter.getMaxHealth(),
        getDefaultMana: () => this.playerCharacter.getMaxMana(),
        syncPlayerState: () => this.syncPlayerStateRuntime(),
      }
    )
    this.navigationRuntime = new SceneNavigationRuntime(
      this.playerCharacter,
      this.playerController,
      () => this.dungeon,
      () => this.worldRuntime.getMonsters().map(monster => ({
        id: monster.id,
        controller: monster.controller,
      })),
      {
        monsterBodyRadius: MONSTER_BODY_RADIUS,
        pathSearchBudgetMultiplier: PATH_SEARCH_BUDGET_MULTIPLIER,
        minPathSearchBudget: MIN_PATH_SEARCH_BUDGET,
      }
    )
    this.combatRuntime = new SceneCombatRuntime(
      this,
      this.playerCharacter,
      this.playerController,
      this.worldRuntime,
      this.projectileLifecycleRuntime,
      () => this.dungeon,
      {
        getNowMs: () => this.time.now,
        getEffectNowMs: () => this.playerStateRuntime.getEffectRuntimeNowMs(),
        setInteractionStatus: status => {
          this.interactionStatus = status
        },
        syncPlayerState: () => this.syncPlayerStateRuntime(),
      }
    )
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    this.usePotionKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q)
    this.debugDamageKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.H)
    this.fireProjectileKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F)
    this.deployActionKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.V)
    this.attackModifierKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT)
    this.respawnKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R)
    this.inventoryKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.I)
    this.inventoryTestItemsKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T)
    this.debugRuntime = new SceneDebugRuntime(
      {
        debugDamageKey: this.debugDamageKey,
        inventoryTestItemsKey: this.inventoryTestItemsKey,
        deployActionKey: this.deployActionKey,
      },
      {
        isBlocked: () => Boolean(this.interactionRuntime.getActiveDialogue()) || this.isDead(),
        applyDebugDamage: () => {
          this.applyDebugDamage()
        },
        addDebugItems: () => {
          this.inventoryRuntime.addDebugItems()
        },
        deployDebugTotem: () => {
          this.deployDebugTotem()
        },
      }
    )

    this.loadProgress()
    this.refreshInventoryDerivedState()
    this.playerStateRuntime.refreshCharacterStatSources(this.playerStateRuntime.getEffectRuntimeNowMs())
    this.playerStateRuntime.initializeEffectRuntimeWorker(EFFECT_TICK_MS)
    this.generateFloor(true)
    this.nearbyInteractable = this.computeNearbyInteractable()
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.playerStateRuntime.destroy()
      this.effectHud.destroy()
      this.facingCaret.destroy()
      this.equipmentPanel.destroy()
      this.worldRuntime.destroy()
    })

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.inventoryRuntime.handlePointerDown({ pointer, viewportWidth: this.scale.width })) {
        return
      }

      if (this.interactionRuntime.getActiveDialogue()) {
        return
      }

      if (pointer.button !== 0) {
        return
      }

      const targetCell = this.navigationRuntime.resolvePointerTile({
        screenX: pointer.x,
        screenY: pointer.y,
        viewportWidth: this.scale.width,
        viewportHeight: this.scale.height,
      })
      if (!targetCell) {
        this.navigationRuntime.handleOutOfBoundsClick()
        return
      }

      if (this.attackModifierKey.isDown) {
        this.navigationRuntime.faceTowardCell(targetCell)
        this.combatRuntime.fireEquippedAttack('weapon attack fired')
        return
      }

      this.navigationRuntime.tryApplyClickMove(targetCell, 'path ready')
    })

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.inventoryRuntime.handlePointerUp({ pointer, viewportWidth: this.scale.width })) {
        return
      }
    })

      this.drawDungeon(false)
    } catch (error) {
      this.showFatalSceneError('GameScene.create failed', error)
    }
  }

  update(_time: number, delta: number) {
    if (this.fatalSceneError) {
      return
    }

    try {
    const movementResult = this.navigationRuntime.updateMovement({
      deltaMs: delta,
      blocked: Boolean(this.interactionRuntime.getActiveDialogue()) || this.isDead(),
      wasd: this.wasd,
      cursors: this.cursors,
    })
    const { isMoving } = movementResult
    this.nearbyInteractable = this.computeNearbyInteractable()

    this.playerStateRuntime.advanceEffectRuntime(delta)
    this.combatRuntime.updateMonsterCombat({
      deltaMs: delta,
      canMonsterOccupy: (monster, x, y) => this.navigationRuntime.canMonsterOccupy(monster.id, x, y),
    })
    this.tryFireProjectile()
    this.worldRuntime.updateDeployables(this.time.now)
    const deployableAttackResult = updateRuntimeDeployableAttacks({
      scene: this,
      nowMs: this.time.now,
      deployables: this.worldRuntime.getDeployables(),
      projectiles: this.worldRuntime.getProjectiles(),
      findNearestMonster: (x, y, range) => this.worldRuntime.findNearestMonster(x, y, range),
    })
    this.worldRuntime.applyActionExecutionCollections({
      ...this.worldRuntime.getActionExecutionCollections(),
      projectiles: deployableAttackResult.projectiles,
    })
    if (deployableAttackResult.status) {
      this.interactionStatus = deployableAttackResult.status
    }
    const summonResult = updateSummonActions({
      scene: this,
      nowMs: this.time.now,
      deltaMs: delta,
      summons: this.worldRuntime.getSummons(),
      projectiles: this.worldRuntime.getProjectiles(),
      ownerPosition: this.playerController.getMapPosition(),
      findNearestTarget: (x, y, range) => {
        const monster = this.worldRuntime.findNearestMonster(x, y, range)
        return monster?.controller.getMapPosition() ?? null
      },
    })
    this.worldRuntime.applyActionExecutionCollections({
      deployables: this.worldRuntime.getDeployables(),
      summons: summonResult.summons,
      projectiles: summonResult.projectiles,
    })
    if (summonResult.status) {
      this.interactionStatus = summonResult.status
    }
    this.combatRuntime.updateProjectiles(delta)
    this.navigationRuntime.refreshVisibility()
    this.tryToggleInventory()
    this.debugRuntime.update()
    this.tryRespawn()
    this.tryTriggerTrap()
    this.tryUsePotion()
    this.tryInteract()

    this.drawDungeon(isMoving)
    } catch (error) {
      this.showFatalSceneError('GameScene.update failed', error)
    }
  }

  private bakeDiamonds() {
    const variants: Array<{ key: string; fill: number; stroke: number }> = [
      { key: 'tile-a', fill: 0x3a5c3a, stroke: 0xaabbaa },
      { key: 'tile-b', fill: 0x2e4a2e, stroke: 0x90aa90 },
      { key: 'tile-corridor', fill: 0x355767, stroke: 0x9eb9c3 },
    ]

    for (const variant of variants) {
      if (this.textures.exists(variant.key)) {
        this.textures.remove(variant.key)
      }

      const graphics = this.make.graphics({ x: 0, y: 0 }, false)
      graphics.fillStyle(variant.fill, 1)
      graphics.lineStyle(1, variant.stroke, 0.65)
      graphics.beginPath()
      graphics.moveTo(HALF_TILE_WIDTH, 0)
      graphics.lineTo(TILE_WIDTH, HALF_TILE_HEIGHT)
      graphics.lineTo(HALF_TILE_WIDTH, TILE_HEIGHT)
      graphics.lineTo(0, HALF_TILE_HEIGHT)
      graphics.closePath()
      graphics.fillPath()
      graphics.strokePath()
      graphics.generateTexture(variant.key, TILE_WIDTH, TILE_HEIGHT)
      graphics.destroy()
    }

    bakeWorldTextures(this)
  }

  private drawDungeon(isMoving: boolean) {
    this.renderRuntime.render({
      scene: this,
      dungeon: this.dungeon,
      tilePool: this.tilePool,
      pathGraphics: this.pathGraphics,
      hoverMarker: this.hoverMarker,
      hudText: this.hudText,
      player: this.player,
      playerCharacter: this.playerCharacter,
      playerController: this.playerController,
      worldRuntime: this.worldRuntime,
      worldRenderer: this.worldRenderer,
      hudRuntime: this.hudRuntime,
      effectHud: this.effectHud,
      facingCaret: this.facingCaret,
      dialoguePanel: this.dialoguePanel,
      inventoryRuntime: this.inventoryRuntime,
      effectRuntimeSceneState: this.effectRuntimeSceneState,
      interactables: this.interactables,
      traps: this.traps,
      floorIndex: this.floorIndex,
      gold: this.gold,
      visibleTilesCount: this.navigationRuntime.getVisibleTilesCount(),
      pathStatus: this.navigationRuntime.getPathStatus(),
      interactionStatus: this.interactionStatus,
      journeyChapter: this.journeyLog.currentChapter,
      achievementsText: this.achievements.unlocked.length > 0 ? this.achievements.unlocked.join(', ') : 'none',
      potionCount: this.potionCount,
      keyCount: this.keyCount,
      inventorySummary: this.inventorySummaryText,
      isMoving,
      searchBudget: this.navigationRuntime.getPathSearchBudget(),
      searchBudgetMultiplier: PATH_SEARCH_BUDGET_MULTIPLIER,
      nowMs: this.time.now,
      effectNowMs: this.playerStateRuntime.getEffectRuntimeNowMs(),
      dialoguePanelState: this.interactionRuntime.getDialoguePanelState(),
      nearbyInteractable: this.nearbyInteractable,
      getTileTexture: (tile, gx, gy) => this.navigationRuntime.getTileTexture(tile, gx, gy),
      isDead: this.isDead(),
    })
  }

  private generateFloor(resetFloorIndex: boolean): void {
    const nextState = this.floorRuntime.generateFloor({
      state: {
        dungeon: this.dungeon,
        spawnTile: this.spawnTile,
        interactables: this.interactables,
        traps: this.traps,
        floorIndex: this.floorIndex,
      },
      resetFloorIndex,
      journeyLog: this.journeyLog,
      achievements: this.achievements,
      trapRearmMs: TRAP_REARM_MS,
      width: 80,
      height: 80,
    })
    this.dungeon = nextState.dungeon
    this.spawnTile = nextState.spawnTile
    this.interactables = nextState.interactables
    this.traps = nextState.traps
    this.floorIndex = nextState.floorIndex
  }

  private tryInteract(): void {
    if (this.isDead()) {
      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.interactionStatus = 'cannot interact while dead'
      }
      return
    }

    this.interactionRuntime.tryInteract({
      interactKey: this.interactKey,
      interactable: this.nearbyInteractable,
      journeyLog: this.journeyLog,
      achievements: this.achievements,
    })
  }

  private tryUsePotion(): void {
    if (this.interactionRuntime.getActiveDialogue() || this.isDead() || !Phaser.Input.Keyboard.JustDown(this.usePotionKey)) {
      return
    }

    this.useInventoryItem('potion_minor')
  }

  private tryFireProjectile(): void {
    if (this.interactionRuntime.getActiveDialogue() || this.isDead() || !Phaser.Input.Keyboard.JustDown(this.fireProjectileKey)) {
      return
    }

    this.combatRuntime.fireEquippedAttack('fired combined attack')
  }

  private deployDebugTotem(): void {
    this.combatRuntime.deployDebugTotem()
  }

  private tryTriggerTrap(): void {
    this.survivalRuntime.tryTriggerTrap({
      trapRearmMs: TRAP_REARM_MS,
      trapDamageAmount: TRAP_DAMAGE_AMOUNT,
      poisonDamagePerSecond: POISON_DOT_DAMAGE_PER_SECOND,
    })
  }

  private applyDebugDamage(): void {
    this.survivalRuntime.tryApplyDebugDamage(
      this.debugDamageKey,
      DEBUG_DAMAGE_AMOUNT,
      false
    )
  }

  private tryRespawn(): void {
    this.survivalRuntime.tryRespawn(this.respawnKey, RESPAWN_HEALTH_RATIO)
  }

  private tryToggleInventory(): void {
    if (!Phaser.Input.Keyboard.JustDown(this.inventoryKey)) {
      return
    }

    this.inventoryRuntime.toggle()
  }

  private computeNearbyInteractable(): Interactable | null {
    return findNearbyInteractable(this.interactables, this.playerController.getMapPosition(), INTERACTION_RANGE)
  }

  private loadProgress(): void {
    const snapshot = this.progressRuntime.load()
    if (!snapshot) {
      return
    }

    this.applyProgressSnapshot(snapshot)
  }

  private saveProgress(): void {
    this.progressRuntime.save({
      floorIndex: this.floorIndex,
      gold: this.gold,
      journeyLog: this.journeyLog,
      achievements: this.achievements,
    })
  }

  private applyProgressSnapshot(snapshot: ProgressSnapshot): void {
    const nextState = this.progressRuntime.applySnapshot({
      snapshot,
      state: {
        floorIndex: this.floorIndex,
        gold: this.gold,
        journeyLog: this.journeyLog,
        achievements: this.achievements,
      },
      inventoryCols: INVENTORY_COLS,
      inventoryRows: INVENTORY_ROWS,
      beltCols: BELT_COLS,
      beltRows: BELT_ROWS,
    })
    this.floorIndex = nextState.floorIndex
    this.gold = nextState.gold
    this.journeyLog = nextState.journeyLog
    this.achievements = nextState.achievements
    this.refreshInventoryDerivedState()
  }

  private getItemCount(itemDefinitionId: string): number {
    return getItemCountAcrossInventories(
      [this.playerCharacter.getBeltInventory(), this.playerCharacter.getInventory()],
      itemDefinitionId
    )
  }

  private getInventorySummaryText(): string {
    return [
      `belt: ${summarizeInventory(this.playerCharacter.getBeltInventory())}`,
      `bag: ${summarizeInventory(this.playerCharacter.getInventory())}`,
    ].join(' | ')
  }

  private syncPlayerStateRuntime(): void {
    this.playerStateRuntime.refreshCharacterStatSources(this.playerStateRuntime.getEffectRuntimeNowMs())
    this.playerStateRuntime.syncEffectRuntimeState()
  }

  private handleInventoryChanged(): void {
    this.refreshInventoryDerivedState()
    this.syncPlayerStateRuntime()
    this.saveProgress()
  }

  private refreshInventoryDerivedState(): void {
    this.potionCount = this.getItemCount('potion_minor')
    this.keyCount = this.getItemCount('utility_key')
    this.inventorySummaryText = this.getInventorySummaryText()
  }

  private isDead(): boolean {
    return isDead(this.playerCharacter.getHealth())
  }

  private applyUnlockedAchievements(labels: string[]): void {
    if (labels.length === 0 || this.interactionStatus !== 'none') {
      return
    }

    this.interactionStatus = `achievement unlocked: ${labels.join(', ')}`
  }

  private useInventoryItem(itemDefinitionId: string): void {
    const result = this.playerStateRuntime.useInventoryItem(itemDefinitionId)
    this.interactionStatus = result.status
    if (!result.used) {
      return
    }

    this.refreshInventoryDerivedState()
    this.saveProgress()
  }

  private showFatalSceneError(context: string, error: unknown): void {
    this.fatalSceneError = true
    console.error(context, error)
    this.cameras.main.setBackgroundColor(0x140f19)

    const message = error instanceof Error ? error.message : String(error)
    if (!this.fatalSceneErrorText) {
      this.fatalSceneErrorText = this.add.text(24, 24, '', {
        color: '#f8fafc',
        fontSize: '18px',
        fontFamily: 'monospace',
        wordWrap: { width: Math.max(this.scale.width - 48, 240) },
        backgroundColor: '#00000088',
        padding: { x: 12, y: 10 },
      })
      this.fatalSceneErrorText.setDepth(11000)
      this.fatalSceneErrorText.setScrollFactor(0)
    }

    this.fatalSceneErrorText.setText([
      'Game scene failed to render.',
      context,
      message,
    ])
  }
}
