import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { Hydratable } from '@tabletop/common'
import { MasterType } from './tiles'

export type VillageSpace = Static<typeof VillageSpace>
export const VillageSpace = Type.Object({
    playerId: Type.Optional(Type.String()),
    count: Type.Number()
})

export type Village = Static<typeof Village>
export const Village = Type.Object({
    spaces: Type.Record(Type.Enum(MasterType), VillageSpace),
    neighbors: Type.Array(Type.Number()),
    stone: Type.Boolean()
})

export type BridgesGameBoard = Static<typeof BridgesGameBoard>
export const BridgesGameBoard = Type.Object({
    villages: Type.Array(Village)
})

export const BridgesGameBoardValidator = TypeCompiler.Compile(BridgesGameBoard)

export class HydratedGameBoard
    extends Hydratable<typeof BridgesGameBoard>
    implements BridgesGameBoard
{
    declare villages: Village[]

    constructor(data: BridgesGameBoard) {
        super(data, BridgesGameBoardValidator)
    }
}
