import { Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color } from '@tabletop/common'

export type LowenherzPlayerState = Type.Static<typeof LowenherzPlayerState>
export const LowenherzPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            money: Type.Number(),
            powerPoints: Type.Number(),
            knightsInStock: Type.Number() // starts at 12, minus those placed on the board
        })
    ])
)

export const LowenherzPlayerStateValidator = Compile(LowenherzPlayerState)

export class HydratedLowenherzPlayerState
    extends Hydratable<typeof LowenherzPlayerState>
    implements LowenherzPlayerState
{
    declare playerId: string
    declare color: Color
    declare money: number
    declare powerPoints: number
    declare knightsInStock: number

    constructor(data: LowenherzPlayerState) {
        super(data, LowenherzPlayerStateValidator)
    }
}
