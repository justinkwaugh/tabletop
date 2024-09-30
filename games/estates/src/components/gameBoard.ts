import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { Hydratable } from '@tabletop/common'
import { Cube } from './cube'
import { Roof } from './roof'

export type Site = Static<typeof Site>
export const Site = Type.Object({
    single: Type.Boolean(),
    cubes: Type.Array(Cube),
    roof: Type.Optional(Roof)
})

export type BoardRow = Static<typeof BoardRow>
export const BoardRow = Type.Object({
    mayor: Type.Boolean(),
    sites: Type.Array(Site)
})

export type EstatesGameBoard = Static<typeof EstatesGameBoard>
export const EstatesGameBoard = Type.Object({
    rows: Type.Array(BoardRow)
})

export const EstatesGameBoardValidator = TypeCompiler.Compile(EstatesGameBoard)

export class HydratedEstatesGameBoard
    extends Hydratable<typeof EstatesGameBoard>
    implements EstatesGameBoard
{
    declare rows: BoardRow[]

    constructor(data: EstatesGameBoard) {
        super(data, EstatesGameBoardValidator)
    }
}
