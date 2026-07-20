import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type SubmitDuelBidMetadata = Type.Static<typeof SubmitDuelBidMetadata>
export const SubmitDuelBidMetadata = Type.Object({})

export type SubmitDuelBid = Type.Static<typeof SubmitDuelBid>
export const SubmitDuelBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SubmitDuelBid),
            playerId: Type.String(),
            amount: Type.Number(),
            metadata: Type.Optional(SubmitDuelBidMetadata)
        })
    ])
)

export const SubmitDuelBidValidator = Compile(SubmitDuelBid)

export function isSubmitDuelBid(action?: GameAction): action is SubmitDuelBid {
    return action?.type === ActionType.SubmitDuelBid
}

// One participant's bid in a duel over a tied slot. Bids aren't hidden from other
// clients in this implementation (money is plain visible state, not private per-player
// state) - a simplification versus the rulebook's genuinely blind/concealed bids.
export class HydratedSubmitDuelBid
    extends HydratableAction<typeof SubmitDuelBid>
    implements SubmitDuelBid
{
    declare type: ActionType.SubmitDuelBid
    declare playerId: string
    declare amount: number
    declare metadata?: SubmitDuelBidMetadata

    constructor(data: SubmitDuelBid) {
        super(data, SubmitDuelBidValidator)
    }

    apply(state: HydratedLowenherzGameState, context?: MachineContext) {
        if (!this.isValidSubmitDuelBid(state)) {
            throw Error('Invalid SubmitDuelBid action')
        }

        state.duel!.bids.push({ playerId: this.playerId, amount: this.amount })
        this.metadata = {}
    }

    isValidSubmitDuelBid(state: HydratedLowenherzGameState): boolean {
        const duel = state.duel
        if (!duel) return false
        if (!duel.playerIds.includes(this.playerId)) return false
        if (duel.bids.some((b) => b.playerId === this.playerId)) return false

        const myMoney = state.getPlayerState(this.playerId).money
        return Number.isInteger(this.amount) && this.amount >= 0 && this.amount <= myMoney
    }
}
