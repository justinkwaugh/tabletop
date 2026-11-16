import { Color, Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { RailroadId } from '../data/railroads.js'

// R-3.1: no cap on one railroad's shares; a railroad with none is absent.
export type Shares = Type.Static<typeof Shares>
export const Shares = Type.Options(
    Type.Partial(Type.Record(RailroadId, Type.Integer({ minimum: 0 }))),
    {
        additionalProperties: false
    }
)

export type RideTheRailsPlayerState = Type.Static<typeof RideTheRailsPlayerState>
export const RideTheRailsPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            // R-2.4: a single exact total, only ever gained.
            money: Type.Integer({ minimum: 0 }),
            shares: Shares
        })
    ])
)

export const RideTheRailsPlayerStateValidator = Compile(RideTheRailsPlayerState)

export class HydratedRideTheRailsPlayerState
    extends Hydratable<typeof RideTheRailsPlayerState>
    implements RideTheRailsPlayerState
{
    declare playerId: string
    declare color: Color
    declare money: number
    declare shares: Shares

    constructor(data: RideTheRailsPlayerState) {
        super(data, RideTheRailsPlayerStateValidator)
    }

    sharesOf(railroadId: RailroadId): number {
        return this.shares[railroadId] ?? 0
    }
}
