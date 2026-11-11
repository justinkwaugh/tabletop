import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { RailroadId } from '../maps/types.js'
import { AutomaticDevelopment, developAutomatically } from '../model/development.js'
import type { HydratedSarGameState } from '../model/gameState.js'

export type FinishDevelopmentMetadata = Type.Static<typeof FinishDevelopmentMetadata>
export const FinishDevelopmentMetadata = Type.Object({
    automatic: Type.Optional(AutomaticDevelopment),
    opensRailroad: Type.Optional(Type.Enum(RailroadId))
})

export type FinishDevelopment = Type.Static<typeof FinishDevelopment>
export const FinishDevelopment = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.FinishDevelopment),
            playerId: Type.String(),
            metadata: Type.Optional(FinishDevelopmentMetadata)
        })
    ])
)

export const FinishDevelopmentValidator = Compile(FinishDevelopment)

export function isFinishDevelopment(action?: GameAction): action is FinishDevelopment {
    return action?.type === ActionType.FinishDevelopment
}

// Declines the paid second development, which triggers Automatic Metro Development.
export class HydratedFinishDevelopment
    extends HydratableAction<typeof FinishDevelopment>
    implements FinishDevelopment
{
    declare type: ActionType.FinishDevelopment
    declare playerId: string
    declare metadata?: FinishDevelopmentMetadata

    constructor(data: FinishDevelopment) {
        super(data, FinishDevelopmentValidator)
    }

    apply(state: HydratedSarGameState, _context?: MachineContext) {
        assert(state.mayFinishDeveloping(), 'Only the paid development can be declined')
        const automatic = developAutomatically(state)
        const opensRailroad = state.railroadOpenedByIncome()
        this.metadata = {
            ...(automatic ? { automatic } : {}),
            ...(opensRailroad ? { opensRailroad } : {})
        }
    }

    static canFinish(state: HydratedSarGameState): boolean {
        return state.mayFinishDeveloping()
    }
}
