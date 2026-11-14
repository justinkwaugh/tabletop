import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color, Hydratable, PlayerState } from '@tabletop/common'
import { Industry } from '../editions/types.js'

export type RailheadsPlayerState = Type.Static<typeof RailheadsPlayerState>
export const RailheadsPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            cash: Type.Number(),
            industryTokens: Type.Array(Type.Enum(Industry)),
            // Toll chits held, by bridge or tunnel id.
            tolls: Type.Optional(Type.Array(Type.String())),
            creditSuisse: Type.Optional(Type.Number()),
            bonds: Type.Optional(Type.Number())
        })
    ])
)

export const RailheadsPlayerStateValidator = Compile(RailheadsPlayerState)

export class HydratedRailheadsPlayerState
    extends Hydratable<typeof RailheadsPlayerState>
    implements RailheadsPlayerState
{
    declare playerId: string
    declare color: Color
    declare cash: number
    declare industryTokens: Industry[]
    declare tolls?: string[]
    declare creditSuisse?: number
    declare bonds?: number

    constructor(data: RailheadsPlayerState) {
        super(data, RailheadsPlayerStateValidator)
    }

    tokensOf(industry: Industry): number {
        return this.industryTokens.filter((token) => token === industry).length
    }
}
