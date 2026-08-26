import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PoliticsCard, PoliticsCardType } from '../definition/politicsCards.js'

export type SubmitDuelBidMetadata = Type.Static<typeof SubmitDuelBidMetadata>
export const SubmitDuelBidMetadata = Type.Object({
    // A snapshot of the Treasure card(s) used (if any), captured here since the cards
    // themselves get removed from the bidder's hand if they end up winning - history
    // needs to be able to describe them even after that happens.
    treasureCardsUsed: Type.Optional(Type.Array(PoliticsCard)),
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
            // Any number of Treasure cards added to this bid, on top of the ducat amount -
            // "it can be used during a duel together with other money cards, or on
            // its own." Nothing in the rulebook limits a bid to just one. Only spent
            // (discarded) if this bid ends up winning.
            treasureCardIds: Type.Optional(Type.Array(Type.String())),
            metadata: Type.Optional(SubmitDuelBidMetadata)
        })
    ])
)

export const SubmitDuelBidValidator = Compile(SubmitDuelBid)

export function isSubmitDuelBid(action?: GameAction): action is SubmitDuelBid {
    return action?.type === ActionType.SubmitDuelBid
}

// One participant's bid in a duel over a tied slot. Bids aren't concealed from other clients:
// the platform serves the same state and action log to everyone, so nothing a game package puts
// in state can be private (see the note on politicsCards in model/playerState.ts). A
// simplification versus the rulebook's genuinely blind bids, and one that needs platform
// support to lift rather than a change here.
export class HydratedSubmitDuelBid
    extends HydratableAction<typeof SubmitDuelBid>
    implements SubmitDuelBid
{
    declare type: ActionType.SubmitDuelBid
    declare playerId: string
    declare amount: number
    declare treasureCardIds?: string[]
    declare metadata?: SubmitDuelBidMetadata

    constructor(data: SubmitDuelBid) {
        super(data, SubmitDuelBidValidator)
    }

    apply(state: HydratedLowenherzGameState, context?: MachineContext) {
        if (!this.isValidSubmitDuelBid(state)) {
            throw Error('Invalid SubmitDuelBid action')
        }

        const treasureCardIds = this.treasureCardIds ?? []
        state.duel!.bids.push({
            playerId: this.playerId,
            amount: this.amount,
            ...(treasureCardIds.length > 0 ? { treasureCardIds } : {})
        })

        const myCards = state.getPlayerState(this.playerId).politicsCards
        const treasureCards = treasureCardIds
            .map((id) => myCards.find((c) => c.id === id))
            .filter((card): card is PoliticsCard => card !== undefined)
        this.metadata = treasureCards.length > 0 ? { treasureCardsUsed: treasureCards } : {}
    }

    isValidSubmitDuelBid(state: HydratedLowenherzGameState): boolean {
        const duel = state.duel
        if (!duel) return false
        if (!duel.playerIds.includes(this.playerId)) return false
        if (duel.bids.some((b) => b.playerId === this.playerId)) return false

        const myMoney = state.getPlayerState(this.playerId).money
        if (!Number.isInteger(this.amount) || this.amount < 0 || this.amount > myMoney) return false

        const treasureCardIds = this.treasureCardIds ?? []
        if (new Set(treasureCardIds).size !== treasureCardIds.length) return false

        const myCards = state.getPlayerState(this.playerId).politicsCards
        for (const id of treasureCardIds) {
            const card = myCards.find((c) => c.id === id)
            if (!card || card.type !== PoliticsCardType.Treasure) return false
        }

        return true
    }
}
