import { BuildingType, BUILDING_POINTS, type BoardSquare } from '../components/building.js'

export const BOARD_SIZE = 9
export const BOARD_SQUARES = BOARD_SIZE * BOARD_SIZE

const DIRECTIONS_8: [number, number][] = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1],
]

const DIRECTIONS_4: [number, number][] = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
]

export function posToRowCol(pos: number): [number, number] {
    return [Math.floor(pos / BOARD_SIZE), pos % BOARD_SIZE]
}

export function rowColToPos(row: number, col: number): number {
    return row * BOARD_SIZE + col
}

function isOnBoard(row: number, col: number): boolean {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE
}

export function getOrthogonalNeighbors(pos: number): number[] {
    const [row, col] = posToRowCol(pos)
    const neighbors: number[] = []
    for (const [dr, dc] of DIRECTIONS_4) {
        const r = row + dr, c = col + dc
        if (isOnBoard(r, c)) neighbors.push(rowColToPos(r, c))
    }
    return neighbors
}

export function getLineOfSight(board: BoardSquare[], pos: number, blockers: Set<number> = new Set()): Set<number> {
    const visible = new Set<number>()
    const [row, col] = posToRowCol(pos)
    for (const [dr, dc] of DIRECTIONS_8) {
        let r = row + dr, c = col + dc
        while (isOnBoard(r, c)) {
            const p = rowColToPos(r, c)
            if (board[p] !== null || blockers.has(p)) break
            visible.add(p)
            r += dr
            c += dc
        }
    }
    return visible
}

export function getArchitectIntersection(board: BoardSquare[], architects: number[]): Set<number> {
    if (architects[0] < 0 || architects[1] < 0) return new Set()
    const vis0 = getLineOfSight(board, architects[0], new Set([architects[1]]))
    const vis1 = getLineOfSight(board, architects[1], new Set([architects[0]]))
    const intersection = new Set<number>()
    for (const pos of vis0) {
        if (vis1.has(pos)) intersection.add(pos)
    }
    return intersection
}

function satisfiesAdjacencyRule(board: BoardSquare[], pos: number, buildingType: BuildingType): boolean {
    if (buildingType === BuildingType.House) return true
    for (const n of getOrthogonalNeighbors(pos)) {
        if (board[n]?.buildingType === buildingType) return false
    }
    return true
}

export function getDistrictFrom(board: BoardSquare[], startPos: number): Set<number> {
    const district = new Set<number>([startPos])
    const queue = [startPos]
    while (queue.length > 0) {
        const current = queue.shift()!
        for (const n of getOrthogonalNeighbors(current)) {
            if (!district.has(n) && board[n] !== null) {
                district.add(n)
                queue.push(n)
            }
        }
    }
    return district
}

function countPlayerComponents(board: BoardSquare[], district: Set<number>, playerId: string): number {
    const visited = new Set<number>()
    let count = 0
    for (const pos of district) {
        if (board[pos]?.playerId !== playerId || visited.has(pos)) continue
        count++
        const queue = [pos]
        visited.add(pos)
        while (queue.length > 0) {
            const current = queue.shift()!
            for (const n of getOrthogonalNeighbors(current)) {
                if (!visited.has(n) && district.has(n) && board[n]?.playerId === playerId) {
                    visited.add(n)
                    queue.push(n)
                }
            }
        }
    }
    return count
}

function satisfiesDistrictRule(board: BoardSquare[], pos: number, playerId: string): boolean {
    const tempBoard = [...board]
    tempBoard[pos] = { playerId, buildingType: BuildingType.House }
    const district = getDistrictFrom(tempBoard, pos)
    const playerIds = new Set<string>()
    for (const p of district) {
        const sq = tempBoard[p]
        if (sq) playerIds.add(sq.playerId)
    }
    for (const pid of playerIds) {
        if (countPlayerComponents(tempBoard, district, pid) > 1) return false
    }
    return true
}

function findAllMonumentsInDistrict(board: BoardSquare[], district: Set<number>): Monument[] {
    const monuments: Monument[] = []
    for (const p of district) {
        const [r, c] = posToRowCol(p)
        if (c + 2 < BOARD_SIZE) {
            const p1 = rowColToPos(r, c + 1), p2 = rowColToPos(r, c + 2)
            if (district.has(p1) && district.has(p2)) {
                const m = checkMonument(board, p, p1, p2)
                if (m) monuments.push(m)
            }
        }
        if (r + 2 < BOARD_SIZE) {
            const p1 = rowColToPos(r + 1, c), p2 = rowColToPos(r + 2, c)
            if (district.has(p1) && district.has(p2)) {
                const m = checkMonument(board, p, p1, p2)
                if (m) monuments.push(m)
            }
        }
    }
    return monuments
}

