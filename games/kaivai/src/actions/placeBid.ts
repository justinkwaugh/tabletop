import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { HydratedKaivaiGameState } from '../model/gameState.js'
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

const movementList = [1, 2, 3, 4, 5, 4, 3, 2, 1, 0]

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

    apply(state: HydratedKaivaiGameState) {
        const playerState = state.getPlayerState(this.playerId)
        const { valid, reason } = HydratedPlaceBid.isValidBid(state, this.amount)

        if (!valid) {
            throw Error(reason)
        }

        state.bids[this.playerId] = this.amount
        playerState.buildingCost = this.amount
        playerState.baseMovement = movementList[this.amount - 1]
    }

    static isValidBid(
        state: HydratedKaivaiGameState,
        amount: number
    ): { valid: boolean; reason: string } {
        if (amount < 1 || amount > 10) {
            return { valid: false, reason: 'Bid must be between 1 and 10' }
        }

        if (Object.values(state.bids).some((bid) => bid === amount)) {
            return { valid: false, reason: 'Bid amount already taken' }
        }

        return { valid: true, reason: '' }
    }
}
