import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { RailroadId } from '../maps/types.js'
import type { HydratedSarGameState } from '../model/gameState.js'

export type DevelopMetadata = Type.Static<typeof DevelopMetadata>
export const DevelopMetadata = Type.Object({
    cost: Type.Number(),
    income: Type.Number(),
    // The metro railroad, opened because this last development raised its home's income enough.
    opensRailroad: Type.Optional(Type.Enum(RailroadId))
})

export type Develop = Type.Static<typeof Develop>
export const Develop = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Develop),
            playerId: Type.String(),
            metadata: Type.Optional(DevelopMetadata),
            settlementId: Type.String()
        })
    ])
)

export const DevelopValidator = Compile(Develop)

export function isDevelop(action?: GameAction): action is Develop {
    return action?.type === ActionType.Develop
}

export class HydratedDevelop extends HydratableAction<typeof Develop> implements Develop {
    declare type: ActionType.Develop
    declare playerId: string
    declare metadata?: DevelopMetadata
    declare settlementId: string

    constructor(data: Develop) {
        super(data, DevelopValidator)
    }

    apply(state: HydratedSarGameState, _context?: MachineContext) {
        assert(
            state.affordableDevelopments(this.playerId).includes(this.settlementId),
            'That settlement cannot be developed'
        )
        const cost = state.developmentCost(this.settlementId)
        state.getPlayerState(this.playerId).cash -= cost
        state.developments[this.settlementId] = state.developmentLevel(this.settlementId) + 1
        state.developmentsThisTurn += 1
        const opensRailroad = HydratedDevelop.isLast(state)
            ? state.railroadOpenedByIncome()
            : undefined
        this.metadata = {
            cost,
            income: state.settlementIncome(this.settlementId),
            ...(opensRailroad ? { opensRailroad } : {})
        }
    }

    // Whether the action's developments are used up.
    static isLast(state: HydratedSarGameState): boolean {
        return state.developmentsThisTurn >= state.developmentsPerAction()
    }

    static canDevelop(state: HydratedSarGameState, playerId: string): boolean {
        return state.affordableDevelopments(playerId).length > 0
    }
}
