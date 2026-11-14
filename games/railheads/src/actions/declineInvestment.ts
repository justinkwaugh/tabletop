import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'
import { claimableItems, declineInvestment, mayDecline } from '../model/industryAuctionRules.js'

export type DeclineInvestment = Type.Static<typeof DeclineInvestment>
export const DeclineInvestment = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DeclineInvestment),
            playerId: Type.String()
        })
    ])
)

export const DeclineInvestmentValidator = Compile(DeclineInvestment)

export function isDeclineInvestment(action?: GameAction): action is DeclineInvestment {
    return action?.type === ActionType.DeclineInvestment
}

export class HydratedDeclineInvestment
    extends HydratableAction<typeof DeclineInvestment>
    implements DeclineInvestment
{
    declare type: ActionType.DeclineInvestment
    declare playerId: string

    constructor(data: DeclineInvestment) {
        super(data, DeclineInvestmentValidator)
    }

    apply(state: HydratedRailheadsGameState, _context?: MachineContext) {
        declineInvestment(state, this.playerId)
    }

    static canDecline(state: HydratedRailheadsGameState, playerId: string): boolean {
        return mayDecline(state) && claimableItems(state, playerId).length > 0
    }
}
