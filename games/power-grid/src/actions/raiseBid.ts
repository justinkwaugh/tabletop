import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedPowerGridGameState } from '../model/gameState.js'
import { AuctionResult } from './auctionResult.js'

export type RaiseBid = Type.Static<typeof RaiseBid>
export const RaiseBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.RaiseBid),
            playerId: Type.String(),
            amount: Type.Integer({ minimum: 1 }),
            metadata: Type.Optional(AuctionResult)
        })
    ])
)

export const RaiseBidValidator = Compile(RaiseBid)

export function isRaiseBid(action?: GameAction): action is RaiseBid {
    return action?.type === ActionType.RaiseBid
}

export class HydratedRaiseBid extends HydratableAction<typeof RaiseBid> implements RaiseBid {
    declare type: ActionType.RaiseBid
    declare playerId: string
    declare amount: number
    declare metadata?: AuctionResult

    constructor(data: RaiseBid) {
        super(data, RaiseBidValidator)
    }

    apply(state: HydratedPowerGridGameState, _context?: MachineContext) {
        const plant = state.auction?.plant
        if (
            plant === undefined ||
            !HydratedRaiseBid.isValidBid(state, this.playerId, this.amount)
        ) {
            throw Error('Invalid RaiseBid action')
        }
        const outcome = state.raiseBid(this.playerId, this.amount)
        this.metadata = { plant, withdrawn: outcome.withdrawn, winner: outcome.winner }
    }

    static isValidBid(
        state: HydratedPowerGridGameState,
        playerId: string,
        amount: number
    ): boolean {
        const bidding = state.bidding()
        return (
            bidding !== undefined &&
            bidding.currentBidderId === playerId &&
            amount > bidding.highBid &&
            state.canAfford(playerId, amount)
        )
    }
}
