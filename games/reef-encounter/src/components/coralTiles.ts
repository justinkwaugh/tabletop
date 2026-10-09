import { assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import { AlgaColor, CoralColor } from './colors.js'

export type CoralTileFace = {
    stronger: CoralColor
    weaker: CoralColor
    largeAlga: AlgaColor
    smallAlga: AlgaColor
}

export type CoralTileDefinition = {
    id: number
    starfishSide: CoralTileFace
}

function tile(
    id: number,
    stronger: CoralColor,
    weaker: CoralColor,
    largeAlga: AlgaColor,
    smallAlga: AlgaColor
): CoralTileDefinition {
    return { id, starfishSide: { stronger, weaker, largeAlga, smallAlga } }
}

// Second edition, starfish side; confirmed against photographs of both sides of every tile.
export const CoralTiles: readonly CoralTileDefinition[] = [
    tile(1, CoralColor.Grey, CoralColor.Yellow, AlgaColor.Blue, AlgaColor.Red),
    tile(2, CoralColor.Orange, CoralColor.Pink, AlgaColor.Green, AlgaColor.Red),
    tile(3, CoralColor.White, CoralColor.Yellow, AlgaColor.Green, AlgaColor.Blue),
    tile(4, CoralColor.Pink, CoralColor.Grey, AlgaColor.Green, AlgaColor.Purple),
    tile(5, CoralColor.Yellow, CoralColor.Pink, AlgaColor.Purple, AlgaColor.Blue),
    tile(6, CoralColor.Grey, CoralColor.White, AlgaColor.Red, AlgaColor.Purple),
    tile(7, CoralColor.Orange, CoralColor.Grey, AlgaColor.Blue, AlgaColor.Green),
    tile(8, CoralColor.White, CoralColor.Orange, AlgaColor.Red, AlgaColor.Purple),
    tile(9, CoralColor.Pink, CoralColor.White, AlgaColor.Purple, AlgaColor.Green),
    tile(10, CoralColor.Yellow, CoralColor.Orange, AlgaColor.Blue, AlgaColor.Red)
]

export type CoralTileState = Type.Static<typeof CoralTileState>
export const CoralTileState = Type.Object({
    tileId: Type.Number(),
    starfishSideUp: Type.Boolean(),
    // An alga cylinder on a tile locks it on its current side for the rest of the game.
    cylinder: Type.Optional(Type.Enum(AlgaColor))
})

// The reverse of every tile swaps both the corals and the algae (rulebook p. 10).
export function faceUp(tile: CoralTileState): CoralTileFace {
    const definition = CoralTiles.find((candidate) => candidate.id === tile.tileId)
    assertExists(definition, `No coral tile ${tile.tileId}`)
    const front = definition.starfishSide
    if (tile.starfishSideUp) {
        return front
    }
    return {
        stronger: front.weaker,
        weaker: front.stronger,
        largeAlga: front.smallAlga,
        smallAlga: front.largeAlga
    }
}