function satisfiesMonumentRule(board: BoardSquare[], pos: number, playerId: string, buildingType: BuildingType): boolean {
    const tempBoard = [...board]
    tempBoard[pos] = { playerId, buildingType }
    const district = getDistrictFrom(tempBoard, pos)
    const monuments = findAllMonumentsInDistrict(tempBoard, district)
    const counts = new Map<string, number>()
    for (const m of monuments) counts.set(m.winnerId, (counts.get(m.winnerId) ?? 0) + 1)
    for (const count of counts.values()) if (count > 1) return false
    return true
}

export function getValidPlacementsForType(
    board: BoardSquare[],
    architects: number[],
    playerId: string,
    buildingType: BuildingType,
    monumentsVariant = false
): number[] {
    const intersection = getArchitectIntersection(board, architects)
    const valid: number[] = []
    for (const pos of intersection) {
        if (board[pos] !== null) continue
        if (!satisfiesAdjacencyRule(board, pos, buildingType)) continue
        if (!satisfiesDistrictRule(board, pos, playerId)) continue
        if (monumentsVariant && !satisfiesMonumentRule(board, pos, playerId, buildingType)) continue
        valid.push(pos)
    }
    return valid
}

export function getValidPlacements(
    board: BoardSquare[],
    architects: number[],
    playerId: string,
    buildings: { houses: number; palaces: number; towers: number },
    monumentsVariant = false
): number[] {
    const validPositions = new Set<number>()
    if (buildings.houses > 0) {
        for (const pos of getValidPlacementsForType(board, architects, playerId, BuildingType.House, monumentsVariant)) {
            validPositions.add(pos)
        }
    }
    if (buildings.palaces > 0) {
        for (const pos of getValidPlacementsForType(board, architects, playerId, BuildingType.Palace, monumentsVariant)) {
            validPositions.add(pos)
        }
    }
    if (buildings.towers > 0) {
        for (const pos of getValidPlacementsForType(board, architects, playerId, BuildingType.Tower, monumentsVariant)) {
            validPositions.add(pos)
        }
    }
    return [...validPositions]
}

export function hasAnyValidPlacement(
    board: BoardSquare[],
    architects: number[],
    playerId: string,
    buildings: { houses: number; palaces: number; towers: number },
    monumentsVariant = false
): boolean {
    if (
        buildings.houses > 0 &&
        getValidPlacementsForType(board, architects, playerId, BuildingType.House, monumentsVariant).length > 0
    )
        return true
    if (
        buildings.palaces > 0 &&
        getValidPlacementsForType(board, architects, playerId, BuildingType.Palace, monumentsVariant).length > 0
    )
        return true
    if (
        buildings.towers > 0 &&
        getValidPlacementsForType(board, architects, playerId, BuildingType.Tower, monumentsVariant).length > 0
    )
        return true
    return false
}

export function hasAnyValidPlacementAfterReposition(
    board: BoardSquare[],
    architects: number[],
    playerId: string,
    buildings: { houses: number; palaces: number; towers: number },
    monumentsVariant = false
): boolean {
    for (let architectIndex = 0; architectIndex < 2; architectIndex++) {
        for (let newPos = 0; newPos < BOARD_SQUARES; newPos++) {
            if (!isValidRepositionTarget(board, architects, architectIndex, newPos)) continue
            const newArchitects = [...architects]
            newArchitects[architectIndex] = newPos
            if (hasAnyValidPlacement(board, newArchitects, playerId, buildings, monumentsVariant)) return true
        }
    }
    return false
}

function findBestMonumentInDistrict(board: BoardSquare[], district: Set<number>): Monument | null {
    let best: Monument | null = null
    for (const p of district) {
        const [r, c] = posToRowCol(p)
        if (c + 2 < BOARD_SIZE) {
            const p1 = rowColToPos(r, c + 1), p2 = rowColToPos(r, c + 2)
            if (district.has(p1) && district.has(p2)) {
                const m = checkMonument(board, p, p1, p2)
                if (m && (!best || m.value > best.value)) best = m
            }
        }
        if (r + 2 < BOARD_SIZE) {
            const p1 = rowColToPos(r + 1, c), p2 = rowColToPos(r + 2, c)
            if (district.has(p1) && district.has(p2)) {
                const m = checkMonument(board, p, p1, p2)
                if (m && (!best || m.value > best.value)) best = m
            }
        }
    }
    return best
}

export type DistrictPlayerStats = {
    total: number
    monumentValue: number
    towers: number
    palaces: number
    houses: number
}

export type DistrictInfo = {
    playerStats: Map<string, DistrictPlayerStats>
    winner: string | null
    contested: boolean
    monuments: Monument[]
}

