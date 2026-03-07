export const TILE_WIDTH = 96
export const TILE_HEIGHT = 48
export const HALF_TILE_WIDTH = TILE_WIDTH / 2
export const HALF_TILE_HEIGHT = TILE_HEIGHT / 2

export interface IsoPoint {
  x: number
  y: number
}

export function worldToScreen(point: IsoPoint): IsoPoint {
  return {
    x: (point.x - point.y) * HALF_TILE_WIDTH,
    y: (point.x + point.y) * HALF_TILE_HEIGHT,
  }
}

export function screenToWorld(point: IsoPoint): IsoPoint {
  return {
    x: point.x / TILE_WIDTH + point.y / TILE_HEIGHT,
    y: point.y / TILE_HEIGHT - point.x / TILE_WIDTH,
  }
}

export function cellCenter(x: number, y: number): IsoPoint {
  return { x: x + 0.5, y: y + 0.5 }
}
