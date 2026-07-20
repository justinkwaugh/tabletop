import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export enum NegotiationMoveKind {
    Offer = 'offer',
    Accept = 'accept',
    Decline = 'decline'
}

export type NegotiationMoveMetadata = Type.Static<typeof NegotiationMoveMetadata>
export const NegotiationMoveMetadata = Type.Object({})

export type NegotiationMove = Type.Static<typeof NegotiationMove>
export const NegotiationMove = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.NegotiationMove),
            playerId: Type.String(),
            kind: Type.Enum(NegotiationMoveKind),
            // Ducats offered to the other player - required for 'offer', ignored otherwise.
            amount: Type.Optional(Type.Number()),
            metadata: Type.Optional(NegotiationMoveMetadata)
        })
    ])
)

export const NegotiationMoveValidator = Compile(NegotiationMove)

export function isNegotiationMove(action?: GameAction): action is NegotiationMove {
    return action?.type === ActionType.NegotiationMove
}

// One move in a 2-player negotiation over a tied slot: make a ducat offer to the other
// player for the right to perform the action, accept their standing offer (they get
// paid, I perform the action), or decline further negotiation (forcing a duel).
export class HydratedNegotiationMove
    extends HydratableAction<typeof NegotiationMove>
    implements NegotiationMove
{
    declare type: ActionType.NegotiationMove
    declare playerId: string
    declare kind: NegotiationMoveKind
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
        const otherPlayerId = negotiation.playerIds.find((id) => id !== this.playerId)!

        switch (this.kind) {
            case NegotiationMoveKind.Offer: {
                negotiation.offer = { fromPlayerId: this.playerId, amount: this.amount! }
                negotiation.turnPlayerId = otherPlayerId
                break
            }
            case NegotiationMoveKind.Accept: {
                const offer = negotiation.offer!
                state.getPlayerState(offer.fromPlayerId).money -= offer.amount
                state.getPlayerState(this.playerId).money += offer.amount
                state.resolvedSlots.push({ slot: negotiation.slot, winnerPlayerId: offer.fromPlayerId })
                state.negotiation = undefined
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
        if (!negotiation || negotiation.turnPlayerId !== this.playerId) return false

        switch (this.kind) {
            case NegotiationMoveKind.Offer: {
                const myMoney = state.getPlayerState(this.playerId).money
                return (
                    this.amount !== undefined &&
                    Number.isInteger(this.amount) &&
                    this.amount >= 0 &&
                    this.amount <= myMoney
                )
            }
            case NegotiationMoveKind.Accept: {
                return negotiation.offer !== undefined
            }
            case NegotiationMoveKind.Decline: {
                return true
            }
        }
    }
}
