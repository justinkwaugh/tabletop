import { Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color } from '@tabletop/common'

export type BusPlayerState = Type.Static<typeof BusPlayerState>
export const BusPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({

        })
    ])
)

export const BusPlayerStateValidator = Compile(BusPlayerState)

export class HydratedBusPlayerState
    extends Hydratable<typeof BusPlayerState>
    implements BusPlayerState
{
    declare playerId: string
    declare color: Color

    constructor(data: BusPlayerState) {
        super(data, BusPlayerStateValidator)
    }
}
