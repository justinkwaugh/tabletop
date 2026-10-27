import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedPowerGridGameState } from '../model/gameState.js'
import { AuctionResult } from './auctionResult.js'

export type PassBid = Type.Static<typeof PassBid>
export const PassBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PassBid),
            playerId: Type.String(),
            metadata: Type.Optional(AuctionResult)
        })
    ])
)

export const PassBidValidator = Compile(PassBid)

export function isPassBid(action?: GameAction): action is PassBid {
    return action?.type === ActionType.PassBid
}

export class HydratedPassBid extends HydratableAction<typeof PassBid> implements PassBid {
    declare type: ActionType.PassBid
    declare playerId: string
    declare metadata?: AuctionResult

    constructor(data: PassBid) {
        super(data, PassBidValidator)
    }

    apply(state: HydratedPowerGridGameState, _context?: MachineContext) {
        const plant = state.auction?.plant
        if (plant === undefined || state.currentBidderId() !== this.playerId) {
            throw Error('Invalid PassBid action')
        }
        const outcome = state.passBid(this.playerId)
        this.metadata = { plant, withdrawn: outcome.withdrawn, winner: outcome.winner }
    }
}
