import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { Hydratable } from '@tabletop/common'
import { MasterType } from '../definition/masterType.js'
import { HydratedVillage, Village } from './village.js'

export type Placement = Static<typeof Placement>
export const Placement = Type.Object({
    masterType: Type.Enum(MasterType),
    village: Type.Number()
})

export type BridgesGameBoard = Static<typeof BridgesGameBoard>
export const BridgesGameBoard = Type.Object({
    villages: Type.Array(Village)
})

export const BridgesGameBoardValidator = TypeCompiler.Compile(BridgesGameBoard)

export class HydratedBridgesGameBoard
    extends Hydratable<typeof BridgesGameBoard>
    implements BridgesGameBoard
{
    declare villages: HydratedVillage[]

    constructor(data: BridgesGameBoard) {
        const hydratedVillages = data.villages.map((village) => new HydratedVillage(village))
        super(data, BridgesGameBoardValidator, { villages: hydratedVillages })
    }

    hasVillage(villageIndex: number) {
        return villageIndex >= 0 && villageIndex < this.villages.length
    }

    numVillagesOccupiedByPlayer(playerId: string) {
        return this.villages.filter((village) => village.numberOfMastersForPlayer(playerId) > 0)
            .length
    }

    numMastersForPlayer(playerId: string) {
        return this.villages.reduce(
            (acc, village) => acc + village.numberOfMastersForPlayer(playerId),
            0
        )
    }
}
