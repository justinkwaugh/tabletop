import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { Hydratable } from '@tabletop/common'
import { Island } from './island.js'
import { Cell } from '../definition/cells.js'

export type KaivaiGameBoard = Static<typeof KaivaiGameBoard>
export const KaivaiGameBoard = Type.Object({
    cells: Type.Record(Type.Number(), Cell),
    islands: Type.Array(Island)
})

export const KaivaiGameBoardValidator = TypeCompiler.Compile(KaivaiGameBoard)

export class HydratedKaivaiGameBoard
    extends Hydratable<typeof KaivaiGameBoard>
    implements KaivaiGameBoard
{
    declare cells: Record<number, Cell>
    declare islands: Island[]

    constructor(data: KaivaiGameBoard) {
        super(data, KaivaiGameBoardValidator)
    }
}
