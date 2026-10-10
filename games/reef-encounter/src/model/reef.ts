import {
    CardinalDirection,
    cellNeighborCoords,
    OffsetCoordinates,
    sameCoordinates
} from '@tabletop/common'
import * as Type from 'typebox'
import { AlgaColor, CoralColor } from '../components/colors.js'
import { faceUp, type CoralTileState } from '../components/coralTiles.js'
import { ReefBoardIdSchema } from '../components/reefBoards.js'

export type Polyp = Type.Static<typeof Polyp>
export const Polyp = Type.Object({
    coords: OffsetCoordinates,
    color: Type.Enum(CoralColor)
})

export type Reef = Type.Static<typeof Reef>
export const Reef = Type.Object({
    boardId: ReefBoardIdSchema,
    polyps: Type.Array(Polyp)
})

export type Shrimp = Type.Static<typeof Shrimp>
export const Shrimp = Type.Object({
    playerId: Type.String(),
    boardId: ReefBoardIdSchema,
    coords: OffsetCoordinates
})

export type ReefSquare = Type.Static<typeof ReefSquare>
export const ReefSquare = Type.Object({
    boardId: ReefBoardIdSchema,
    coords: OffsetCoordinates
})

export type CoralEaten = Type.Static<typeof CoralEaten>
export const CoralEaten = Type.Object({
    color: Type.Enum(CoralColor),
    polyps: Type.Number(),
    returnedToBag: Type.Number(),
    shrimpToOpenSea: Type.Boolean(),
    startsFinalTurns: Type.Optional(Type.Literal(true))
})

export type AlgaPlayed = Type.Static<typeof AlgaPlayed>
export const AlgaPlayed = Type.Object({
    flippedTileIds: Type.Array(Type.Number()),
    replacedCylinder: Type.Optional(Type.Enum(AlgaColor)),
    startsFinalTurns: Type.Optional(Type.Literal(true))
})

export type PolypPlacement = Type.Static<typeof PolypPlacement>
export const PolypPlacement = Type.Object({
    color: Type.Enum(CoralColor),
    attacked: Type.Optional(Type.Enum(CoralColor)),
    extraGrowth: Type.Optional(OffsetCoordinates)
})

const Directions = Object.values(CardinalDirection)

export function orthogonalNeighbors(coords: OffsetCoordinates): OffsetCoordinates[] {
    return Directions.map((direction) => cellNeighborCoords(coords, direction))
}

export function polypAt(reef: Reef, coords: OffsetCoordinates): Polyp | undefined {
    return reef.polyps.find((polyp) => sameCoordinates(polyp.coords, coords))
}

// A coral is every polyp of one colour connected orthogonally to the polyp at coords.
export function coralAt(reef: Reef, coords: OffsetCoordinates): Polyp[] {
    const start = polypAt(reef, coords)
    if (!start) {
        return []
    }
    const coral: Polyp[] = [start]
    for (let index = 0; index < coral.length; index++) {
        for (const neighbor of orthogonalNeighbors(coral[index].coords)) {
            const polyp = polypAt(reef, neighbor)
            if (polyp && polyp.color === start.color && !coral.includes(polyp)) {
                coral.push(polyp)
            }
        }
    }
    return coral
}

export function neighboringCorals(
    reef: Reef,
    coords: OffsetCoordinates,
    color: CoralColor
): Polyp[][] {
    const corals: Polyp[][] = []
    for (const neighbor of orthogonalNeighbors(coords)) {
        const polyp = polypAt(reef, neighbor)
        if (!polyp || polyp.color !== color || corals.some((coral) => coral.includes(polyp))) {
            continue
        }
        corals.push(coralAt(reef, neighbor))
    }
    return corals
}

export function shrimpAt(
    shrimps: readonly Shrimp[],
    coords: OffsetCoordinates
): Shrimp | undefined {
    return shrimps.find((shrimp) => sameCoordinates(shrimp.coords, coords))
}

export function isGuarded(coral: readonly Polyp[], shrimps: readonly Shrimp[]): boolean {
    return coral.some((polyp) => shrimpAt(shrimps, polyp.coords) !== undefined)
}

// A shrimp protects its own polyp and the polyps of the same coral orthogonally next to it.
export function isProtected(
    reef: Reef,
    shrimps: readonly Shrimp[],
    coords: OffsetCoordinates
): boolean {
    if (shrimpAt(shrimps, coords)) {
        return true
    }
    const coral = coralAt(reef, coords)
    return orthogonalNeighbors(coords).some(
        (neighbor) =>
            shrimpAt(shrimps, neighbor) !== undefined &&
            coral.some((polyp) => sameCoordinates(polyp.coords, neighbor))
    )
}

// A polyp may never join two corals of its colour that each carry a shrimp.
export function joinsGuardedCorals(
    reef: Reef,
    shrimps: readonly Shrimp[],
    coords: OffsetCoordinates,
    color: CoralColor
): boolean {
    const guarded = neighboringCorals(reef, coords, color).filter((coral) =>
        isGuarded(coral, shrimps)
    )
    return guarded.length > 1
}

// Every pair of colours shares exactly one coral tile, whose face shows which is stronger.
export function isStronger(
    coralTiles: readonly CoralTileState[],
    attacker: CoralColor,
    defender: CoralColor
): boolean {
    return coralTiles.some((tile) => {
        const face = faceUp(tile)
        return face.stronger === attacker && face.weaker === defender
    })
}
