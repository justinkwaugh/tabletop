import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export enum NegotiationMoveKind {
    // Sets (or replaces) the shared standing offer - either negotiator can propose,
    // at any time, not just "on their turn". Clears any existing signatures, since
    // those applied to whatever the old terms were.
    Propose = 'propose',
    // Signs the CURRENTLY standing offer. Once both negotiators have signed the same
    // offer, it executes immediately (see apply()).
    Sign = 'sign',
    // Either player can walk away from the negotiation entirely, forcing a duel.
    Decline = 'decline'
}

export type NegotiationMoveMetadata = Type.Static<typeof NegotiationMoveMetadata>
export const NegotiationMoveMetadata = Type.Object({
    // Set only on the Sign move that completes both signatures - state.negotiation
    // (which held the offer) is cleared right after it executes. History needs this
    // to say who actually performs the action: the OFFERER, not whoever signed last.
    executedOffer: Type.Optional(
        Type.Object({
            fromPlayerId: Type.String(),
            toPlayerId: Type.String(),
            amount: Type.Number()
        })
    )
})

export type NegotiationMove = Type.Static<typeof NegotiationMove>
export const NegotiationMove = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.NegotiationMove),
            playerId: Type.String(),
            kind: Type.Enum(NegotiationMoveKind),
            // Which negotiator would pay under this proposal - required for 'propose',
            // ignored otherwise. Deliberately independent of the submitting playerId:
            // either negotiator can propose either shape of deal ("I'll pay you" or
            // "you pay me"), not just offer their own money.
            fromPlayerId: Type.Optional(Type.String()),
            // Ducats fromPlayerId is proposing to pay the other negotiator - required
            // for 'propose', ignored otherwise.
            amount: Type.Optional(Type.Number()),
            metadata: Type.Optional(NegotiationMoveMetadata)
        })
    ])
)

export const NegotiationMoveValidator = Compile(NegotiationMove)

export function isNegotiationMove(action?: GameAction): action is NegotiationMove {
    return action?.type === ActionType.NegotiationMove
}

// One move in a 2-player negotiation over a tied slot. Both negotiators are active
// simultaneously (not turn-based): either can propose/revise the shared ducat offer
// at any time - naming EITHER negotiator as the payer, not just themselves, since a
// proposal is a suggested deal shape rather than a personal money offer - and once
// both have signed the SAME standing offer it executes: the named payer pays, and
// gets the right to perform the contested action. Either player can also decline
// outright, forcing a duel instead.
export class HydratedNegotiationMove
    extends HydratableAction<typeof NegotiationMove>
    implements NegotiationMove
{
    declare type: ActionType.NegotiationMove
    declare playerId: string
    declare kind: NegotiationMoveKind
    declare fromPlayerId?: string
    declare amount?: number
    declare metadata?: NegotiationMoveMetadata

    constructor(data: NegotiationMove) {
        super(data, NegotiationMoveValidator)
    }

    apply(state: HydratedLowenherzGameState, context?: MachineContext) {
        if (!this.isValidNegotiationMove(state)) {
            throw Error('Invalid NegotiationMove action')
        }

        const negotiation = state.negotiation!

        switch (this.kind) {
            case NegotiationMoveKind.Propose: {
                negotiation.offer = { fromPlayerId: this.fromPlayerId!, amount: this.amount! }
                negotiation.signedPlayerIds = []
                break
            }
            case NegotiationMoveKind.Sign: {
                if (!negotiation.signedPlayerIds.includes(this.playerId)) {
                    negotiation.signedPlayerIds = [...negotiation.signedPlayerIds, this.playerId]
                }

                if (negotiation.signedPlayerIds.length < negotiation.playerIds.length) {
                    break
                }

                // Both signed - the deal executes immediately.
                const offer = negotiation.offer!
                const toPlayerId = negotiation.playerIds.find((id) => id !== offer.fromPlayerId)!
                state.getPlayerState(offer.fromPlayerId).money -= offer.amount
                state.getPlayerState(toPlayerId).money += offer.amount
                state.resolvedSlots.push({ slot: negotiation.slot, winnerPlayerId: offer.fromPlayerId })
                state.negotiation = undefined
                this.metadata = {
                    executedOffer: { fromPlayerId: offer.fromPlayerId, toPlayerId, amount: offer.amount }
                }
                return
            }
            case NegotiationMoveKind.Decline: {
                state.duel = {
                    slot: negotiation.slot,
                    playerIds: negotiation.playerIds,
                    bids: [],
                    tieCount: 0
                }
                state.negotiation = undefined
                break
            }
        }

        this.metadata = {}
    }

    isValidNegotiationMove(state: HydratedLowenherzGameState): boolean {
        const negotiation = state.negotiation
        if (!negotiation || !negotiation.playerIds.includes(this.playerId)) return false

        switch (this.kind) {
            case NegotiationMoveKind.Propose: {
                if (this.fromPlayerId === undefined || !negotiation.playerIds.includes(this.fromPlayerId)) {
                    return false
                }
                const proposerMoney = state.getPlayerState(this.fromPlayerId).money
                return (
                    this.amount !== undefined &&
                    Number.isInteger(this.amount) &&
                    this.amount >= 1 &&
                    this.amount <= proposerMoney
                )
            }
            case NegotiationMoveKind.Sign: {
                return negotiation.offer !== undefined && !negotiation.signedPlayerIds.includes(this.playerId)
            }
            case NegotiationMoveKind.Decline: {
                return true
            }
        }
    }
}
