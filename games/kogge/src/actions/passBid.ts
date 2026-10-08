import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'

export type PassBid = Type.Static<typeof PassBid>
export const PassBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PassBid),
            playerId: Type.String()
        })
    ])
)

export const PassBidValidator = Compile(PassBid)

export function isPassBid(action?: GameAction): action is PassBid {
    return action?.type === ActionType.PassBid
}

// Rulebook 1: only a player without route markers, or whose markers could only repeat
// an earlier bid, skips the auction.
export class HydratedPassBid extends HydratableAction<typeof PassBid> implements PassBid {
    declare type: ActionType.PassBid
    declare playerId: string

    constructor(data: PassBid) {
        super(data, PassBidValidator)
    }

    apply(state: HydratedKoggeGameState, _context?: MachineContext) {
        if (!HydratedPassBid.canPassBid(state, this.playerId)) {
            throw Error('Invalid PassBid action')
        }
        state.bids.push({ playerId: this.playerId, markers: [] })
    }

    static canPassBid(state: HydratedKoggeGameState, playerId: string): boolean {
        return state.nextBidderId() === playerId && state.mustPass(playerId)
    }
}
