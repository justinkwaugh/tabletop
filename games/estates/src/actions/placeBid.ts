import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { HydratedEstatesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type PlaceBid = Static<typeof PlaceBid>
export const PlaceBid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceBid),
            playerId: Type.String(),
            amount: Type.Number()
        })
    ])
)

export const PlaceBidValidator = Compile(PlaceBid)

export function isPlaceBid(action?: GameAction): action is PlaceBid {
    return action?.type === ActionType.PlaceBid
}

export class HydratedPlaceBid extends HydratableAction<typeof PlaceBid> implements PlaceBid {
    declare type: ActionType.PlaceBid
    declare playerId: string
    declare amount: number

    constructor(data: PlaceBid) {
        super(data, PlaceBidValidator)
    }

    apply(state: HydratedEstatesGameState) {
        const { valid, reason } = HydratedPlaceBid.isValidBid(state, this.playerId, this.amount)

        if (!valid) {
            throw Error(reason)
        }

        if (this.amount === 0) {
            state.auction?.pass(this.playerId)
        } else {
            state.auction?.placeBid(this.playerId, this.amount)
        }
    }

    static isValidBid(
        state: HydratedEstatesGameState,
        playerId: string,
        amount: number
    ): { valid: boolean; reason: string } {
        if (amount > 0) {
            const playerState = state.getPlayerState(playerId)
            if (playerState.money < amount) {
                return { valid: false, reason: 'Bid amount exceeds player money' }
            }

            if (state.auction?.highBid && amount <= state.auction?.highBid) {
                return { valid: false, reason: 'Bid must be higher than the last' }
            }
        }

        return { valid: true, reason: '' }
    }
}
