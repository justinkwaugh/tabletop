import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    Visibility,
    assertExists,
    GameAction,
    HydratableAction,
    MachineContext
} from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PoliticsCard, PoliticsCardType, hasPoliticsCards } from '../definition/politicsCards.js'

export type SubmitDuelBidMetadata = Type.Static<typeof SubmitDuelBidMetadata>
export const SubmitDuelBidMetadata = Type.Object({
    roundResult: Type.Optional(
        Type.Object({
            slot: Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)]),
            bids: Type.Array(
                Type.Object({
                    playerId: Type.String(),
                    amount: Type.Number(),
                    treasureValues: Type.Array(Type.Number())
                })
            )
        })
    ),
    // A snapshot of the Treasure card(s) used (if any), captured here since the cards
    // themselves get removed from the bidder's hand if they end up winning - history
    // needs to be able to describe them even after that happens.
    treasureCardsUsed: Visibility.protect(Type.Optional(Type.Array(PoliticsCard)), {
        policy: Visibility.Policy.Actor
    }),
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
export const SubmitDuelBid = Type.Object({
    ...Type.Omit(GameAction, ['playerId']).properties,
    type: Type.Literal(ActionType.SubmitDuelBid),
    playerId: Type.String(),
    amount: Visibility.protect(Type.Number(), { policy: Visibility.Policy.Actor }),
    // Any number of Treasure cards added to this bid, on top of the ducat amount -
    // "it can be used during a duel together with other money cards, or on
    // its own." Nothing in the rulebook limits a bid to just one. Only spent
    // (discarded) if this bid ends up winning.
    treasureValues: Visibility.protect(Type.Optional(Type.Array(Type.Number())), {
        policy: Visibility.Policy.Actor
    }),
    metadata: Type.Optional(SubmitDuelBidMetadata)
})

export const SubmitDuelBidValidator = Compile(SubmitDuelBid)

export function isSubmitDuelBid(action?: GameAction): action is SubmitDuelBid {
    return action?.type === ActionType.SubmitDuelBid
}

export class HydratedSubmitDuelBid
    extends HydratableAction<typeof SubmitDuelBid>
    implements SubmitDuelBid
{
    declare type: ActionType.SubmitDuelBid
    declare playerId: string
    declare amount: number
    declare treasureValues?: number[]
    declare metadata?: SubmitDuelBidMetadata

    constructor(data: SubmitDuelBid) {
        super(data, SubmitDuelBidValidator)
    }

    apply(state: HydratedLowenherzGameState, context?: MachineContext) {
        if (!this.isValidSubmitDuelBid(state)) {
            throw Error('Invalid SubmitDuelBid action')
        }

        const treasureValues = this.treasureValues ?? []
        state.duel!.bids.push({
            playerId: this.playerId,
            amount: this.amount,
            ...(treasureValues.length > 0 ? { treasureValues } : {})
        })

        this.metadata =
            treasureValues.length > 0
                ? {
                      treasureCardsUsed: treasureValues.map((value) => ({
                          type: PoliticsCardType.Treasure,
                          value
                      }))
                  }
                : {}
    }

    isValidSubmitDuelBid(state: HydratedLowenherzGameState): boolean {
        const duel = state.duel
        if (!duel) return false
        if (!duel.playerIds.includes(this.playerId)) return false
        if (duel.bids.some((b) => b.playerId === this.playerId)) return false

        const myMoney = state.getPlayerState(this.playerId).getMoney()
        if (!Number.isInteger(this.amount) || this.amount < 0 || this.amount > myMoney) return false

        const cards = (this.treasureValues ?? []).map((value) => ({
            type: PoliticsCardType.Treasure,
            value
        }))
        return hasPoliticsCards(state.getPlayerState(this.playerId).getPoliticsCards(), cards)
    }
}
