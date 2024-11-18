import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { Hydratable, OffsetCoordinates } from '@tabletop/common'
import { Station } from './stations.js'
import { Sundiver } from './sundiver.js'
import { SolarGate } from './solarGate.js'

export type Cell = Static<typeof Cell>
export const Cell = Type.Object({
    coords: OffsetCoordinates,
    station: Station,
    sundivers: Type.Array(Sundiver)
})

export type SolGameBoard = Static<typeof SolGameBoard>
export const SolGameBoard = Type.Object({
    cells: Type.Record(Type.Number(), Cell)
})

export const SolGameBoardValidator = TypeCompiler.Compile(SolGameBoard)

export class HydratedSolGameBoard extends Hydratable<typeof SolGameBoard> implements SolGameBoard {
    declare cells: Record<number, Cell>
    declare gates: Record<string, SolarGate>

    constructor(data: SolGameBoard) {
        super(data, SolGameBoardValidator)
    }
}
