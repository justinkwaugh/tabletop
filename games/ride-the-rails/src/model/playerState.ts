import { Color, Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'

export type RideTheRailsPlayerState = Type.Static<typeof RideTheRailsPlayerState>
export const RideTheRailsPlayerState = Type.Evaluate(Type.Intersect([PlayerState, Type.Object({})]))

export const RideTheRailsPlayerStateValidator = Compile(RideTheRailsPlayerState)

export class HydratedRideTheRailsPlayerState
    extends Hydratable<typeof RideTheRailsPlayerState>
    implements RideTheRailsPlayerState
{
    declare playerId: string
    declare color: Color

    constructor(data: RideTheRailsPlayerState) {
        super(data, RideTheRailsPlayerStateValidator)
    }
}
