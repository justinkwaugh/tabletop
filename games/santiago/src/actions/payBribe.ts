import * as Type from 'typebox'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedSantiagoGameState } from '../model/gameState.js'
import { CanalSegment } from '../model/board.js'
import { isConnectedToSpring, isCanalPlaced } from '../util/irrigation.js'

export type PayBribe = Type.Static<typeof PayBribe>
export const PayBribe = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.PayBribe),
            // Amount paid to the canal overseer. 0 means the player declines to bribe.
            amount: Type.Number({ minimum: 0 }),
            // Canal segment the owner will place. Required when amount > 0.
            segment: Type.Optional(CanalSegment)
        })
    ])
)

export const PayBribeValidator = Compile(PayBribe)

export function isPayBribe(action: GameAction): action is PayBribe {
    return action.type === ActionType.PayBribe
}

export class HydratedPayBribe extends HydratableAction<typeof PayBribe> implements PayBribe {
    declare type: ActionType.PayBribe
    declare amount: number
    declare segment?: CanalSegment

    constructor(data: PayBribe) {
        super(data, PayBribeValidator)
    }

    apply(state: HydratedSantiagoGameState) {
        if (!this.playerId) throw new Error('PayBribe requires a playerId')
        if (this.amount === 0) return  // passing — no money or canal change

        if (!state.canalOverseerId) throw new Error('No canal overseer to bribe')
        if (!this.segment) throw new Error('A canal segment is required when bribing')

        if (isCanalPlaced(state.board, this.segment)) {
            throw new Error('Canal segment is already placed')
        }
        if (!isConnectedToSpring(state.board, this.segment)) {
            throw new Error('Canal segment is not connected to the spring network')
        }

        const briber = state.getPlayerState(this.playerId)
        const owner = state.getPlayerState(state.canalOverseerId)

        briber.pay(this.amount)
        owner.earn(this.amount)

        state.board.canals.push(this.segment)
    }
}
