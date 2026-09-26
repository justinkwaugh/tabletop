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
            buses: Type.Number(),
            stones: Type.Number(),
            score: Type.Number(),
            busLine: Type.Array(Type.String()),
            numActionsChosen: Type.Number()
        })
    ])
)

export const BusPlayerStateValidator = Compile(BusPlayerState)

// Rulebook time-stone penalty: each stone taken costs one point at game end.
export function finalScore(player: BusPlayerState): number {
    return player.score - player.stones
}

export class HydratedBusPlayerState
    extends Hydratable<typeof BusPlayerState>
    implements BusPlayerState
{
    declare playerId: string
    declare color: Color
    declare actions: number
    declare sticks: number
    declare buses: number
    declare stones: number
    declare score: number
    declare busLine: string[]
    declare numActionsChosen: number

    constructor(data: BusPlayerState) {
        super(data, BusPlayerStateValidator)
    }
}
