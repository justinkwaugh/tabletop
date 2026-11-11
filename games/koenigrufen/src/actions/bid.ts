import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Contract, ContractSchema } from '../components/contracts.js'
import { ActionType } from '../definition/actions.js'
import { Bonus, BonusSchema } from '../model/announcements.js'
import { bidChoice } from '../model/auction.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

export type Bid = Type.Static<typeof Bid>
export const Bid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Bid),
            playerId: Type.String(),
            contract: ContractSchema,
            // Besserrufer's bird.
            bird: Type.Optional(BonusSchema)
        })
    ])
)

export const BidValidator = Compile(Bid)

export function isBid(action?: GameAction): action is Bid {
    return action?.type === ActionType.Bid
}

export class HydratedBid extends HydratableAction<typeof Bid> implements Bid {
    declare type: ActionType.Bid
    declare playerId: string
    declare contract: Contract
    declare bird?: Bonus

    constructor(data: Bid) {
        super(data, BidValidator)
    }

    apply(state: HydratedKoenigrufenGameState) {
        state.bid(this.playerId, bidChoice(this.contract, this.bird))
    }
}
