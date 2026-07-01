import { SantiagoBoard, CropType, FieldSquare, isFieldSquare, fieldStrength } from '../model/board.js'
import { connectedSpringIntersections, isIrrigated } from './irrigation.js'

export type PlayerScores = Record<string, number>

// Scoring formula (applied once at the end of each round, and at game end):
//
// For each irrigated, non-dried field:
//   1. Find the plantation it belongs to — a connected group (4-directional) of
//      irrigated, non-dried fields of the same crop type.
//   2. plantation_size = number of fields in that group.
//   3. The owning player scores fieldStrength(field) × plantation_size.
//      fieldStrength = farmerCount + (1 if hasPalmTree else 0).
//
// Fields with only a palm tree (no player farmers) are excluded by isFieldSquare.
// Live scores during the game: all non-dried fields count, irrigated or not.
// Only at game end does irrigation matter (calculateScores below).
export function calculateLiveScores(board: SantiagoBoard): PlayerScores {
    const scores: PlayerScores = {}

    for (const cropType of Object.values(CropType)) {
        const groups = findConnectedGroupsAny(board, cropType)
        for (const { fields } of groups) {
            const size = fields.length
            for (const field of fields) {
                if (!field.playerId) continue  // neutral plantation
                scores[field.playerId] = (scores[field.playerId] ?? 0) + fieldStrength(field) * size
            }
        }
    }

    return scores
}

function findConnectedGroupsAny(board: SantiagoBoard, crop: CropType): FieldGroup[] {
    const visited = new Set<string>()
    const groups: FieldGroup[] = []

    for (let col = 0; col < 8; col++) {
        for (let row = 0; row < 6; row++) {
            const key = `${col},${row}`
            if (visited.has(key)) continue
            const sq = board.squares[col][row]
            if (!isFieldSquare(sq) || sq.crop !== crop || sq.dried) continue

            const fields: FieldSquare[] = []
            const queue: [number, number][] = [[col, row]]
            while (queue.length > 0) {
                const [c, r] = queue.shift()!
                const k = `${c},${r}`
                if (visited.has(k)) continue
                visited.add(k)
                const s = board.squares[c][r]
                if (!isFieldSquare(s) || s.crop !== crop || s.dried) continue
                fields.push(s)
                for (const [nc, nr] of [[c-1,r],[c+1,r],[c,r-1],[c,r+1]] as [number,number][]) {
                    if (nc >= 0 && nc < 8 && nr >= 0 && nr < 6 && !visited.has(`${nc},${nr}`)) queue.push([nc, nr])
                }
            }
            if (fields.length > 0) groups.push({ fields })
        }
    }

    return groups
}

export function calculateScores(board: SantiagoBoard): PlayerScores {
    const scores: PlayerScores = {}
    const connected = connectedSpringIntersections(board)

    for (const cropType of Object.values(CropType)) {
        const groups = findConnectedGroups(board, cropType, connected)
        const plantationSize = groups.map((g) => g.fields.length)

        for (let i = 0; i < groups.length; i++) {
            const { fields } = groups[i]
            const size = plantationSize[i]
            for (const field of fields) {
                if (!field.playerId) continue  // neutral plantation — counts toward size but has no owner
                const strength = fieldStrength(field)
                scores[field.playerId] = (scores[field.playerId] ?? 0) + strength * size
            }
        }
    }

    return scores
}

type FieldGroup = {
    fields: FieldSquare[]
}

// Find connected groups of irrigated, non-dried fields of a given crop type.
// Connectivity is 4-directional. Only fields belonging to any player are included
// (palm-tree-only squares are EmptySquares and are skipped by isFieldSquare).
function findConnectedGroups(
    board: SantiagoBoard,
    crop: CropType,
    connected: Set<string>
): FieldGroup[] {
    const visited = new Set<string>()
    const groups: FieldGroup[] = []

    for (let col = 0; col < 8; col++) {
        for (let row = 0; row < 6; row++) {
            const key = `${col},${row}`
            if (visited.has(key)) continue

            const sq = board.squares[col][row]
            if (!isFieldSquare(sq) || sq.crop !== crop || sq.dried) continue
            if (!isIrrigated(board, col, row, connected)) continue

            const fields = floodFill(board, col, row, crop, connected, visited)
            if (fields.length > 0) groups.push({ fields })
        }
    }

    return groups
}

function floodFill(
    board: SantiagoBoard,
    startCol: number,
    startRow: number,
    crop: CropType,
    connected: Set<string>,
    visited: Set<string>
): FieldSquare[] {
    const fields: FieldSquare[] = []
    const queue: [number, number][] = [[startCol, startRow]]

    while (queue.length > 0) {
        const [col, row] = queue.shift()!
        const key = `${col},${row}`
        if (visited.has(key)) continue
        visited.add(key)

        const sq = board.squares[col][row]
        if (!isFieldSquare(sq) || sq.crop !== crop || sq.dried) continue
        if (!isIrrigated(board, col, row, connected)) continue

        fields.push(sq)

        for (const [nc, nr] of [[col - 1, row], [col + 1, row], [col, row - 1], [col, row + 1]] as [number, number][]) {
            if (nc >= 0 && nc < 8 && nr >= 0 && nr < 6 && !visited.has(`${nc},${nr}`)) {
                queue.push([nc, nr])
            }
        }
    }

    return fields
}
