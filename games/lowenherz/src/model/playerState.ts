import { Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color } from '@tabletop/common'
import { PoliticsCard } from '../definition/politicsCards.js'

export type LowenherzPlayerState = Type.Static<typeof LowenherzPlayerState>
export const LowenherzPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            money: Type.Number(),
            powerPoints: Type.Number(),
            knightsInStock: Type.Number(), // starts at 12, minus those placed on the board
            // Held face-down until played (per the rulebook) - kept as plain visible
            // state like everything else in this engine (see submitDuelBid.ts's note
            // on the same simplification for duel bids); the UI is responsible for not
            // showing other players' hands.
            politicsCards: Type.Array(PoliticsCard)
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
    declare politicsCards: PoliticsCard[]

    constructor(data: LowenherzPlayerState) {
        super(data, LowenherzPlayerStateValidator)
    }
}
