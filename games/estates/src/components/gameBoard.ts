import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { Hydratable } from '@tabletop/common'

export type EstatesGameBoard = Static<typeof EstatesGameBoard>
export const EstatesGameBoard = Type.Object({})

export const EstatesGameBoardValidator = TypeCompiler.Compile(EstatesGameBoard)

export class HydratedEstatesGameBoard
    extends Hydratable<typeof EstatesGameBoard>
    implements EstatesGameBoard
{
    constructor(data: EstatesGameBoard) {
        super(data, EstatesGameBoardValidator)
    }
}
