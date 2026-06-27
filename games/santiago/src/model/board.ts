import * as Type from 'typebox'

export enum CropType {
    Bananas = 'bananas',
    Coconut = 'coconut',
    Grapes = 'grapes',
    Watermelon = 'watermelon',
    Chili = 'chili'
}

export enum SquareType {
    Empty = 'empty',
    Field = 'field'
}

// Canal segment — identified by orientation, col, and row.
//
// Horizontal (H): runs along y = row*2 boundary, spanning board cols [col*2, (col+1)*2 - 1].
//   Valid ranges: col ∈ [0,3], row ∈ [0,3]  → 4×4 = 16 horizontal segments
//
// Vertical (V): runs along x = col*2 boundary, spanning board rows [row*2, (row+1)*2 - 1].
//   Valid ranges: col ∈ [0,4], row ∈ [0,2]  → 5×3 = 15 vertical segments
//
// Total: 31 possible canal positions.
export type CanalSegment = Type.Static<typeof CanalSegment>
export const CanalSegment = Type.Object({
    orientation: Type.Union([Type.Literal('H'), Type.Literal('V')]),
    col: Type.Number(),
    row: Type.Number()
})

// Ditch-line intersection where canals may be rooted or connected.
// col ∈ [0,4] (at board x = col*2), row ∈ [0,3] (at board y = row*2).
export type Intersection = Type.Static<typeof Intersection>
export const Intersection = Type.Object({
    col: Type.Number(),
    row: Type.Number()
})

// An empty square. hasPalmTree is true if a palm tree was placed here during setup.
// A palm tree does not prevent field establishment — it coexists with the field.
export type EmptySquare = Type.Static<typeof EmptySquare>
export const EmptySquare = Type.Object({
    type: Type.Literal(SquareType.Empty),
    hasPalmTree: Type.Boolean({ default: false })
})

// A tile drawn from the bag during the planting phase.
// farmerCapacity: how many farmers the player places when they plant this tile.
// A zero-bidding canal overseer places farmerCapacity - 1 farmers (minimum 0).
export type PlantingTile = Type.Static<typeof PlantingTile>
export const PlantingTile = Type.Object({
    crop: Type.Enum(CropType),
    farmerCapacity: Type.Union([Type.Literal(1), Type.Literal(2)])
})

// A field: one crop tile placed by a player.
// farmerCount: number of farmer tokens on this field. May be 0 if the overseer bid zero
//   and planted a capacity-1 tile. A 0-farmer field scores nothing but counts toward
//   its plantation's size.
// hasPalmTree: palm tree was here at setup; counts as +1 farmer at scoring (only if farmerCount > 0).
// dried: true if this field dried out; dried fields score nothing.
export type FieldSquare = Type.Static<typeof FieldSquare>
export const FieldSquare = Type.Object({
    type: Type.Literal(SquareType.Field),
    crop: Type.Enum(CropType),
    playerId: Type.String(),
    farmerCapacity: Type.Union([Type.Literal(1), Type.Literal(2)]),
    farmerCount: Type.Number({ minimum: 0 }),
    hasPalmTree: Type.Boolean({ default: false }),
    dried: Type.Boolean({ default: false })
})

export type BoardSquare = Type.Static<typeof BoardSquare>
export const BoardSquare = Type.Union([EmptySquare, FieldSquare])

export function isFieldSquare(sq: BoardSquare): sq is FieldSquare {
    return sq.type === SquareType.Field
}

export function isEmptySquare(sq: BoardSquare): sq is EmptySquare {
    return sq.type === SquareType.Empty
}

// Effective farmer count for scoring: own farmers + palm tree bonus.
// Palm tree only counts if the field has at least one farmer (the rule reads
// "along with a player's farmer(s)"). A 0-farmer field scores 0 regardless.
export function fieldStrength(field: FieldSquare): number {
    if (field.farmerCount === 0) return 0
    return field.farmerCount + (field.hasPalmTree ? 1 : 0)
}

// Board: 8 columns × 6 rows of squares.
// squares[col][row] — col ∈ [0,7], row ∈ [0,5].
export type SantiagoBoard = Type.Static<typeof SantiagoBoard>
export const SantiagoBoard = Type.Object({
    squares: Type.Array(Type.Array(BoardSquare)),
    spring: Intersection,
    canals: Type.Array(CanalSegment)
})

export function canalEndpoints(seg: CanalSegment): [Intersection, Intersection] {
    if (seg.orientation === 'H') {
        return [
            { col: seg.col, row: seg.row },
            { col: seg.col + 1, row: seg.row }
        ]
    } else {
        return [
            { col: seg.col, row: seg.row },
            { col: seg.col, row: seg.row + 1 }
        ]
    }
}

export function isSameSegment(a: CanalSegment, b: CanalSegment): boolean {
    return a.orientation === b.orientation && a.col === b.col && a.row === b.row
}

export function isValidSegment(seg: CanalSegment): boolean {
    if (seg.orientation === 'H') {
        return seg.col >= 0 && seg.col <= 3 && seg.row >= 0 && seg.row <= 3
    } else {
        return seg.col >= 0 && seg.col <= 4 && seg.row >= 0 && seg.row <= 2
    }
}
