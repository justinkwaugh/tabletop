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
            // Held face-down at the table, but plain visible state here - and that cannot
            // currently be fixed from a game package. The platform serves one authoritative
            // state and the entire action log to every client (GET /api/game/:id returns
            // game.state plus all actions, unfiltered and identical for every requester), so
            // anything in state, or derivable from the actions, is in every player's browser.
            // Drawing an opponent's hand face-down is presentation, not concealment.
            //
            // Every game here with concealed information has this shape - Indonesia's city
            // cards, Sol's cards, and duel bids in this engine (see submitDuelBid.ts). Real
            // concealment needs per-player redaction in the platform, of both served state and
            // broadcast actions; the piles below leak their future order the same way.
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
