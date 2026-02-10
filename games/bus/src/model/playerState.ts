import { Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color } from '@tabletop/common'

export type BusPlayerState = Type.Static<typeof BusPlayerState>
export const BusPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            actions: Type.Number(),
            sticks: Type.Number(),
            busses: Type.Number(),
            stones: Type.Number(),
            score: Type.Number()
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
    declare actions: number
    declare sticks: number
    declare busses: number
    declare stones: number
    declare score: number

    constructor(data: BusPlayerState) {
        super(data, BusPlayerStateValidator)
    }
}
