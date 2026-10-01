import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color, Hydratable, PlayerState } from '@tabletop/common'

export const TILES_PER_TYPE = 20
export const STARTING_SUPPLY = 4

export type MagnaGreciaPlayerState = Type.Static<typeof MagnaGreciaPlayerState>
export const MagnaGreciaPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            points: Type.Number(),
            supplyRoads: Type.Number(),
            stagingRoads: Type.Number(),
            supplyCities: Type.Number(),
            stagingCities: Type.Number()
        })
    ])
)

export const MagnaGreciaPlayerStateValidator = Compile(MagnaGreciaPlayerState)

export class HydratedMagnaGreciaPlayerState
    extends Hydratable<typeof MagnaGreciaPlayerState>
    implements MagnaGreciaPlayerState
{
    declare playerId: string
    declare color: Color
    declare points: number
    declare supplyRoads: number
    declare stagingRoads: number
    declare supplyCities: number
    declare stagingCities: number

    constructor(data: MagnaGreciaPlayerState) {
        super(data, MagnaGreciaPlayerStateValidator)
    }
}
