import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export enum NegotiationMoveKind {
    // Sets (or replaces) the standing offer - only the player who is NOT the last
    // proposer may do this (see isValidNegotiationMove); it is their move once the
    // other side has proposed. Proposing back the EXACT terms already standing is
    // acceptance, not a counter-proposal, and executes the deal immediately (see
    // apply()) rather than becoming the new standing offer.
    Propose = 'propose',
    // Either player can walk away from the negotiation entirely, forcing a duel -
    // at any stage, whether or not it is currently their turn to propose.
    Decline = 'decline'
}

export type NegotiationMoveMetadata = Type.Static<typeof NegotiationMoveMetadata>
export const NegotiationMoveMetadata = Type.Object({
    // Set only on the Propose that completes the deal by matching the standing offer -
    // state.negotiation (which held the offer) is cleared right after it executes.
    // History needs this to say who actually performs the action: the OFFERER, not
    // whoever accepted last.
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

// One move in a 2-player negotiation over a tied slot. Turn-based: a Propose is only
// the non-last-proposer's move, naming EITHER negotiator as the payer, not just
// themselves, since a proposal is a suggested deal shape rather than a personal money
// offer. Proposing back the exact terms already standing is acceptance and executes
// immediately: the named payer pays, and gets the right to perform the contested
// action. Either player can also decline outright at any stage, forcing a duel instead.
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
                const proposed = { fromPlayerId: this.fromPlayerId!, amount: this.amount! }
                const standing = negotiation.offer

                // Proposing back the exact terms the other side just put up is
                // acceptance, not a counter - it executes immediately rather than
                // becoming (again) the standing offer. isValidNegotiationMove already
                // guarantees this is a DIFFERENT player than whoever proposed those
                // terms, so this can only be reached by the other negotiator agreeing.
                if (
                    standing &&
                    standing.fromPlayerId === proposed.fromPlayerId &&
                    standing.amount === proposed.amount
                ) {
                    // The deal executes immediately, and is binding. Marking this move
                    // keeps Undo from crossing back over it (see GameSession.undoableAction,
                    // which refuses to cross any action flagged revealsInfo - the same guard
                    // the duel puts on the bid that reveals every bid). Without it, either
                    // side could unilaterally retract an agreement the other had already
                    // been paid for. Every EARLIER proposal in the exchange stays undoable -
                    // nothing is binding until both sides land on the same terms.
                    this.revealsInfo = true

                    const toPlayerId = negotiation.playerIds.find((id) => id !== standing.fromPlayerId)!
                    state.getPlayerState(standing.fromPlayerId).money -= standing.amount
                    state.getPlayerState(toPlayerId).money += standing.amount
                    state.resolvedSlots.push({ slot: negotiation.slot, winnerPlayerId: standing.fromPlayerId })
                    state.negotiation = undefined
                    this.metadata = {
                        executedOffer: { fromPlayerId: standing.fromPlayerId, toPlayerId, amount: standing.amount }
                    }
                    return
                }

                negotiation.offer = proposed
                negotiation.lastProposedBy = this.playerId
                break
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
                // Turn-based: whoever proposed last (if anyone) cannot propose again
                // until the other side has moved - undoing their own proposal is the
                // only way back to it being their turn again.
                if (negotiation.lastProposedBy === this.playerId) return false
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
            case NegotiationMoveKind.Decline: {
                return true
            }
        }
    }
}
