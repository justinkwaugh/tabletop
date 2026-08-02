import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PoliticsCard, PoliticsCardType } from '../definition/politicsCards.js'

export type SubmitDuelBidMetadata = Type.Static<typeof SubmitDuelBidMetadata>
export const SubmitDuelBidMetadata = Type.Object({
    // A snapshot of the Treasure card used (if any), captured here since the card
    // itself gets removed from the bidder's hand if they end up winning - history
    // needs to be able to describe it even after that happens.
    treasureCardUsed: Type.Optional(PoliticsCard),
    // Set only on the bid that COMPLETES a duel round (the last bidder), recording how
    // that round ended so history can describe it: 'win' (someone outbid everyone),
    // 'reduel' (tie for the top bid - the tied players duel again), or 'giveUp' (a
    // second consecutive tie, so no one performs the action). reduelPlayerIds lists
    // the tied players for 'reduel'/'giveUp'; winnerId is set for 'win'.
    duelResult: Type.Optional(
        Type.Union([Type.Literal('win'), Type.Literal('reduel'), Type.Literal('giveUp')])
    ),
    reduelPlayerIds: Type.Optional(Type.Array(Type.String())),
    winnerId: Type.Optional(Type.String())
})

export type SubmitDuelBid = Type.Static<typeof SubmitDuelBid>
export const SubmitDuelBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SubmitDuelBid),
            playerId: Type.String(),
            amount: Type.Number(),
            // Optional Treasure card added to this bid, on top of the ducat amount -
            // "it can be used during a duel together with other money cards, or on
            // its own." Only spent (discarded) if this bid ends up winning.
            treasureCardId: Type.Optional(Type.String()),
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
    declare treasureCardId?: string
    declare metadata?: SubmitDuelBidMetadata

    constructor(data: SubmitDuelBid) {
        super(data, SubmitDuelBidValidator)
    }

    apply(state: HydratedLowenherzGameState, context?: MachineContext) {
        if (!this.isValidSubmitDuelBid(state)) {
            throw Error('Invalid SubmitDuelBid action')
        }

        state.duel!.bids.push({
            playerId: this.playerId,
            amount: this.amount,
            ...(this.treasureCardId ? { treasureCardId: this.treasureCardId } : {})
        })

        const treasureCard = this.treasureCardId
            ? state.getPlayerState(this.playerId).politicsCards.find((c) => c.id === this.treasureCardId)
            : undefined
        this.metadata = treasureCard ? { treasureCardUsed: treasureCard } : {}
    }

    isValidSubmitDuelBid(state: HydratedLowenherzGameState): boolean {
        const duel = state.duel
        if (!duel) return false
        if (!duel.playerIds.includes(this.playerId)) return false
        if (duel.bids.some((b) => b.playerId === this.playerId)) return false

        const myMoney = state.getPlayerState(this.playerId).money
        if (!Number.isInteger(this.amount) || this.amount < 0 || this.amount > myMoney) return false

        if (this.treasureCardId) {
            const card = state.getPlayerState(this.playerId).politicsCards.find((c) => c.id === this.treasureCardId)
            if (!card || card.type !== PoliticsCardType.Treasure) return false
        }

        return true
    }
}
