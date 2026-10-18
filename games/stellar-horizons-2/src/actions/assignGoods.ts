import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import {
    AssignmentResult,
    GoodsAssignment,
    assignGoods,
    assignmentProblem
} from '../model/trade.js'

export type AssignGoods = Type.Static<typeof AssignGoods>
export const AssignGoods = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.AssignGoods),
            playerId: Type.String(),
            assignments: Type.Array(GoodsAssignment),
            metadata: Type.Optional(AssignmentResult)
        })
    ])
)

export const AssignGoodsValidator = Compile(AssignGoods)

export function isAssignGoods(action?: GameAction): action is AssignGoods {
    return action?.type === ActionType.AssignGoods
}

// Rulebook 4.5: the Player assigns their drawn goods at once; any left over earn $1B each.
export class HydratedAssignGoods
    extends HydratableAction<typeof AssignGoods>
    implements AssignGoods
{
    declare type: ActionType.AssignGoods
    declare playerId: string
    declare assignments: GoodsAssignment[]
    declare metadata?: AssignmentResult

    constructor(data: AssignGoods) {
        super(data, AssignGoodsValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (
            state.getPlayerState(this.playerId).drawnGoods.length === 0 ||
            assignmentProblem(state, this.playerId, this.assignments) !== undefined
        ) {
            throw Error('Invalid AssignGoods action')
        }
        this.metadata = assignGoods(state, this.playerId, this.assignments)
    }
}
