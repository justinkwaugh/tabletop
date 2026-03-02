import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { nextMergerBidderId } from '../operations/mergers.js'

export type PlaceMergerBidMetadata = Type.Static<typeof PlaceMergerBidMetadata>
export const PlaceMergerBidMetadata = Type.Object({
    previousHighBid: Type.Number(),
    newHighBid: Type.Number()
})

export type PlaceMergerBid = Type.Static<typeof PlaceMergerBid>
export const PlaceMergerBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceMergerBid),
            playerId: Type.String(),
            metadata: Type.Optional(PlaceMergerBidMetadata),
            amount: Type.Number()
        })
    ])
)

export const PlaceMergerBidValidator = Compile(PlaceMergerBid)

export function isPlaceMergerBid(action?: GameAction): action is PlaceMergerBid {
    return action?.type === ActionType.PlaceMergerBid
}

export class HydratedPlaceMergerBid
    extends HydratableAction<typeof PlaceMergerBid>
    implements PlaceMergerBid
{
    declare type: ActionType.PlaceMergerBid
    declare playerId: string
    declare metadata?: PlaceMergerBidMetadata
    declare amount: number

    constructor(data: PlaceMergerBid) {
        super(data, PlaceMergerBidValidator)
    }

    apply(state: HydratedIndonesiaGameState, _context?: MachineContext) {
        if (!this.isValidPlaceMergerBid(state)) {
            throw Error('Invalid PlaceMergerBid action')
        }

        const proposal = state.activeMergerProposal
        const auction = state.activeMergerAuction
        const bidOrder = state.mergerBidOrder
        assertExists(proposal, 'Merger proposal should be present while placing merger bid')
        assertExists(auction, 'Merger auction should be present while placing merger bid')
        assertExists(bidOrder, 'Merger bid order should be present while placing merger bid')

        const previousHighBid = auction.highBid ?? 0
        auction.placeBid(this.playerId, this.amount)
        auction.highBid = this.amount
        state.mergerCurrentBidderId =
            nextMergerBidderId(bidOrder, this.playerId, auction) ?? undefined

        this.metadata = {
            previousHighBid,
            newHighBid: this.amount
        }
    }

    isValidPlaceMergerBid(state: HydratedIndonesiaGameState): boolean {
        if (state.activePlayerIds[0] !== this.playerId) {
            return false
        }

        const proposal = state.activeMergerProposal
        const auction = state.activeMergerAuction
        if (!proposal || !auction) {
            return false
        }

        if (state.mergerCurrentBidderId !== this.playerId) {
            return false
        }

        if (!Number.isFinite(this.amount) || !Number.isInteger(this.amount)) {
            return false
        }

        const currentHighBid = auction.highBid ?? 0
        if (this.amount <= currentHighBid) {
            return false
        }

        if ((this.amount - proposal.nominalValue) % proposal.bidIncrement !== 0) {
            return false
        }

        const participant = auction.participants.find((entry) => entry.playerId === this.playerId)
        if (!participant || participant.passed) {
            return false
        }

        const bidderCash = state.getPlayerState(this.playerId).cash
        return this.amount <= bidderCash
    }

    static canPlaceMergerBid(state: HydratedIndonesiaGameState, playerId: string): boolean {
        const proposal = state.activeMergerProposal
        const auction = state.activeMergerAuction
        if (!proposal || !auction) {
            return false
        }
        if (state.mergerCurrentBidderId !== playerId) {
            return false
        }

        const participant = auction.participants.find((entry) => entry.playerId === playerId)
        if (!participant || participant.passed) {
            return false
        }

        const currentHighBid = auction.highBid ?? 0
        let minimumBid = Math.max(currentHighBid + 1, proposal.nominalValue)
        const offset = (minimumBid - proposal.nominalValue) % proposal.bidIncrement
        if (offset !== 0) {
            minimumBid += proposal.bidIncrement - offset
        }
        const bidderCash = state.getPlayerState(playerId).cash
        return minimumBid <= bidderCash
    }
}
