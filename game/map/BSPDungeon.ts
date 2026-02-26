export enum TileType {
  WALL = 0,
  FLOOR = 1,
  CORRIDOR = 2,
}

export interface Room {
  x: number
  y: number
  width: number
  height: number
  centerX: number
  centerY: number
}

export class BSPNode {
  x: number
  y: number
  width: number
  height: number
  left: BSPNode | null = null
  right: BSPNode | null = null
  room: Room | null = null

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
  }

  getCenter(): { x: number; y: number } {
    if (this.room) {
      return { x: this.room.centerX, y: this.room.centerY }
    }
    return {
      x: Math.floor(this.x + this.width / 2),
      y: Math.floor(this.y + this.height / 2),
    }
  }
}

export class BSPDungeon {
  readonly width: number
  readonly height: number
  private grid: TileType[][]
  private root: BSPNode
  private rooms: Room[] = []

  // Config
  private readonly MIN_ROOM_SIZE = 6
  private readonly MIN_SPLIT_SIZE = 10
  private readonly MAX_DEPTH = 4
  private readonly ROOM_PADDING = 1

  constructor(width: number = 80, height: number = 80) {
    this.width = width
    this.height = height
    this.grid = Array(height)
      .fill(null)
      .map(() => Array(width).fill(TileType.WALL))
    this.root = new BSPNode(0, 0, width, height)
  }

  generate(): void {
    this.rooms = []
    this.split(this.root, 0)
    this.createRooms(this.root)
    this.createCorridors(this.root)
  }

  private split(node: BSPNode, depth: number): boolean {
    if (depth >= this.MAX_DEPTH) return false

    const canSplitH = node.width >= this.MIN_SPLIT_SIZE * 2
    const canSplitV = node.height >= this.MIN_SPLIT_SIZE * 2

    if (!canSplitH && !canSplitV) return false

    // Choose split direction
    let splitH: boolean
    if (canSplitH && canSplitV) {
      // Prefer direction that gives more square-like result
      splitH = node.width > node.height
    } else {
      splitH = canSplitH
    }

    if (splitH) {
      // Horizontal split
      const splitPos = this.randomRange(
        this.MIN_SPLIT_SIZE,
        node.width - this.MIN_SPLIT_SIZE
      )
      node.left = new BSPNode(node.x, node.y, splitPos, node.height)
      node.right = new BSPNode(
        node.x + splitPos,
        node.y,
        node.width - splitPos,
        node.height
      )
    } else {
      // Vertical split
      const splitPos = this.randomRange(
        this.MIN_SPLIT_SIZE,
        node.height - this.MIN_SPLIT_SIZE
      )
      node.left = new BSPNode(node.x, node.y, node.width, splitPos)
      node.right = new BSPNode(
        node.x,
        node.y + splitPos,
        node.width,
        node.height - splitPos
      )
    }

    this.split(node.left, depth + 1)
    this.split(node.right, depth + 1)

    return true
  }

  private createRooms(node: BSPNode): void {
    if (!node.left && !node.right) {
      // Leaf node - create room
      const maxW = node.width - this.ROOM_PADDING * 2
      const maxH = node.height - this.ROOM_PADDING * 2

      const roomW = this.randomRange(this.MIN_ROOM_SIZE, maxW)
      const roomH = this.randomRange(this.MIN_ROOM_SIZE, maxH)

      const roomX = node.x + this.ROOM_PADDING + this.randomRange(0, maxW - roomW)
      const roomY = node.y + this.ROOM_PADDING + this.randomRange(0, maxH - roomH)

      node.room = {
        x: roomX,
        y: roomY,
        width: roomW,
        height: roomH,
        centerX: Math.floor(roomX + roomW / 2),
        centerY: Math.floor(roomY + roomH / 2),
      }

      this.rooms.push(node.room)
      this.carveRoom(node.room)
    } else {
      if (node.left) this.createRooms(node.left)
      if (node.right) this.createRooms(node.right)
    }
  }

  private createCorridors(node: BSPNode): void {
    if (!node.left || !node.right) return

    // Connect siblings
    const leftCenter = node.left.getCenter()
    const rightCenter = node.right.getCenter()

    this.createCorridor(leftCenter.x, leftCenter.y, rightCenter.x, rightCenter.y)

    // Recurse
    this.createCorridors(node.left)
    this.createCorridors(node.right)
  }

  private createCorridor(x1: number, y1: number, x2: number, y2: number): void {
    // L-shaped corridor (horizontal then vertical, or vice versa)
    if (Math.random() < 0.5) {
      // Horizontal first
      this.carveHCorridor(x1, x2, y1)
      this.carveVCorridor(y1, y2, x2)
    } else {
      // Vertical first
      this.carveVCorridor(y1, y2, x1)
      this.carveHCorridor(x1, x2, y2)
    }
  }

  private carveHCorridor(x1: number, x2: number, y: number): void {
    const start = Math.min(x1, x2)
    const end = Math.max(x1, x2)
    for (let x = start; x <= end; x++) {
      if (this.isValid(x, y)) {
        this.grid[y][x] = TileType.CORRIDOR
      }
    }
  }

  private carveVCorridor(y1: number, y2: number, x: number): void {
    const start = Math.min(y1, y2)
    const end = Math.max(y1, y2)
    for (let y = start; y <= end; y++) {
      if (this.isValid(x, y)) {
        this.grid[y][x] = TileType.CORRIDOR
      }
    }
  }

  private carveRoom(room: Room): void {
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        if (this.isValid(x, y)) {
          this.grid[y][x] = TileType.FLOOR
        }
      }
    }
  }

  private isValid(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height
  }

  private randomRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  getGrid(): TileType[][] {
    return this.grid
  }

  getRooms(): Room[] {
    return this.rooms
  }

  getStartPosition(): { x: number; y: number } {
    if (this.rooms.length === 0) {
      return { x: this.width / 2, y: this.height / 2 }
    }
    const firstRoom = this.rooms[0]
    return {
      x: firstRoom.centerX,
      y: firstRoom.centerY,
    }
  }

  isWalkable(x: number, y: number): boolean {
    if (!this.isValid(Math.floor(x), Math.floor(y))) return false
    const tile = this.grid[Math.floor(y)][Math.floor(x)]
    return tile === TileType.FLOOR || tile === TileType.CORRIDOR
  }

  // Debug: print ASCII dungeon
  toString(): string {
    const chars: Record<TileType, string> = {
      [TileType.WALL]: '#',
      [TileType.FLOOR]: '.',
      [TileType.CORRIDOR]: '+',
    }
    return this.grid.map(row => row.map(t => chars[t]).join('')).join('\n')
  }
}
