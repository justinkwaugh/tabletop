import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { nextMergerBidderId } from '../operations/mergers.js'

export type PassMergerBidMetadata = Type.Static<typeof PassMergerBidMetadata>
export const PassMergerBidMetadata = Type.Object({})

export type PassMergerBid = Type.Static<typeof PassMergerBid>
export const PassMergerBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PassMergerBid),
            playerId: Type.String(),
            metadata: Type.Optional(PassMergerBidMetadata)
        })
    ])
)

export const PassMergerBidValidator = Compile(PassMergerBid)

export function isPassMergerBid(action?: GameAction): action is PassMergerBid {
    return action?.type === ActionType.PassMergerBid
}

export class HydratedPassMergerBid
    extends HydratableAction<typeof PassMergerBid>
    implements PassMergerBid
{
    declare type: ActionType.PassMergerBid
    declare playerId: string
    declare metadata?: PassMergerBidMetadata

    constructor(data: PassMergerBid) {
        super(data, PassMergerBidValidator)
    }

    apply(state: HydratedIndonesiaGameState, _context?: MachineContext) {
        if (!this.isValidPassMergerBid(state)) {
            throw Error('Invalid PassMergerBid action')
        }

        const auction = state.activeMergerAuction
        const bidOrder = state.mergerBidOrder
        assertExists(auction, 'Merger auction should be present while passing merger bid')
        assertExists(bidOrder, 'Merger bid order should be present while passing merger bid')

        auction.pass(this.playerId)
        state.mergerCurrentBidderId =
            nextMergerBidderId(bidOrder, this.playerId, auction) ?? undefined
        this.metadata = {}
    }

    isValidPassMergerBid(state: HydratedIndonesiaGameState): boolean {
        if (state.activePlayerIds[0] !== this.playerId) {
            return false
        }

        if (state.mergerCurrentBidderId !== this.playerId) {
            return false
        }

        const auction = state.activeMergerAuction
        if (!auction) {
            return false
        }

        const participant = auction.participants.find((entry) => entry.playerId === this.playerId)
        if (!participant) {
            return false
        }

        if (auction.highBid === undefined) {
            return false
        }

        return !participant.passed
    }

    static canPassMergerBid(state: HydratedIndonesiaGameState, playerId: string): boolean {
        if (state.mergerCurrentBidderId !== playerId) {
            return false
        }
        const auction = state.activeMergerAuction
        if (!auction) {
            return false
        }

        const participant = auction.participants.find((entry) => entry.playerId === playerId)
        return !!participant && !participant.passed && auction.highBid !== undefined
    }
}
