export interface GridPoint {
  x: number
  y: number
}

interface AStarConfig {
  width: number
  height: number
  isWalkable: (x: number, y: number) => boolean
  maxVisitedNodes?: number
}

interface SearchNode extends GridPoint {
  g: number
  h: number
  f: number
  parentKey: string | null
}

const NEIGHBORS: Array<{ x: number; y: number; cost: number }> = [
  { x: 0, y: -1, cost: 1 },
  { x: 1, y: -1, cost: Math.SQRT2 },
  { x: 1, y: 0, cost: 1 },
  { x: 1, y: 1, cost: Math.SQRT2 },
  { x: 0, y: 1, cost: 1 },
  { x: -1, y: 1, cost: Math.SQRT2 },
  { x: -1, y: 0, cost: 1 },
  { x: -1, y: -1, cost: Math.SQRT2 },
]

function keyOf(x: number, y: number): string {
  return `${x},${y}`
}

function heuristic(from: GridPoint, to: GridPoint): number {
  const dx = Math.abs(from.x - to.x)
  const dy = Math.abs(from.y - to.y)
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)
}

function reconstructPath(nodes: Map<string, SearchNode>, endKey: string): GridPoint[] {
  const path: GridPoint[] = []
  let currentKey: string | null = endKey

  while (currentKey) {
    const node = nodes.get(currentKey)
    if (!node) {
      break
    }

    path.push({ x: node.x, y: node.y })
    currentKey = node.parentKey
  }

  return path.reverse()
}

export function findAStarPath(
  start: GridPoint,
  goal: GridPoint,
  config: AStarConfig
): { path: GridPoint[] | null; exhaustedSearchBudget: boolean; visitedNodes: number } {
  if (!config.isWalkable(start.x, start.y) || !config.isWalkable(goal.x, goal.y)) {
    return {
      path: null,
      exhaustedSearchBudget: false,
      visitedNodes: 0,
    }
  }

  const startKey = keyOf(start.x, start.y)
  const goalKey = keyOf(goal.x, goal.y)
  const openKeys = new Set<string>([startKey])
  const closedKeys = new Set<string>()
  const nodes = new Map<string, SearchNode>()

  nodes.set(startKey, {
    x: start.x,
    y: start.y,
    g: 0,
    h: heuristic(start, goal),
    f: heuristic(start, goal),
    parentKey: null,
  })

  while (openKeys.size > 0) {
    let currentKey: string | null = null
    let currentNode: SearchNode | null = null

    for (const candidateKey of openKeys) {
      const candidate = nodes.get(candidateKey)
      if (!candidate) continue

      if (
        !currentNode ||
        candidate.f < currentNode.f ||
        (candidate.f === currentNode.f && candidate.h < currentNode.h)
      ) {
        currentKey = candidateKey
        currentNode = candidate
      }
    }

    if (!currentKey || !currentNode) {
      break
    }

    if (currentKey === goalKey) {
      return {
        path: reconstructPath(nodes, currentKey),
        exhaustedSearchBudget: false,
        visitedNodes: closedKeys.size,
      }
    }

    openKeys.delete(currentKey)
    closedKeys.add(currentKey)

    if (config.maxVisitedNodes && closedKeys.size >= config.maxVisitedNodes) {
      return {
        path: null,
        exhaustedSearchBudget: true,
        visitedNodes: closedKeys.size,
      }
    }

    for (const neighbor of NEIGHBORS) {
      const nextX = currentNode.x + neighbor.x
      const nextY = currentNode.y + neighbor.y

      if (nextX < 0 || nextX >= config.width || nextY < 0 || nextY >= config.height) {
        continue
      }

      if (!config.isWalkable(nextX, nextY)) {
        continue
      }

      // Prevent squeezing through blocked diagonal corners.
      if (neighbor.x !== 0 && neighbor.y !== 0) {
        if (
          !config.isWalkable(currentNode.x + neighbor.x, currentNode.y) ||
          !config.isWalkable(currentNode.x, currentNode.y + neighbor.y)
        ) {
          continue
        }
      }

      const neighborKey = keyOf(nextX, nextY)
      if (closedKeys.has(neighborKey)) {
        continue
      }

      const tentativeG = currentNode.g + neighbor.cost
      const existing = nodes.get(neighborKey)
      if (existing && tentativeG >= existing.g) {
        continue
      }

      const h = heuristic({ x: nextX, y: nextY }, goal)
      nodes.set(neighborKey, {
        x: nextX,
        y: nextY,
        g: tentativeG,
        h,
        f: tentativeG + h,
        parentKey: currentKey,
      })
      openKeys.add(neighborKey)
    }
  }

  return {
    path: null,
    exhaustedSearchBudget: false,
    visitedNodes: closedKeys.size,
  }
}
