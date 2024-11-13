import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { Hydratable, OffsetCoordinates } from '@tabletop/common'
import { Station } from './stations.js'
import { Sundiver } from './sundiver.js'

export type Cell = Static<typeof Cell>
export const Cell = Type.Object({
    coords: OffsetCoordinates,
    station: Station,
    sundivers: Type.Array(Sundiver)
})

export type Gate = Static<typeof Gate>
export const Gate = Type.Object({
    innerCoords: OffsetCoordinates,
    outerCoords: OffsetCoordinates,
    playerId: Type.String()
})

export type SolGameBoard = Static<typeof SolGameBoard>
export const SolGameBoard = Type.Object({
    cells: Type.Record(Type.Number(), Cell)
})

export const SolGameBoardValidator = TypeCompiler.Compile(SolGameBoard)

export class HydratedSolGameBoard extends Hydratable<typeof SolGameBoard> implements SolGameBoard {
    declare cells: Record<number, Cell>
    declare gates: Record<string, Gate>

    constructor(data: SolGameBoard) {
        super(data, SolGameBoardValidator)
    }
}