export function getDistrictInfo(board: BoardSquare[], pos: number, includeMonuments = false): DistrictInfo {
    const district = getDistrictFrom(board, pos)
    const monuments = includeMonuments ? findAllMonumentsInDistrict(board, district) : []
    const monumentPositions = new Set<number>(monuments.flatMap(m => [...m.positions]))

    const playerStats = new Map<string, DistrictPlayerStats>()
    for (const p of district) {
        const sq = board[p]!
        if (!playerStats.has(sq.playerId)) {
            playerStats.set(sq.playerId, { total: 0, monumentValue: 0, towers: 0, palaces: 0, houses: 0 })
        }
        const stats = playerStats.get(sq.playerId)!
        if (!monumentPositions.has(p)) {
            stats.total += BUILDING_POINTS[sq.buildingType]
        }
        if (sq.buildingType === BuildingType.Tower) stats.towers++
        else if (sq.buildingType === BuildingType.Palace) stats.palaces++
        else stats.houses++
    }

    for (const m of monuments) {
        const stats = playerStats.get(m.winnerId)
        if (stats) { stats.total += m.value; stats.monumentValue += m.value }
    }

    const contested = playerStats.size >= 2
    let winner: string | null = null

    if (contested) {
        const entries = [...playerStats.entries()]
        const [pid1, s1] = entries[0]
        const [pid2, s2] = entries[1]
        if (s1.total !== s2.total) {
            winner = s1.total > s2.total ? pid1 : pid2
        } else if (s1.monumentValue !== s2.monumentValue) {
            winner = s1.monumentValue > s2.monumentValue ? pid1 : pid2
        } else if (s1.towers !== s2.towers) {
            winner = s1.towers > s2.towers ? pid1 : pid2
        } else if (s1.palaces !== s2.palaces) {
            winner = s1.palaces > s2.palaces ? pid1 : pid2
        } else if (s1.houses !== s2.houses) {
            winner = s1.houses > s2.houses ? pid1 : pid2
        }
    }

    return { playerStats, winner, contested, monuments }
}

export function computeDistrictScores(board: BoardSquare[], includeMonuments = false): Map<string, number> {
    const scores = new Map<string, number>()
    const visited = new Set<number>()

    for (let i = 0; i < BOARD_SQUARES; i++) {
        if (board[i] === null || visited.has(i)) continue
        const info = getDistrictInfo(board, i, includeMonuments)
        for (const p of getDistrictFrom(board, i)) visited.add(p)
        if (!info.contested || info.winner === null) continue
        const winnerStats = info.playerStats.get(info.winner)!
        scores.set(info.winner, (scores.get(info.winner) ?? 0) + winnerStats.total)
    }

    return scores
}

export type MonumentType = 'town-wall' | 'ducal-palace' | 'cathedral'

export type Monument = {
    type: MonumentType
    positions: [number, number, number]
    value: number
    winnerId: string
}

const MONUMENT_VALUE: Record<MonumentType, number> = {
    'town-wall': 6,
    'ducal-palace': 10,
    'cathedral': 16,
}

function checkMonument(board: BoardSquare[], p0: number, p1: number, p2: number): Monument | null {
    const b0 = board[p0], b1 = board[p1], b2 = board[p2]
    if (!b0 || !b1 || !b2) return null
    const t0 = b0.buildingType, t1 = b1.buildingType, t2 = b2.buildingType

    let type: MonumentType | null = null
    if (t0 === BuildingType.House && t1 === BuildingType.House && t2 === BuildingType.House) {
        type = 'town-wall'
    } else if (t0 === BuildingType.Palace && t1 === BuildingType.House && t2 === BuildingType.Palace) {
        type = 'ducal-palace'
    } else if (t0 === BuildingType.Tower && t1 === BuildingType.Palace && t2 === BuildingType.Tower) {
        type = 'cathedral'
    }
    if (!type) return null
    if (b0.playerId !== b1.playerId || b1.playerId !== b2.playerId) return null

    return { type, positions: [p0, p1, p2], value: MONUMENT_VALUE[type], winnerId: b0.playerId }
}


export function isValidRepositionTarget(
    board: BoardSquare[],
    currentArchitects: number[],
    architectIndex: number,
    newPos: number
): boolean {
    if (newPos < 0 || newPos >= BOARD_SQUARES) return false
    if (board[newPos] !== null) return false
    if (newPos === currentArchitects[0] || newPos === currentArchitects[1]) return false
    const newArchitects = [...currentArchitects]
    newArchitects[architectIndex] = newPos
    // Repositioning is valid only if the LoS intersection still has empty squares
    return getArchitectIntersection(board, newArchitects).size > 0
}
